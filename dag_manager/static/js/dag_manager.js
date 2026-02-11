// DAG Manager JavaScript

let currentMount = '';
let currentPath = '';
let availableMounts = {};
let itemToRename = null;
let itemToDelete = null;

// Переменные для редактора
let currentEditingFile = null;
let originalFileContent = null;
let isFileModified = false;

// Base URL для API
let baseURL = '';

// ИСПРАВЛЕНИЕ: Обновленные права доступа с разделением
let permissions = {
    can_read: true,
    can_edit: false,
    can_create_file: false,      // РАЗДЕЛЕНО
    can_create_folder: false,    // РАЗДЕЛЕНО
    can_delete: false,            // ТОЛЬКО УДАЛЕНИЕ
    can_rename: false,            // ТОЛЬКО ПЕРЕИМЕНОВАНИЕ
    can_download: false
};

document.addEventListener('DOMContentLoaded', function() {
    // Получаем base URL и права из глобальных переменных
    baseURL = window.DAG_MANAGER_BASE_URL || '/dagmanager';
    permissions = window.DAG_MANAGER_PERMISSIONS || permissions;

    console.log('Base URL:', baseURL);
    console.log('Permissions:', permissions);

    availableMounts = window.DAG_MANAGER_MOUNTS || {};

    const mountKeys = Object.keys(availableMounts);
    if (mountKeys.length === 0) {
        console.error('No mounts available');
        document.getElementById('currentMount').textContent = 'No mounts configured';
        return;
    }

    currentMount = mountKeys[0];
    document.getElementById('currentMount').textContent = currentMount + ' (' + availableMounts[currentMount] + ')';

    if (document.getElementById('mountSelect')) {
        document.getElementById('mountSelect').value = currentMount;
    }

    loadTree();
    loadContents('');
    updateBreadcrumb('');
});

function goHome() {
    currentPath = '';
    loadTree();
    loadContents('');
    updateBreadcrumb('');
}

function changeMount() {
    currentMount = document.getElementById('mountSelect').value;
    document.getElementById('currentMount').textContent = currentMount + ' (' + availableMounts[currentMount] + ')';
    currentPath = '';
    loadTree();
    loadContents('');
    updateBreadcrumb('');
}

function loadTree() {
    const url = `${baseURL}/api/tree?mount=${encodeURIComponent(currentMount)}`;
    console.log('Loading tree from:', url);

    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                renderTree(data.tree);
                expandToCurrentPath();
            }
        })
        .catch(error => {
            console.error('Error loading tree:', error);
            document.getElementById('sidebar').innerHTML = '<div class="loading">Error loading tree</div>';
        });
}

function renderTree(items, container, level = 0) {
    if (!container) {
        container = document.getElementById('sidebar');
        container.innerHTML = '';
    }

    items.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'tree-item';
        itemDiv.dataset.path = item.path;

        const headerDiv = document.createElement('div');
        headerDiv.className = 'tree-item-header';
        if (item.path === currentPath) {
            headerDiv.classList.add('active');
        }

        const toggle = document.createElement('span');
        toggle.className = 'tree-toggle';
        toggle.textContent = item.children && item.children.length > 0 ? '▶' : ' ';

        const icon = document.createElement('span');
        icon.className = 'tree-icon';
        icon.textContent = '📁';

        const name = document.createElement('span');
        name.className = 'tree-name';
        name.textContent = item.name;

        headerDiv.appendChild(toggle);
        headerDiv.appendChild(icon);
        headerDiv.appendChild(name);

        headerDiv.onclick = (e) => {
            e.stopPropagation();
            currentPath = item.path;
            loadContents(item.path);
            updateBreadcrumb(item.path);
            document.querySelectorAll('.tree-item-header').forEach(el => el.classList.remove('active'));
            headerDiv.classList.add('active');
        };

        if (item.children && item.children.length > 0) {
            toggle.onclick = (e) => {
                e.stopPropagation();
                toggleTreeItem(itemDiv, toggle);
            };
        }

        itemDiv.appendChild(headerDiv);

        if (item.children && item.children.length > 0) {
            const childrenDiv = document.createElement('div');
            childrenDiv.className = 'tree-children';
            renderTree(item.children, childrenDiv, level + 1);
            itemDiv.appendChild(childrenDiv);
        }

        container.appendChild(itemDiv);
    });
}

