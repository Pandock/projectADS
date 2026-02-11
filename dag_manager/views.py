"""Views for DAG Manager plugin"""

import os
import logging
import shutil
import re
import tempfile
import zipfile
from typing import Dict, List, Optional, Tuple

from flask import request, jsonify, send_file
from flask_appbuilder import BaseView, expose, has_access
from airflow.configuration import conf
from airflow.www.decorators import action_logging
from airflow.www.app import csrf
from flask_login import current_user

logger = logging.getLogger(__name__)

# Регулярка для безопасных имен файлов (допустимые символы в Linux, кроме / и null)
# Разрешаем: буквы, цифры, точку, дефис, подчеркивание, пробелы и другие безопасные символы
SAFE_FILENAME_REGEX = re.compile(r'^[a-zA-Zа-яА-ЯёЁ0-9().,\s\-_+]+$')

# Скрытые файлы и папки (игнорируем)
HIDDEN_ITEMS = {
    '.git', '.gitignore', '.svn', '.hg',
    '__pycache__', '.pytest_cache', '.mypy_cache',
    '.venv', 'venv', '.env',
    '.DS_Store', 'Thumbs.db',
    '.idea', '.vscode',
    'node_modules',
    '.pyc', '.pyo', '.pyd'
}

class DagManagerView(BaseView):
    """File browser view for managing DAG files"""

    default_view = "index"
    route_base = "/dagmanager"
    template_folder = os.path.join(os.path.dirname(__file__), "templates")

    def __init__(self):
        super().__init__()
        self.mounts = self._get_mounts()
        logger.info(f"DAG Manager initialized with mounts: {self.mounts}")

    def _should_skip_item(self, name: str) -> bool:
        """Check if item should be skipped (hidden/system files)"""
        # Файлы и папки начинающиеся с точки
        if name.startswith('.'):
            return True

        # Файлы из черного списка
        if name in HIDDEN_ITEMS:
            return True

        # Файлы с расширениями из черного списка
        if any(name.endswith(ext) for ext in ['.pyc', '.pyo', '.pyd']):
            return True

        return False

    def _get_mounts(self) -> Dict[str, str]:
        """Get mount points from configuration"""
        mounts = {}

        try:
            if conf.has_section("dag_manager"):
                for key, value in conf.items("dag_manager"):
                    if key.startswith("mount"):
                        mount_name = key
                        mounts[mount_name] = os.path.abspath(value)
                        logger.info(f"Added mount point: {mount_name} -> {value}")
        except Exception as e:
            logger.debug(f"No custom mount points in config: {e}")

        if not mounts:
            dags_folder = conf.get("core", "dags_folder")
            mounts["dags"] = os.path.abspath(dags_folder)
            logger.info(f"Using default DAGs folder: {dags_folder}")

        return mounts

    def _get_root_path(self, mount: str) -> Optional[str]:
        """Get root path for specific mount point"""
        return self.mounts.get(mount)

    def _is_path_safe(self, mount: str, requested_path: str) -> bool:
        """Check if requested path is within mount directory"""
        root_path = self._get_root_path(mount)
        if not root_path:
            return False

        try:
            requested_absolute = os.path.abspath(os.path.join(root_path, requested_path))
            return requested_absolute.startswith(root_path)
        except Exception as e:
            logger.warning(f"Path validation failed: {e}")
            return False

    def _is_filename_safe(self, filename: str) -> bool:
        """Check if filename is safe (no path traversal, special chars)"""
        if not filename or filename in ['.', '..']:
            return False
        if '/' in filename or '\\' in filename or '\x00' in filename:
            return False
        if not SAFE_FILENAME_REGEX.match(filename):
            return False
        return True

    def _count_items_in_directory(self, mount: str, path: str) -> int:
        """Count total items (files + folders) in directory"""
        try:
            root_path = self._get_root_path(mount)
            if not root_path:
                return 0

            full_path = os.path.join(root_path, path)

            if not self._is_path_safe(mount, path):
                return 0

            if not os.path.exists(full_path) or not os.path.isdir(full_path):
                return 0

            return len(os.listdir(full_path))
        except Exception:
            return 0

    def _create_zip_archive(self, source_dir: str, output_filename: str) -> str:
        """Create a zip archive of a directory"""
        temp_dir = tempfile.gettempdir()
        zip_path = os.path.join(temp_dir, output_filename)

        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(source_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, source_dir)
                    zipf.write(file_path, arcname)

        return zip_path

    def _get_directory_tree_recursive(self, mount: str, path: str = "", depth: int = 0, max_depth: int = 3) -> List[Dict]:
        """Get directory tree structure recursively"""
        if depth > max_depth:
            return []

        try:
            root_path = self._get_root_path(mount)
            if not root_path:
                return []

            full_path = os.path.join(root_path, path)

            if not self._is_path_safe(mount, path):
                logger.warning(f"Unsafe path access attempt: {path}")
                return []

            if not os.path.exists(full_path) or not os.path.isdir(full_path):
                return []

            items = []
            try:
                entries = sorted(os.listdir(full_path))
            except PermissionError:
                logger.warning(f"Permission denied accessing: {full_path}")
                return []

            for entry in entries:
                # Пропускаем скрытые файлы
                if self._should_skip_item(entry):
                    continue

                entry_path = os.path.join(full_path, entry)
                relative_path = os.path.relpath(entry_path, root_path)

                if os.path.isdir(entry_path):
                    children = self._get_directory_tree_recursive(mount, relative_path, depth + 1, max_depth)

                    items.append({
                        "name": entry,
                        "type": "directory",
                        "path": relative_path,
                        "mount": mount,
                        "children": children,
                        "has_children": len(children) > 0 or depth >= max_depth
                    })

            return items
        except Exception as e:
            logger.error(f"Error getting directory tree: {e}")
            return []

    def _get_directory_contents(self, mount: str, path: str = "") -> Tuple[List[Dict], List[Dict]]:
        """Get contents of a directory (folders and files separately)"""
        try:
            root_path = self._get_root_path(mount)
            if not root_path:
                return [], []

            full_path = os.path.join(root_path, path)

            if not self._is_path_safe(mount, path):
                logger.warning(f"Unsafe path access attempt: {path}")
                return [], []

            if not os.path.exists(full_path) or not os.path.isdir(full_path):
                return [], []

            folders = []
            files = []

            try:
                entries = sorted(os.listdir(full_path))
            except PermissionError:
                logger.warning(f"Permission denied accessing: {full_path}")
                return [], []

            for entry in entries:
                # Пропускаем скрытые файлы
                if self._should_skip_item(entry):
                    continue

                entry_path = os.path.join(full_path, entry)
                relative_path = os.path.relpath(entry_path, root_path)

                try:
                    stat_info = os.stat(entry_path)
                    size = stat_info.st_size
                    modified = stat_info.st_mtime
                except Exception:
                    size = 0
                    modified = 0

                item = {
                    "name": entry,
                    "path": relative_path,
                    "mount": mount,
                    "size": size,
                    "modified": modified
                }

                if os.path.isdir(entry_path):
                    item["item_count"] = self._count_items_in_directory(mount, relative_path)
                    folders.append(item)
                else:
                    files.append(item)

            return folders, files
        except Exception as e:
            logger.error(f"Error getting directory contents: {e}")
            return [], []

    def _read_file(self, mount: str, path: str) -> Optional[str]:
        """Read file contents with multiple encoding attempts"""
        try:
            root_path = self._get_root_path(mount)
            if not root_path:
                logger.error("No root path found")
                return None

            full_path = os.path.join(root_path, path)

            if not self._is_path_safe(mount, path):
                logger.warning(f"Unsafe file access attempt: {path}")
                return None

            if not os.path.exists(full_path):
                logger.error(f"File does not exist: {full_path}")
                return None

            if not os.path.isfile(full_path):
                logger.error(f"Path is not a file: {full_path}")
                return None

            file_size = os.path.getsize(full_path)
            if file_size > 5 * 1024 * 1024:
                return "File too large to display (>5MB)"

            # Пробуем разные кодировки (UTF-8 в приоритете)
            encodings = ['utf-8', 'utf-8-sig', 'cp1251', 'latin-1']
            content = None

            for encoding in encodings:
                try:
                    with open(full_path, "r", encoding=encoding) as f:
                        content = f.read()
                    logger.info(f"Successfully read file with {encoding}: {full_path}")
                    break
                except (UnicodeDecodeError, LookupError):
                    continue
                except Exception as e:
                    logger.error(f"Error reading file with {encoding}: {e}")
                    continue

            if content is None:
                # Последняя попытка - бинарное чтение с заменой ошибок
                try:
                    with open(full_path, "rb") as f:
                        binary_content = f.read()
                        content = binary_content.decode('utf-8', errors='replace')
                    logger.warning(f"Read file as binary with error replacement: {full_path}")
                except Exception as e:
                    logger.error(f"Failed to read file even as binary: {e}")
                    return f"Error reading file: {str(e)}"

            return content

        except Exception as e:
            logger.error(f"Error reading file {path}: {e}", exc_info=True)
            return None

    def _get_user_permissions(self) -> Dict[str, bool]:
        """Get current user's permissions for DAG Manager operations"""
        permissions = {
            'can_read': False,
            'can_edit': False,
            'can_create_file': False,      # ИСПРАВЛЕНИЕ: Разделено создание файлов
            'can_create_folder': False,    # ИСПРАВЛЕНИЕ: Разделено создание папок
            'can_delete': False,            # ИСПРАВЛЕНИЕ: Только удаление
            'can_rename': False,            # ИСПРАВЛЕНИЕ: Только переименование
            'can_download': False
        }

        try:
            # Проверяем права доступа к методам
            if hasattr(current_user, 'perms'):
                user_perms = current_user.perms if current_user.perms else []

                # Проверяем конкретные права
                permissions['can_read'] = any('can_read' in str(p).lower() or 'menu access' in str(p).lower() for p in user_perms)
                permissions['can_edit'] = any('api_save_file' in str(p) for p in user_perms)

                # ИСПРАВЛЕНИЕ БАГА 2: Раздельные проверки для создания файлов и папок
                permissions['can_create_file'] = any('api_create_file' in str(p) for p in user_perms)
                permissions['can_create_folder'] = any('api_create_folder' in str(p) for p in user_perms)

                # ИСПРАВЛЕНИЕ БАГА 1: Раздельные проверки для удаления и переименования
                permissions['can_delete'] = any('api_delete' in str(p) for p in user_perms)
                permissions['can_rename'] = any('api_rename' in str(p) for p in user_perms)

                permissions['can_download'] = any('api_download' in str(p) for p in user_perms)

                # Если есть доступ к плагину вообще, разрешаем чтение
                if any('DagManagerView' in str(p) or 'dag_manager' in str(p).lower() for p in user_perms):
                    permissions['can_read'] = True

                logger.info(f"User permissions: {permissions}")
        except Exception as e:
            logger.error(f"Error checking permissions: {e}")
            # По умолчанию даем только чтение
            permissions['can_read'] = True

        return permissions


    @expose("/")
    @has_access
    @action_logging
    def index(self):
        """Main file browser page"""
        logger.info("Rendering file browser template")
        permissions = self._get_user_permissions()
        return self.render_template(
            "file_browser.html",
            mounts=self.mounts,
            permissions=permissions
        )


    @expose("/api/mounts")
    @has_access
    def api_mounts(self):
        """API endpoint to get available mount points"""
        return jsonify({
            "mounts": [{"name": k, "path": v} for k, v in self.mounts.items()],
            "success": True
        })

    @expose("/api/tree")
    @has_access
    def api_tree(self):
        """API endpoint to get directory tree"""
        mount = request.args.get("mount", list(self.mounts.keys())[0])
        path = request.args.get("path", "")

        tree = self._get_directory_tree_recursive(mount, path, depth=0, max_depth=10)

        return jsonify({
            "tree": tree,
            "mount": mount,
            "success": True
        })

    @expose("/api/contents")
    @has_access
    def api_contents(self):
        """API endpoint to get directory contents"""
        mount = request.args.get("mount", list(self.mounts.keys())[0])
        path = request.args.get("path", "")

        folders, files = self._get_directory_contents(mount, path)

        return jsonify({
            "folders": folders,
            "files": files,
            "current_path": path,
            "mount": mount,
            "success": True
        })

    @expose("/api/file")
    @has_access
    def api_file(self):
        """API endpoint to get file contents"""
        try:
            mount = request.args.get("mount", list(self.mounts.keys())[0])
            path = request.args.get("path", "")

            logger.info(f"Reading file: mount={mount}, path={path}")

            content = self._read_file(mount, path)

            if content is None:
                logger.error(f"File not found or error reading: {path}")
                return jsonify({"error": "File not found or cannot be read", "success": False}), 404

            return jsonify({
                "content": content,
                "path": path,
                "mount": mount,
                "success": True
            })

        except Exception as e:
            logger.error(f"Exception in api_file: {e}", exc_info=True)
            return jsonify({"error": str(e), "success": False}), 500

    @expose("/api/download")
    @has_access
    @action_logging
    def api_download(self):
        """API endpoint to download a file or folder (as zip)"""
        try:
            mount = request.args.get("mount")
            path = request.args.get("path", "")

            root_path = self._get_root_path(mount)
            if not root_path:
                return jsonify({"error": "Invalid mount point", "success": False}), 400

            if not self._is_path_safe(mount, path):
                return jsonify({"error": "Invalid path", "success": False}), 400

            full_path = os.path.join(root_path, path)

            if not os.path.exists(full_path):
                return jsonify({"error": "Item not found", "success": False}), 404

            if os.path.isfile(full_path):
                # Скачиваем файл напрямую
                filename = os.path.basename(full_path)
                return send_file(full_path, as_attachment=True, download_name=filename)

            elif os.path.isdir(full_path):
                # Создаем zip архив папки
                folder_name = os.path.basename(full_path) or "archive"
                zip_filename = f"{folder_name}.zip"
                zip_path = self._create_zip_archive(full_path, zip_filename)

                return send_file(
                    zip_path,
                    as_attachment=True,
                    download_name=zip_filename,
                    mimetype='application/zip'
                )

            else:
                return jsonify({"error": "Invalid item type", "success": False}), 400

        except Exception as e:
            logger.error(f"Error downloading item: {e}")
            return jsonify({"error": str(e), "success": False}), 500

    @expose("/api/create_folder", methods=["POST"])
    @has_access
    @action_logging
    @csrf.exempt
    def api_create_folder(self):
        """API endpoint to create a new folder"""
        try:
            data = request.get_json()
            mount = data.get("mount")
            parent_path = data.get("path", "")
            folder_name = data.get("name", "").strip()

            if not folder_name:
                return jsonify({"error": "Недопустимое имя папки", "success": False}), 400

            if not self._is_filename_safe(folder_name):
                return jsonify({"error": "Недопустимое имя папки", "success": False}), 400

            root_path = self._get_root_path(mount)
            if not root_path:
                return jsonify({"error": "Invalid mount point", "success": False}), 400

            new_folder_path = os.path.join(parent_path, folder_name)

            if not self._is_path_safe(mount, new_folder_path):
                return jsonify({"error": "Invalid path", "success": False}), 400

            full_path = os.path.join(root_path, new_folder_path)

            if os.path.exists(full_path):
                return jsonify({"error": "Папка уже существует", "success": False}), 400

            os.makedirs(full_path)
            logger.info(f"Создана папка: {full_path}")

            return jsonify({"success": True, "message": "Папка создана"})

        except Exception as e:
            logger.error(f"Ошибка при создании папки: {e}")
            return jsonify({"error": str(e), "success": False}), 500

    @expose("/api/create_file", methods=["POST"])
    @has_access
    @action_logging
    @csrf.exempt
    def api_create_file(self):
        """API endpoint to create a new file"""
        try:
            data = request.get_json()
            mount = data.get("mount")
            parent_path = data.get("path", "")
            file_name = data.get("name", "").strip()

            if not file_name:
                return jsonify({"error": "Недопустимое имя файла", "success": False}), 400

            if not self._is_filename_safe(file_name):
                return jsonify({"error": "Недопустимое имя файла", "success": False}), 400

            root_path = self._get_root_path(mount)
            if not root_path:
                return jsonify({"error": "Invalid mount point", "success": False}), 400

            new_file_path = os.path.join(parent_path, file_name)

            if not self._is_path_safe(mount, new_file_path):
                return jsonify({"error": "Invalid path", "success": False}), 400

            full_path = os.path.join(root_path, new_file_path)

            if os.path.exists(full_path):
                return jsonify({"error": "Файл уже существует", "success": False}), 400

            with open(full_path, "w", encoding="utf-8") as f:
                f.write("")

            logger.info(f"Created file: {full_path}")

            return jsonify({"success": True, "message": "Файл создан"})

        except Exception as e:
            logger.error(f"Ошибка при создании файла: {e}")
            return jsonify({"error": str(e), "success": False}), 500

    @expose("/api/delete", methods=["POST"])
    @has_access
    @action_logging
    @csrf.exempt
    def api_delete(self):
        """API endpoint to delete a file or folder"""
        try:
            data = request.get_json()
            mount = data.get("mount")
            item_path = data.get("path", "")

            if not item_path:
                return jsonify({"error": "Path is required", "success": False}), 400

            root_path = self._get_root_path(mount)
            if not root_path:
                return jsonify({"error": "Invalid mount point", "success": False}), 400

            if not self._is_path_safe(mount, item_path):
                return jsonify({"error": "Invalid path", "success": False}), 400

            full_path = os.path.join(root_path, item_path)

            if not os.path.exists(full_path):
                return jsonify({"error": "Item not found", "success": False}), 404

            if os.path.isdir(full_path):
                shutil.rmtree(full_path)
            else:
                os.remove(full_path)

            logger.info(f"Deleted: {full_path}")

            return jsonify({"success": True, "message": "Элемент удален"})

        except Exception as e:
            logger.error(f"Ошибка при удалении: {e}")
            return jsonify({"error": str(e), "success": False}), 500

    @expose("/api/rename", methods=["POST"])
    @has_access
    @action_logging
    @csrf.exempt
    def api_rename(self):
        """API endpoint to rename a file or folder"""
        try:
            data = request.get_json()
            mount = data.get("mount")
            old_path = data.get("path", "")
            new_name = data.get("new_name", "").strip()

            if not old_path or not new_name:
                return jsonify({"error": "Недопустимое имя файла/папки", "success": False}), 400

            if not self._is_filename_safe(new_name):
                return jsonify({"error": "Недопустимое имя файла/папки", "success": False}), 400

            root_path = self._get_root_path(mount)
            if not root_path:
                return jsonify({"error": "Invalid mount point", "success": False}), 400

            if not self._is_path_safe(mount, old_path):
                return jsonify({"error": "Недопустимое имя файла/папки", "success": False}), 400

            full_old_path = os.path.join(root_path, old_path)

            if not os.path.exists(full_old_path):
                return jsonify({"error": "Item not found", "success": False}), 404

            parent_dir = os.path.dirname(old_path)
            new_path = os.path.join(parent_dir, new_name) if parent_dir else new_name

            if not self._is_path_safe(mount, new_path):
                return jsonify({"error": "Недопустимое имя файла/папки", "success": False}), 400

            full_new_path = os.path.join(root_path, new_path)

            if os.path.exists(full_new_path):
                return jsonify({"error": "Файл/папка уже существует", "success": False}), 400

            os.rename(full_old_path, full_new_path)
            logger.info(f"Renamed: {full_old_path} -> {full_new_path}")

            return jsonify({"success": True, "message": "Элемент переименован", "new_path": new_path})

        except Exception as e:
            logger.error(f"Error renaming item: {e}")
            return jsonify({"error": str(e), "success": False}), 500

    @expose("/api/save_file", methods=["POST"])
    @has_access
    @action_logging
    @csrf.exempt
    def api_save_file(self):
        """API endpoint to save file contents"""
        try:
            data = request.get_json()
            mount = data.get("mount")
            path = data.get("path", "")
            content = data.get("content", "")

            if not path:
                return jsonify({"error": "Path is required", "success": False}), 400

            root_path = self._get_root_path(mount)
            if not root_path:
                return jsonify({"error": "Invalid mount point", "success": False}), 400

            if not self._is_path_safe(mount, path):
                return jsonify({"error": "Invalid path", "success": False}), 400

            full_path = os.path.join(root_path, path)

            if not os.path.exists(full_path) or not os.path.isfile(full_path):
                return jsonify({"error": "File not found", "success": False}), 404

            # Записываем файл с UTF-8
            try:
                with open(full_path, "w", encoding="utf-8") as f:
                    f.write(content)
                logger.info(f"Saved file: {full_path} ({len(content)} chars)")
            except Exception as e:
                logger.error(f"Error writing file: {e}")
                return jsonify({"error": f"Error writing file: {str(e)}", "success": False}), 500

            return jsonify({
                "success": True, 
                "message": "File saved successfully",
                "path": path
            })

        except Exception as e:
            logger.error(f"Error saving file: {e}", exc_info=True)
            return jsonify({"error": str(e), "success": False}), 500
