import os
import logging
from typing import Dict

from flask import request, jsonify, send_file
from flask_appbuilder import BaseView, expose, has_access
from airflow.configuration import conf
from airflow.www.decorators import action_logging

from dag_manager.security import SecurityValidator, PermissionManager
from dag_manager.file_operations import FileSystemOperations
from dag_manager.audit_log import audit_logger

logger = logging.getLogger(__name__)


class DagManagerView(BaseView):

    default_view = "index"
    route_base = "/dagmanager"
    template_folder = os.path.join(os.path.dirname(__file__), "templates")

    def __init__(self):
        super().__init__()
        self.mounts = self._get_mounts()
        self.security = SecurityValidator(self.mounts)
        self.file_ops = FileSystemOperations(self.mounts, self.security)
        logger.info(f"DAG Manager: DAG Manager initialized with mounts: {self.mounts}")

    def _get_mounts(self) -> Dict[str, str]:
        mounts = {}

        try:
            if conf.has_section("dag_manager"):
                for key, value in conf.items("dag_manager"):
                    if key.startswith("mount"):
                        mount_name = key
                        mounts[mount_name] = os.path.abspath(value)
                        logger.info(f"Added mount point: {mount_name} -> {value}")
        except Exception as e:
            logger.debug(f"DAG Manager: No custom mount points in config: {e}")

        if not mounts:
            dags_folder = conf.get("core", "dags_folder")
            mounts["dags"] = os.path.abspath(dags_folder)
            logger.info(f"DAG Manager: Using default DAGs folder: {dags_folder}")

        return mounts


    @expose("/")
    @has_access
    @action_logging
    def index(self):
        username = PermissionManager.get_current_username()
        logger.info(f"DAG Manager: User '{username}' opened DAG File Browser")
        permissions = PermissionManager.get_user_permissions()

        return self.render_template(
            "file_browser.html",
            mounts=self.mounts,
            permissions=permissions
        )

    @expose("/api/mounts")
    @has_access
    def api_mounts(self):
        return jsonify({
            "mounts": [{"name": k, "path": v} for k, v in self.mounts.items()],
            "success": True
        })

    @expose("/api/tree")
    @has_access
    def api_tree(self):
        mount = request.args.get("mount", list(self.mounts.keys())[0])
        path = request.args.get("path", "")

        tree = self.file_ops.get_directory_tree_recursive(mount, path, depth=0, max_depth=10)

        return jsonify({
            "tree": tree,
            "mount": mount,
            "success": True
        })

    @expose("/api/contents")
    @has_access
    def api_contents(self):
        mount = request.args.get("mount", list(self.mounts.keys())[0])
        path = request.args.get("path", "")

        folders, files = self.file_ops.get_directory_contents(mount, path)

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
        try:
            mount = request.args.get("mount", list(self.mounts.keys())[0])
            path = request.args.get("path", "")
            username = PermissionManager.get_current_username()

            logger.info(f"DAG Manager: User '{username}' reading file: mount={mount}, path={path}")

            content = self.file_ops.read_file(mount, path)

            if content is None:
                logger.error(f"DAG Manager: User '{username}' failed to read file: {path}")
                return jsonify({"error": "File not found or cannot be read", "success": False}), 404

            return jsonify({
                "content": content,
                "path": path,
                "mount": mount,
                "success": True
            })

        except Exception as e:
            logger.error(f"DAG Manager: Exception in api_file: {e}", exc_info=True)
            return jsonify({"error": str(e), "success": False}), 500

    @expose("/api/download")
    @has_access
    @action_logging
    def api_download(self):
        username = PermissionManager.get_current_username()

        try:
            mount = request.args.get("mount")
            path = request.args.get("path", "")

            root_path = self.file_ops.get_root_path(mount)
            if not root_path:
                return jsonify({"error": "Invalid mount point", "success": False}), 400

            if not self.security.is_path_safe(mount, path):
                logger.warning(f"DAG Manager: User '{username}' attempted unsafe download: {path}")
                audit_logger.log_security_event(
                    username=username,
                    event_type='PATH_TRAVERSAL_ATTEMPT',
                    details=f'Attempted to download: {path}'
                )
                return jsonify({"error": "Invalid path", "success": False}), 400

            full_path = os.path.join(root_path, path)

            if not os.path.exists(full_path):
                return jsonify({"error": "Item not found", "success": False}), 404

            if os.path.isfile(full_path):
                filename = os.path.basename(full_path)
                logger.info(f"DAG Manager: User '{username}' downloading file: mount={mount}, path={path}")
                audit_logger.log_action(username, "DOWNLOAD", path, "SUCCESS", mount)
                return send_file(full_path, as_attachment=True, download_name=filename)

            elif os.path.isdir(full_path):
                folder_name = os.path.basename(full_path) or "archive"
                zip_filename = f"{folder_name}.zip"
                zip_path = self.file_ops.create_zip_archive(full_path, zip_filename)

                logger.info(f"DAG Manager: User '{username}' downloading folder as ZIP: mount={mount}, path={path}")
                audit_logger.log_action(username, "DOWNLOAD", path, "SUCCESS", mount)

                return send_file(
                    zip_path,
                    as_attachment=True,
                    download_name=zip_filename,
                    mimetype='application/zip'
                )

            else:
                return jsonify({"error": "Invalid item type", "success": False}), 400

        except Exception as e:
            logger.error(f"DAG Manager: User '{username}' error downloading item: {e}")
            audit_logger.log_action(username, "DOWNLOAD", path, e, mount)
            return jsonify({"error": str(e), "success": False}), 500


    @expose("/api/create_folder", methods=["POST"])
    @has_access
    @action_logging
    def api_create_folder(self):
        username = PermissionManager.get_current_username()

        try:
            data = request.get_json()
            mount = data.get("mount")
            parent_path = data.get("path", "")
            folder_name = data.get("name", "").strip()

            if not folder_name:
                return jsonify({"error": "Недопустимое имя папки", "success": False}), 400

            if not self.security.is_filename_safe(folder_name):
                return jsonify({"error": "Недопустимое имя папки", "success": False}), 400

            new_folder_path = os.path.join(parent_path, folder_name)

            if not self.security.is_path_safe(mount, new_folder_path):
                logger.warning(f"DAG Manager: User '{username}' attempted unsafe folder creation: {new_folder_path}")
                audit_logger.log_security_event(
                    username=username,
                    event_type='PATH_TRAVERSAL_ATTEMPT',
                    details=f'Attempted to create folder: {new_folder_path}'
                )
                return jsonify({"error": "Invalid path", "success": False}), 400

            success, error = self.file_ops.create_folder(mount, parent_path, folder_name)

            if success:
                logger.info(f"DAG Manager: User '{username}' created folder: mount={mount}, path={new_folder_path}")
                audit_logger.log_action(username, "CREATE FOLDER", new_folder_path, "SUCCESS", mount)
                return jsonify({"success": True, "message": "Папка создана"})
            else:
                audit_logger.log_action(username, "CREATE FOLDER", new_folder_path, error, mount)
                return jsonify({"error": error, "success": False}), 500

        except Exception as e:
            logger.error(f"DAG Manager: User '{username}' error creating folder: {e}")
            audit_logger.log_action(username, "CREATE FOLDER", new_folder_path, e, mount)
            return jsonify({"error": str(e), "success": False}), 500

    @expose("/api/create_file", methods=["POST"])
    @has_access
    @action_logging
    def api_create_file(self):
        username = PermissionManager.get_current_username()

        try:
            data = request.get_json()
            mount = data.get("mount")
            parent_path = data.get("path", "")
            file_name = data.get("name", "").strip()

            if not file_name:
                return jsonify({"error": "Недопустимое имя файла", "success": False}), 400

            if not self.security.is_filename_safe(file_name):
                return jsonify({"error": "Недопустимое имя файла", "success": False}), 400

            new_file_path = os.path.join(parent_path, file_name)

            if not self.security.is_path_safe(mount, new_file_path):
                logger.warning(f"DAG Manager: User '{username}' attempted unsafe file creation: {new_file_path}")
                audit_logger.log_security_event(
                    username=username,
                    event_type='PATH_TRAVERSAL_ATTEMPT',
                    details=f'Attempted to create file: {new_file_path}'
                )
                return jsonify({"error": "Invalid path", "success": False}), 400

            success, error = self.file_ops.create_file(mount, parent_path, file_name)

            if success:
                logger.info(f"DAG Manager: User '{username}' created file: mount={mount}, path={new_file_path}")
                audit_logger.log_action(username, "CREATE FILE", new_file_path, "SUCCESS", mount)
                return jsonify({"success": True, "message": "Файл создан"})
            else:
                audit_logger.log_action(username, "CREATE FILE", new_file_path, error, mount)
                return jsonify({"error": error, "success": False}), 500

        except Exception as e:
            logger.error(f"DAG Manager: User '{username}' error creating file: {e}")
            audit_logger.log_action(username, "CREATE FILE", new_file_path, e, mount)
            return jsonify({"error": str(e), "success": False}), 500

    @expose("/api/delete", methods=["POST"])
    @has_access
    @action_logging
    def api_delete(self):
        username = PermissionManager.get_current_username()

        try:
            data = request.get_json()
            mount = data.get("mount")
            item_path = data.get("path", "")

            if not item_path:
                return jsonify({"error": "Path is required", "success": False}), 400

            if not self.security.is_path_safe(mount, item_path):
                logger.warning(f"DAG Manager: User '{username}' attempted unsafe deletion: {item_path}")
                audit_logger.log_security_event(
                    username=username,
                    event_type='PATH_TRAVERSAL_ATTEMPT',
                    details=f'Attempted to delete: {item_path}'
                )
                return jsonify({"error": "Invalid path", "success": False}), 400

            success, error, object_type = self.file_ops.delete_item(mount, item_path)

            if success:
                logger.info(f"DAG Manager: User '{username}' deleted {object_type}: mount={mount}, path={item_path}")
                audit_logger.log_action(username, "DELETE", item_path, "SUCCESS", mount)
                return jsonify({"success": True, "message": "Элемент удален"})
            else:
                audit_logger.log_action(username, "DELETE", item_path, error, mount)
                return jsonify({"error": error, "success": False}), 500

        except Exception as e:
            logger.error(f"DAG Manager: User '{username}' error deleting item: {e}")
            audit_logger.log_action(username, "DELETE", item_path, e, mount)
            return jsonify({"error": str(e), "success": False}), 500

    @expose("/api/rename", methods=["POST"])
    @has_access
    @action_logging
    def api_rename(self):
        username = PermissionManager.get_current_username()

        try:
            data = request.get_json()
            mount = data.get("mount")
            old_path = data.get("path", "")
            new_name = data.get("new_name", "").strip()

            if not old_path or not new_name:
                return jsonify({"error": "Недопустимое имя файла/папки", "success": False}), 400

            if not self.security.is_filename_safe(new_name):
                return jsonify({"error": "Недопустимое имя файла/папки", "success": False}), 400

            success, error, object_type, new_path = self.file_ops.rename_item(mount, old_path, new_name)

            if success:
                logger.info(f"DAG Manager: User '{username}' renamed {object_type}: mount={mount}, old_path={old_path}, new_path={new_path}")
                audit_logger.log_action(username, "RENAME", old_path, new_path, mount)
                return jsonify({"success": True, "message": "Элемент переименован", "new_path": new_path})
            else:
                audit_logger.log_action(username, "RENAME", old_path, error, mount)
                return jsonify({"error": error, "success": False}), 500

        except Exception as e:
            logger.error(f"DAG Manager: User '{username}' error renaming item: {e}")
            audit_logger.log_action(username, "RENAME", old_path, e, mount)
            return jsonify({"error": str(e), "success": False}), 500

    @expose("/api/save_file", methods=["POST"])
    @has_access
    @action_logging
    def api_save_file(self):
        username = PermissionManager.get_current_username()

        try:
            data = request.get_json()
            mount = data.get("mount")
            path = data.get("path", "")
            content = data.get("content", "")

            if not path:
                return jsonify({"error": "Path is required", "success": False}), 400

            # Validate file size
            is_valid, error_msg = self.security.validate_file_size(content)
            if not is_valid:
                logger.warning(f"DAG Manager: User '{username}' attempted to save large file: {path}")
                audit_logger.log_security_event(
                    username=username,
                    event_type='FILE_SIZE_EXCEEDED',
                    details=f'Attempted to save {len(content)} bytes: {path}'
                )
                return jsonify({"error": error_msg, "success": False}), 413

            if not self.security.is_path_safe(mount, path):
                logger.warning(f"DAG Manager: User '{username}' attempted unsafe file save: {path}")
                audit_logger.log_security_event(
                    username=username,
                    event_type='PATH_TRAVERSAL_ATTEMPT',
                    details=f'Attempted to save file: {path}'
                )
                return jsonify({"error": "Invalid path", "success": False}), 400

            success, error = self.file_ops.write_file(mount, path, content)

            if success:
                logger.info(f"DAG Manager: User '{username}' modified file: mount={mount}, path={path} ({len(content)} chars)")
                audit_logger.log_action(username, "MODIFY", path, "SUCCESS", mount)
                return jsonify({
                    "success": True,
                    "message": "File saved successfully",
                    "path": path
                })
            else:
                audit_logger.log_action(username, "MODIFY", path, error, mount)
                return jsonify({"error": error, "success": False}), 500

        except Exception as e:
            logger.error(f"DAG Manager: User '{username}' error saving file: {e}", exc_info=True)
            audit_logger.log_action(username, "MODIFY", path, e, mount)
            return jsonify({"error": str(e), "success": False}), 500