function toggleTreeItem(itemDiv, toggle) {
    const childrenDiv = itemDiv.querySelector('.tree-children');
    if (childrenDiv) {
        if (childrenDiv.classList.contains('expanded')) {
            childrenDiv.classList.remove('expanded');
            toggle.textContent = '▶';
        } else {
            childrenDiv.classList.add('expanded');
            toggle.textContent = '▼';
        }
    }
}

function expandToCurrentPath() {
    if (!currentPath) return;

    const parts = currentPath.split('/');
    let accumulated = '';

    parts.forEach((part, index) => {
        accumulated += (index > 0 ? '/' : '') + part;
        const treeItem = document.querySelector(`.tree-item[data-path="${accumulated}"]`);
        if (treeItem) {
            const childrenDiv = treeItem.querySelector('.tree-children');
            const toggle = treeItem.querySelector('.tree-toggle');

            if (childrenDiv && toggle) {
                childrenDiv.classList.add('expanded');
                toggle.textContent = '▼';
            }

            if (index === parts.length - 1) {
                const header = treeItem.querySelector('.tree-item-header');
                if (header) {
                    document.querySelectorAll('.tree-item-header').forEach(el => el.classList.remove('active'));
                    header.classList.add('active');
                }
            }
        }
    });
}

function loadContents(path) {
    document.getElementById('content').innerHTML = '<div class="loading">Loading...</div>';

    const url = `${baseURL}/api/contents?mount=${encodeURIComponent(currentMount)}&path=${encodeURIComponent(path)}`;
    console.log('Loading contents from:', url);

    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                renderContents(data.folders, data.files);
            }
        })
        .catch(error => {
            console.error('Error loading contents:', error);
            document.getElementById('content').innerHTML = '<div class="empty-state">❌ Error loading contents</div>';
        });
}

