import os
import logging
import shutil
import tempfile
import zipfile
from typing import Dict, List, Optional, Tuple

from dag_manager.security import SecurityValidator

logger = logging.getLogger(__name__)


class FileSystemOperations:

    def __init__(self, mounts: Dict[str, str], security_validator: SecurityValidator):
        self.mounts = mounts
        self.security = security_validator

    def get_root_path(self, mount: str) -> Optional[str]:
        return self.mounts.get(mount)

    def count_items_in_directory(self, mount: str, path: str) -> int:
        try:
            root_path = self.get_root_path(mount)
            if not root_path:
                return 0

            full_path = os.path.join(root_path, path)

            if not self.security.is_path_safe(mount, path):
                return 0

            if not os.path.exists(full_path) or not os.path.isdir(full_path):
                return 0

            return len(os.listdir(full_path))

        except Exception:
            return 0

    def get_directory_tree_recursive(
        self, 
        mount: str, 
        path: str = "", 
        depth: int = 0, 
        max_depth: int = 3
    ) -> List[Dict]:
        if depth > max_depth:
            return []

        try:
            root_path = self.get_root_path(mount)
            if not root_path:
                return []

            full_path = os.path.join(root_path, path)

            if not self.security.is_path_safe(mount, path):
                logger.warning(f"DAG Manager: Unsafe path access attempt: {path}")
                return []

            if not os.path.exists(full_path) or not os.path.isdir(full_path):
                return []

            items = []

            try:
                entries = sorted(os.listdir(full_path))
            except PermissionError:
                logger.warning(f"DAG Manager: Permission denied accessing: {full_path}")
                return []

            for entry in entries:
                if self.security.should_skip_item(entry):
                    continue

                entry_path = os.path.join(full_path, entry)
                relative_path = os.path.relpath(entry_path, root_path)

                if os.path.isdir(entry_path):
                    children = self.get_directory_tree_recursive(
                        mount, relative_path, depth + 1, max_depth
                    )

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
            logger.error(f"DAG Manager: Error getting directory tree: {e}")
            return []

    def get_directory_contents(
        self, 
        mount: str, 
        path: str = ""
    ) -> Tuple[List[Dict], List[Dict]]:
        try:
            root_path = self.get_root_path(mount)
            if not root_path:
                return [], []

            full_path = os.path.join(root_path, path)

            if not self.security.is_path_safe(mount, path):
                logger.warning(f"DAG Manager: Unsafe path access attempt: {path}")
                return [], []

            if not os.path.exists(full_path) or not os.path.isdir(full_path):
                return [], []

            folders = []
            files = []

            try:
                entries = sorted(os.listdir(full_path))
            except PermissionError:
                logger.warning(f"DAG Manager: Permission denied accessing: {full_path}")
                return [], []

            for entry in entries:
                if self.security.should_skip_item(entry):
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
                    item["item_count"] = self.count_items_in_directory(mount, relative_path)
                    folders.append(item)
                else:
                    files.append(item)

            return folders, files

        except Exception as e:
            logger.error(f"DAG Manager: Error getting directory contents: {e}")
            return [], []

    def read_file(self, mount: str, path: str) -> Optional[str]:
        try:
            root_path = self.get_root_path(mount)
            if not root_path:
                logger.error("DAG Manager: No root path found")
                return None

            full_path = os.path.join(root_path, path)

            if not self.security.is_path_safe(mount, path):
                logger.warning(f"DAG Manager: Unsafe file access attempt: {path}")
                return None

            if not os.path.exists(full_path):
                logger.error(f"DAG Manager: File does not exist: {full_path}")
                return None

            if not os.path.isfile(full_path):
                logger.error(f"DAG Manager: Path is not a file: {full_path}")
                return None

            file_size = os.path.getsize(full_path)
            if file_size > 5 * 1024 * 1024:
                return "File too large to display (>5MB)"

            # Try different encodings
            encodings = ['utf-8', 'utf-8-sig', 'cp1251', 'latin-1']
            content = None

            for encoding in encodings:
                try:
                    with open(full_path, "r", encoding=encoding) as f:
                        content = f.read()
                    logger.info(f"DAG Manager: Successfully read file with {encoding}: {full_path}")
                    break
                except (UnicodeDecodeError, LookupError):
                    continue
                except Exception as e:
                    logger.error(f"DAG Manager: Error reading file with {encoding}: {e}")
                    continue

            if content is None:
                # Last attempt - binary read with error replacement
                try:
                    with open(full_path, "rb") as f:
                        binary_content = f.read()
                        content = binary_content.decode('utf-8', errors='replace')
                    logger.warning(f"DAG Manager: Read file as binary with error replacement: {full_path}")
                except Exception as e:
                    logger.error(f"DAG Manager: Failed to read file even as binary: {e}")
                    return f"Error reading file: {str(e)}"

            return content

        except Exception as e:
            logger.error(f"DAG Manager: Error reading file {path}: {e}", exc_info=True)
            return None

    def write_file(self, mount: str, path: str, content: str) -> Tuple[bool, Optional[str]]:
        try:
            root_path = self.get_root_path(mount)
            if not root_path:
                return False, "Invalid mount point"

            if not self.security.is_path_safe(mount, path):
                return False, "Invalid path"

            full_path = os.path.join(root_path, path)

            if not os.path.exists(full_path) or not os.path.isfile(full_path):
                return False, "File not found"

            with open(full_path, "w", encoding="utf-8") as f:
                f.write(content)

            return True, None

        except Exception as e:
            logger.error(f"DAG Manager: Error writing file: {e}")
            return False, str(e)

    def create_file(self, mount: str, path: str, filename: str) -> Tuple[bool, Optional[str]]:
        try:
            root_path = self.get_root_path(mount)
            if not root_path:
                return False, "Invalid mount point"

            new_file_path = os.path.join(path, filename)

            if not self.security.is_path_safe(mount, new_file_path):
                return False, "Invalid path"

            full_path = os.path.join(root_path, new_file_path)

            if os.path.exists(full_path):
                return False, "Файл уже существует"

            with open(full_path, "w", encoding="utf-8") as f:
                f.write("")

            return True, None

        except Exception as e:
            logger.error(f"DAG Manager: Error creating file: {e}")
            return False, str(e)

    def create_folder(self, mount: str, path: str, foldername: str) -> Tuple[bool, Optional[str]]:
        try:
            root_path = self.get_root_path(mount)
            if not root_path:
                return False, "Invalid mount point"

            new_folder_path = os.path.join(path, foldername)

            if not self.security.is_path_safe(mount, new_folder_path):
                return False, "Invalid path"

            full_path = os.path.join(root_path, new_folder_path)

            if os.path.exists(full_path):
                return False, "Папка уже существует"

            os.makedirs(full_path)

            return True, None

        except Exception as e:
            logger.error(f"DAG Manager: Error creating folder: {e}")
            return False, str(e)

    def delete_item(self, mount: str, path: str) -> Tuple[bool, Optional[str], Optional[str]]:
        try:
            root_path = self.get_root_path(mount)
            if not root_path:
                return False, "Invalid mount point", None

            if not self.security.is_path_safe(mount, path):
                return False, "Invalid path", None

            full_path = os.path.join(root_path, path)

            if not os.path.exists(full_path):
                return False, "Item not found", None

            object_type = "folder" if os.path.isdir(full_path) else "file"

            if os.path.isdir(full_path):
                shutil.rmtree(full_path)
            else:
                os.remove(full_path)

            return True, None, object_type

        except Exception as e:
            logger.error(f"DAG Manager: Error deleting item: {e}")
            return False, str(e), None

    def rename_item(
        self, 
        mount: str, 
        old_path: str, 
        new_name: str
    ) -> Tuple[bool, Optional[str], Optional[str], Optional[str]]:
        try:
            root_path = self.get_root_path(mount)
            if not root_path:
                return False, "Invalid mount point", None, None

            if not self.security.is_path_safe(mount, old_path):
                return False, "Недопустимое имя файла/папки", None, None

            full_old_path = os.path.join(root_path, old_path)

            if not os.path.exists(full_old_path):
                return False, "Item not found", None, None

            object_type = "folder" if os.path.isdir(full_old_path) else "file"

            parent_dir = os.path.dirname(old_path)
            new_path = os.path.join(parent_dir, new_name) if parent_dir else new_name

            if not self.security.is_path_safe(mount, new_path):
                return False, "Недопустимое имя файла/папки", None, None

            full_new_path = os.path.join(root_path, new_path)

            if os.path.exists(full_new_path):
                return False, "Файл/папка уже существует", None, None

            os.rename(full_old_path, full_new_path)

            return True, None, object_type, new_path

        except Exception as e:
            logger.error(f"DAG Manager: Error renaming item: {e}")
            return False, str(e), None, None

    def create_zip_archive(self, source_dir: str, output_filename: str) -> str:
        temp_dir = tempfile.gettempdir()
        zip_path = os.path.join(temp_dir, output_filename)

        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(source_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, source_dir)
                    zipf.write(file_path, arcname)

        return zip_path
