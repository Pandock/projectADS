import os
import re
import logging
from typing import Dict, Optional
from flask_login import current_user

logger = logging.getLogger(__name__)

# Регулярка для безопасных имен файлов
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

MAX_FILE_SIZE = 10 * 1024 * 1024


class SecurityValidator:

    def __init__(self, mounts: Dict[str, str]):
        self.mounts = mounts

    def is_path_safe(self, mount: str, requested_path: str) -> bool:
        root_path = self.mounts.get(mount)
        if not root_path:
            return False

        try:
            requested_absolute = os.path.abspath(os.path.join(root_path, requested_path))
            is_safe = requested_absolute.startswith(root_path)

            if not is_safe:
                logger.warning(
                    f"DAG Manager: Path traversal attempt detected: mount={mount}, "
                    f"DAG Manager: path={requested_path}, resolved={requested_absolute}"
                )

            return is_safe

        except Exception as e:
            logger.warning(f"DAG Manager: Path validation failed: {e}")
            return False

    def is_filename_safe(self, filename: str) -> bool:

        if not filename or len(filename) > 100:
            return False

        if not filename or filename in ['.', '..']:
            return False

        if '/' in filename or '\\' in filename or '\x00' in filename:
            return False

        if not SAFE_FILENAME_REGEX.match(filename):
            return False

        return True

    def should_skip_item(self, name: str) -> bool:
        if name.startswith('.'):
            return True

        if name in HIDDEN_ITEMS:
            return True

        if any(name.endswith(ext) for ext in ['.pyc', '.pyo', '.pyd']):
            return True

        return False

    def validate_file_size(self, content: str) -> tuple[bool, Optional[str]]:
        content_size = len(content.encode('utf-8'))

        if content_size > MAX_FILE_SIZE:
            error_msg = f"File too large. Max size: {MAX_FILE_SIZE} bytes ({MAX_FILE_SIZE / 1024 / 1024:.1f} MB)"
            return False, error_msg

        return True, None


class PermissionManager:

    @staticmethod
    def get_current_username() -> str:
        try:
            if hasattr(current_user, 'username'):
                return current_user.username
            elif hasattr(current_user, 'email'):
                return current_user.email
            else:
                return "unknown"
        except Exception:
            return "unknown"

    @staticmethod
    def get_user_permissions() -> Dict[str, bool]:
        username = PermissionManager.get_current_username()

        permissions = {
            'can_read': False,
            'can_edit': False,
            'can_create_file': False,
            'can_create_folder': False,
            'can_delete': False,
            'can_rename': False,
            'can_download': False
        }

        try:
            if hasattr(current_user, 'perms'):
                user_perms = current_user.perms if current_user.perms else []

                permissions['can_read'] = any(
                    'can_read' in str(p).lower() or 'menu access' in str(p).lower() 
                    for p in user_perms
                )
                permissions['can_edit'] = any('api_save_file' in str(p) for p in user_perms)
                permissions['can_create_file'] = any('api_create_file' in str(p) for p in user_perms)
                permissions['can_create_folder'] = any('api_create_folder' in str(p) for p in user_perms)
                permissions['can_delete'] = any('api_delete' in str(p) for p in user_perms)
                permissions['can_rename'] = any('api_rename' in str(p) for p in user_perms)
                permissions['can_download'] = any('api_download' in str(p) for p in user_perms)

                if any('DagManagerView' in str(p) or 'dag_manager' in str(p).lower() for p in user_perms):
                    permissions['can_read'] = True

                logger.info(f"DAG Manager: User '{username}' permissions: {permissions}")

        except Exception as e:
            logger.error(f"DAG Manager: Error checking permissions for user '{username}': {e}")
            permissions['can_read'] = True

        return permissions