function renderContents(folders, files) {
    const content = document.getElementById('content');
    content.innerHTML = '';

    if (folders.length === 0 && files.length === 0) {
        content.innerHTML = '<div class="empty-state">📭 This folder is empty</div>';
        return;
    }

    folders.forEach(folder => {
        const folderDiv = document.createElement('div');
        folderDiv.className = 'folder-list-item';

        const mainInfo = document.createElement('div');
        mainInfo.className = 'file-info-main';
        mainInfo.innerHTML = `
            <span class="folder-icon-large">📁</span>
            <strong>${escapeHtml(folder.name)}</strong>
        `;
        mainInfo.onclick = () => {
            currentPath = folder.path;
            loadContents(folder.path);
            updateBreadcrumb(folder.path);
            expandToCurrentPath();
        };

        const metaDiv = document.createElement('div');
        metaDiv.className = 'file-meta';
        metaDiv.textContent = `Files: ${folder.item_count || 0}`;

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'item-actions';

        // ИСПРАВЛЕНИЕ: Показываем кнопки только если есть соответствующие права
        if (permissions.can_download) {
            const downloadBtn = document.createElement('button');
            downloadBtn.className = 'icon-button download';
            downloadBtn.innerHTML = '⬇️';
            downloadBtn.title = 'Download as ZIP';
            downloadBtn.onclick = (e) => {
                e.stopPropagation();
                downloadItem(folder.path, folder.name);
            };
            actionsDiv.appendChild(downloadBtn);
        }

        // ИСПРАВЛЕНИЕ БАГА 1: Проверяем can_rename отдельно
        if (permissions.can_rename) {
            const renameBtn = document.createElement('button');
            renameBtn.className = 'icon-button rename';
            renameBtn.innerHTML = '✏️';
            renameBtn.title = 'Rename';
            renameBtn.onclick = (e) => {
                e.stopPropagation();
                showRenameModal(folder.path, folder.name);
            };
            actionsDiv.appendChild(renameBtn);
        }

        // ИСПРАВЛЕНИЕ БАГА 1: Проверяем can_delete отдельно
        if (permissions.can_delete) {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'icon-button delete';
            deleteBtn.innerHTML = '🗑️';
            deleteBtn.title = 'Delete';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                confirmDelete(folder.path, folder.name, 'folder');
            };
            actionsDiv.appendChild(deleteBtn);
        }

        folderDiv.appendChild(mainInfo);
        folderDiv.appendChild(metaDiv);
        if (actionsDiv.children.length > 0) {
            folderDiv.appendChild(actionsDiv);
        }

        content.appendChild(folderDiv);
    });

    files.forEach(file => {
        const fileDiv = document.createElement('div');
        fileDiv.className = 'file-list-item';

        const sizeKB = (file.size / 1024).toFixed(2);

        const mainInfo = document.createElement('div');
        mainInfo.className = 'file-info-main';
        mainInfo.innerHTML = `
            <span class="file-icon">📄</span>
            <span>${escapeHtml(file.name)}</span>
        `;
        mainInfo.onclick = () => loadFile(file.path, file.name);

        const metaDiv = document.createElement('div');
        metaDiv.className = 'file-meta';
        metaDiv.textContent = `${sizeKB} KB`;

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'item-actions';

        // ИСПРАВЛЕНИЕ: Показываем кнопки только если есть соответствующие права
        if (permissions.can_download) {
            const downloadBtn = document.createElement('button');
            downloadBtn.className = 'icon-button download';
            downloadBtn.innerHTML = '⬇️';
            downloadBtn.title = 'Download';
            downloadBtn.onclick = (e) => {
                e.stopPropagation();
                downloadItem(file.path, file.name);
            };
            actionsDiv.appendChild(downloadBtn);
        }

        // ИСПРАВЛЕНИЕ БАГА 1: Проверяем can_rename отдельно
        if (permissions.can_rename) {
            const renameBtn = document.createElement('button');
            renameBtn.className = 'icon-button rename';
            renameBtn.innerHTML = '✏️';
            renameBtn.title = 'Rename';
            renameBtn.onclick = (e) => {
                e.stopPropagation();
                showRenameModal(file.path, file.name);
            };
            actionsDiv.appendChild(renameBtn);
        }

        // ИСПРАВЛЕНИЕ БАГА 1: Проверяем can_delete отдельно
        if (permissions.can_delete) {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'icon-button delete';
            deleteBtn.innerHTML = '🗑️';
            deleteBtn.title = 'Delete';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                confirmDelete(file.path, file.name, 'file');
            };
            actionsDiv.appendChild(deleteBtn);
        }

        fileDiv.appendChild(mainInfo);
        fileDiv.appendChild(metaDiv);
        if (actionsDiv.children.length > 0) {
            fileDiv.appendChild(actionsDiv);
        }

        content.appendChild(fileDiv);
    });
}

function updateBreadcrumb(path) {
    const breadcrumb = document.getElementById('breadcrumb');

    const pathDiv = document.createElement('div');
    pathDiv.className = 'breadcrumb-path';

    // Home button
    const homeBtn = document.createElement('button');
    homeBtn.className = 'home-btn';
    homeBtn.innerHTML = '🏠 Home';
    homeBtn.onclick = goHome;
    pathDiv.appendChild(homeBtn);

    if (path) {
        const parts = path.split('/');
        let accumulated = '';

        parts.forEach((part, index) => {
            const separator = document.createElement('span');
            separator.textContent = ' / ';
            pathDiv.appendChild(separator);

            accumulated += (index > 0 ? '/' : '') + part;
            const pathPart = accumulated;

            if (index === parts.length - 1) {
                const current = document.createElement('span');
                current.textContent = part;
                current.style.fontWeight = 'bold';
                pathDiv.appendChild(current);
            } else {
                const link = document.createElement('a');
                link.href = '#';
                link.textContent = part;
                link.onclick = (e) => {
                    e.preventDefault();
                    navigateToPath(pathPart);
                };
                pathDiv.appendChild(link);
            }
        });
    }

    // Action buttons
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'breadcrumb-actions';

    // ИСПРАВЛЕНИЕ БАГА 2: Отдельные кнопки для файлов и папок
    if (permissions.can_create_file) {
        const createFileBtn = document.createElement('button');
        createFileBtn.className = 'action-button';
        createFileBtn.innerHTML = '➕ New File';
        createFileBtn.onclick = showCreateFileModal;
        actionsDiv.appendChild(createFileBtn);
    }

    if (permissions.can_create_folder) {
        const createFolderBtn = document.createElement('button');
        createFolderBtn.className = 'action-button';
        createFolderBtn.innerHTML = '➕ New Folder';
        createFolderBtn.onclick = showCreateFolderModal;
        actionsDiv.appendChild(createFolderBtn);
    }

    breadcrumb.innerHTML = '';
    breadcrumb.appendChild(pathDiv);
    if (actionsDiv.children.length > 0) {
        breadcrumb.appendChild(actionsDiv);
    }
}

function navigateToPath(path) {
    currentPath = path;
    loadContents(path);
    updateBreadcrumb(path);
    expandToCurrentPath();
}

function downloadItem(path, name) {
    const downloadUrl = `${baseURL}/api/download?mount=${encodeURIComponent(currentMount)}&path=${encodeURIComponent(path)}`;

    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Modal functions
function showCreateFileModal() {
    // ИСПРАВЛЕНИЕ: Проверяем права перед показом модального окна
    if (!permissions.can_create_file) {
        showError('У вас нет прав для создания файлов');
        return;
    }
    clearInlineError('fileNameError');
    document.getElementById('createFileModal').classList.add('active');
    document.getElementById('fileNameInput').value = '';
    document.getElementById('fileNameInput').focus();
}

function hideCreateFileModal() {
    document.getElementById('createFileModal').classList.remove('active');
    clearInlineError('fileNameError');
}

function showCreateFolderModal() {
    // ИСПРАВЛЕНИЕ: Проверяем права перед показом модального окна
    if (!permissions.can_create_folder) {
        showError('У вас нет прав для создания папок');
        return;
    }
    clearInlineError('folderNameError');
    document.getElementById('createFolderModal').classList.add('active');
    document.getElementById('folderNameInput').value = '';
    document.getElementById('folderNameInput').focus();
}

function hideCreateFolderModal() {
    document.getElementById('createFolderModal').classList.remove('active');
    clearInlineError('folderNameError');
}

function showRenameModal(path, currentName) {
    // ИСПРАВЛЕНИЕ: Проверяем права
    if (!permissions.can_rename) {
        showError('У вас нет прав для переименования');
        return;
    }
    itemToRename = path;
    clearInlineError('renameError');
    document.getElementById('renameModal').classList.add('active');
    document.getElementById('renameInput').value = currentName;
    document.getElementById('renameInput').focus();
}

function hideRenameModal() {
    document.getElementById('renameModal').classList.remove('active');
    clearInlineError('renameError');
    itemToRename = null;
}

function confirmDelete(path, name, type) {
    // ИСПРАВЛЕНИЕ: Проверяем права
    if (!permissions.can_delete) {
        showError('У вас нет прав для удаления');
        return;
    }
    itemToDelete = {path, name, type};
    document.getElementById('deleteMessage').textContent = `Are you sure you want to delete this ${type}: "${name}"?`;
    document.getElementById('confirmDeleteModal').classList.add('active');
}

function hideConfirmDeleteModal() {
    document.getElementById('confirmDeleteModal').classList.remove('active');
    itemToDelete = null;
}

function showError(message) {
    document.getElementById('errorMessage').textContent = message;
    document.getElementById('errorModal').classList.add('active');
}

function hideErrorModal() {
    document.getElementById('errorModal').classList.remove('active');
}

function showSuccess(message) {
    document.getElementById('successMessage').textContent = message;
    document.getElementById('successModal').classList.add('active');
}

function hideSuccessModal() {
    document.getElementById('successModal').classList.remove('active');
}

function showInlineError(errorElementId, message) {
    const errorElement = document.getElementById(errorElementId);
    errorElement.textContent = message;
    errorElement.classList.add('visible');
}

function clearInlineError(errorElementId) {
    const errorElement = document.getElementById(errorElementId);
    errorElement.textContent = '';
    errorElement.classList.remove('visible');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Функции для создания файла и папки
function createFile() {
    const fileName = document.getElementById('fileNameInput').value.trim();

    if (!fileName) {
        showInlineError('fileNameError', 'Имя файла не может быть пустым');
        return;
    }

    const data = {
        mount: currentMount,
        path: currentPath,
        name: fileName
    };

    fetch(`${baseURL}/api/create_file`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            hideCreateFileModal();
            showSuccess('Файл успешно создан');
            loadContents(currentPath);
            loadTree();
        } else {
            showInlineError('fileNameError', data.error || 'Ошибка при создании файла');
        }
    })
    .catch(error => {
        console.error('Error creating file:', error);
        showInlineError('fileNameError', 'Ошибка при создании файла');
    });
}

function createFolder() {
    const folderName = document.getElementById('folderNameInput').value.trim();

    if (!folderName) {
        showInlineError('folderNameError', 'Имя папки не может быть пустым');
        return;
    }

    const data = {
        mount: currentMount,
        path: currentPath,
        name: folderName
    };

    fetch(`${baseURL}/api/create_folder`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            hideCreateFolderModal();
            showSuccess('Папка успешно создана');
            loadContents(currentPath);
            loadTree();
        } else {
            showInlineError('folderNameError', data.error || 'Ошибка при создании папки');
        }
    })
    .catch(error => {
        console.error('Error creating folder:', error);
        showInlineError('folderNameError', 'Ошибка при создании папки');
    });
}

function confirmRename() {
    const newName = document.getElementById('renameInput').value.trim();

    if (!newName) {
        showInlineError('renameError', 'Имя не может быть пустым');
        return;
    }

    const data = {
        mount: currentMount,
        path: itemToRename,
        new_name: newName
    };

    fetch(`${baseURL}/api/rename`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            hideRenameModal();
            showSuccess('Элемент успешно переименован');
            loadContents(currentPath);
            loadTree();
        } else {
            showInlineError('renameError', data.error || 'Ошибка при переименовании');
        }
    })
    .catch(error => {
        console.error('Error renaming item:', error);
        showInlineError('renameError', 'Ошибка при переименовании');
    });
}

function deleteItem() {
    if (!itemToDelete) return;

    const data = {
        mount: currentMount,
        path: itemToDelete.path
    };

    fetch(`${baseURL}/api/delete`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            hideConfirmDeleteModal();
            showSuccess('Элемент успешно удален');
            loadContents(currentPath);
            loadTree();
        } else {
            hideConfirmDeleteModal();
            showError(data.error || 'Ошибка при удалении');
        }
    })
    .catch(error => {
        console.error('Error deleting item:', error);
        hideConfirmDeleteModal();
        showError('Ошибка при удалении');
    });
}

function loadFile(path, name) {
    document.getElementById('content').innerHTML = '<div class="loading">Loading file...</div>';

    const url = `${baseURL}/api/file?mount=${encodeURIComponent(currentMount)}&path=${encodeURIComponent(path)}`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                renderFileEditor(path, name, data.content);
            } else {
                document.getElementById('content').innerHTML = `<div class="empty-state">❌ Error loading file: ${data.error}</div>`;
            }
        })
        .catch(error => {
            console.error('Error loading file:', error);
            document.getElementById('content').innerHTML = '<div class="empty-state">❌ Error loading file</div>';
        });
}

function renderFileEditor(path, name, content) {
    const contentDiv = document.getElementById('content');
    contentDiv.innerHTML = '';

    const container = document.createElement('div');
    container.className = 'file-editor-container';

    // Header
    const header = document.createElement('div');
    header.className = 'editor-header';

    const titleDiv = document.createElement('div');
    titleDiv.className = 'editor-title';
    titleDiv.innerHTML = `<h4>📄 ${escapeHtml(name)}</h4>`;

    const statusDiv = document.createElement('div');
    statusDiv.className = 'editor-status';
    statusDiv.id = 'editorStatus';
    statusDiv.textContent = permissions.can_edit ? 'Ready' : 'Read-only';

    header.appendChild(titleDiv);
    header.appendChild(statusDiv);

    // Editor
    const editor = document.createElement('textarea');
    editor.className = 'code-editor';
    editor.id = 'codeEditor';
    editor.value = content;

    if (!permissions.can_edit) {
        editor.readOnly = true;
        editor.classList.add('readonly');
    }

    originalFileContent = content;
    currentEditingFile = path;
    isFileModified = false;

    editor.oninput = () => {
        isFileModified = editor.value !== originalFileContent;
        const status = document.getElementById('editorStatus');
        if (isFileModified) {
            status.textContent = 'Modified';
            status.classList.add('modified');
        } else {
            status.textContent = 'Ready';
            status.classList.remove('modified');
        }
    };

    // Footer
    const footer = document.createElement('div');
    footer.className = 'editor-footer';

    const info = document.createElement('div');
    info.className = 'editor-info';
    info.textContent = `Path: ${path}`;

    const actions = document.createElement('div');
    actions.className = 'editor-actions';

    if (permissions.can_edit) {
        const saveBtn = document.createElement('button');
        saveBtn.className = 'editor-button save';
        saveBtn.textContent = '💾 Save';
        saveBtn.id = 'saveBtn';
        saveBtn.disabled = true;
        saveBtn.onclick = saveFile;
        actions.appendChild(saveBtn);

        editor.oninput = () => {
            isFileModified = editor.value !== originalFileContent;
            const status = document.getElementById('editorStatus');
            const saveButton = document.getElementById('saveBtn');

            if (isFileModified) {
                status.textContent = 'Modified';
                status.classList.add('modified');
                saveButton.disabled = false;
            } else {
                status.textContent = 'Ready';
                status.classList.remove('modified');
                saveButton.disabled = true;
            }
        };
    }

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'editor-button cancel';
    cancelBtn.textContent = '← Back';
    cancelBtn.onclick = () => {
        if (isFileModified && permissions.can_edit) {
            if (confirm('У вас есть несохраненные изменения. Закрыть редактор?')) {
                loadContents(currentPath);
            }
        } else {
            loadContents(currentPath);
        }
    };
    actions.appendChild(cancelBtn);

    footer.appendChild(info);
    footer.appendChild(actions);

    container.appendChild(header);
    container.appendChild(editor);
    container.appendChild(footer);

    contentDiv.appendChild(container);
}

function saveFile() {
    if (!permissions.can_edit) {
        showError('У вас нет прав для редактирования файлов');
        return;
    }

    const editor = document.getElementById('codeEditor');
    const content = editor.value;

    const data = {
        mount: currentMount,
        path: currentEditingFile,
        content: content
    };

    fetch(`${baseURL}/api/save_file`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showSuccess('Файл успешно сохранен');
            originalFileContent = content;
            isFileModified = false;

            const status = document.getElementById('editorStatus');
            status.textContent = 'Saved';
            status.classList.remove('modified');

            const saveBtn = document.getElementById('saveBtn');
            if (saveBtn) {
                saveBtn.disabled = true;
            }

            setTimeout(() => {
                status.textContent = 'Ready';
            }, 2000);
        } else {
            showError(data.error || 'Ошибка при сохранении файла');
        }
    })
    .catch(error => {
        console.error('Error saving file:', error);
        showError('Ошибка при сохранении файла');
    });
}
