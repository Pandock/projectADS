let currentMount;
let currentPath = '';
let availableMounts = {};
let permissions = {
    can_read: true,
    can_edit: false,
    can_create_file: false,
    can_create_folder: false,
    can_delete: false,
    can_rename: false,
    can_download: false
};

let currentEditingFile = null;
let originalFileContent = null;
let isFileModified = false;

let itemToRename = null;
let itemToDelete = null;


document.addEventListener('DOMContentLoaded', function() {
    console.log('DAG Manager initializing...');

    if (typeof initializeCSRFToken === 'function') {
        initializeCSRFToken();
    } else {
        console.error('initializeCSRFToken is not defined! Check csrf.js loading.');
    }

    const baseURL = window.DAG_MANAGER_BASE_URL || '/dagmanager';
    if (typeof initializeAPIClient === 'function') {
        initializeAPIClient(baseURL);
    } else {
        console.error('initializeAPIClient is not defined! Check api_client.js loading.');
    }

    permissions = window.DAG_MANAGER_PERMISSIONS || permissions;
    console.log('Permissions:', permissions);

    availableMounts = window.DAG_MANAGER_MOUNTS || {};
    const mountKeys = Object.keys(availableMounts);

    if (mountKeys.length === 0) {
        console.error('No mounts available');
        const mountEl = document.getElementById('currentMount');
        if (mountEl) {
            mountEl.textContent = 'No mounts configured';
        }
        return;
    }

    currentMount = mountKeys[0];
    const mountEl = document.getElementById('currentMount');
    if (mountEl) {
        mountEl.textContent = `${currentMount}: ${availableMounts[currentMount]}`;
    }

    const mountSelect = document.getElementById('mountSelect');
    if (mountSelect) {
        mountSelect.value = currentMount;
    }

    loadTree();
    loadContents();
    updateBreadcrumb();

    console.log('DAG Manager initialized successfully');
});


function goHome() {
    currentPath = '';
    loadTree();
    loadContents();
    updateBreadcrumb();
}

function changeMount() {
    const mountSelect = document.getElementById('mountSelect');
    if (!mountSelect) return;

    currentMount = mountSelect.value;
    const mountEl = document.getElementById('currentMount');
    if (mountEl) {
        mountEl.textContent = `${currentMount}: ${availableMounts[currentMount]}`;
    }

    currentPath = '';
    loadTree();
    loadContents();
    updateBreadcrumb();
}

function navigateToPath(path) {
    currentPath = path;
    loadContents(path);
    updateBreadcrumb(path);
    expandToCurrentPath();
}


async function loadTree() {
    try {
        const data = await getTree(currentMount);
        if (data.success) {
            renderTree(data.tree);
            expandToCurrentPath();
        }
    } catch (error) {
        console.error('Error loading tree:', error);
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.innerHTML = '<div class="loading-error">❌ Error loading tree</div>';
        }
    }
}

function renderTree(items, container, level = 0) {
    if (!container) {
        container = document.getElementById('sidebar');
    }
    if (!container) return;

    container.innerHTML = '';

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
        toggle.textContent = (item.children && item.children.length > 0) ? '▶' : '';

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
            navigateToPath(item.path);
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


async function loadContents(path) {
    const content = document.getElementById('content');
    if (!content) return;

    content.innerHTML = '<div class="loading">⏳ Loading...</div>';

    try {
        const data = await getContents(currentMount, path);
        if (data.success) {
            renderContents(data.folders, data.files);
        }
    } catch (error) {
        console.error('Error loading contents:', error);
        content.innerHTML = '<div class="empty-state">❌ Error loading content</div>';
    }
}

function renderContents(folders, files) {
    const content = document.getElementById('content');
    if (!content) return;

    content.innerHTML = '';

    if (folders.length === 0 && files.length === 0) {
        content.innerHTML = '<div class="empty-state">📭 This folder is empty</div>';
        return;
    }

    folders.forEach(folder => {
        const folderDiv = document.createElement('div');
        folderDiv.className = 'folder-list-item';

        folderDiv.onclick = (e) => {
            if (e.target.closest('.item-actions')) {
                return;
            }
            navigateToPath(folder.path);
        };

        const mainInfo = document.createElement('div');
        mainInfo.className = 'file-info-main';
        mainInfo.innerHTML = `<span class="folder-icon-large">📁</span> <strong>${escapeHtml(folder.name)}</strong>`;

        const metaDiv = document.createElement('div');
        metaDiv.className = 'file-meta';
        metaDiv.textContent = `Files: ${folder.item_count || 0}`;

        const actionsDiv = createItemActions(folder.path, folder.name, 'folder');

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

        fileDiv.onclick = (e) => {
            if (e.target.closest('.item-actions')) {
                return;
            }
            loadFile(file.path, file.name);
        };

        const sizeKB = (file.size / 1024).toFixed(2);

        const mainInfo = document.createElement('div');
        mainInfo.className = 'file-info-main';
        mainInfo.innerHTML = `<span class="file-icon">📄</span> <span>${escapeHtml(file.name)}</span>`;

        const metaDiv = document.createElement('div');
        metaDiv.className = 'file-meta';
        metaDiv.textContent = `${sizeKB} KB`;

        const actionsDiv = createItemActions(file.path, file.name, 'file');

        fileDiv.appendChild(mainInfo);
        fileDiv.appendChild(metaDiv);
        if (actionsDiv.children.length > 0) {
            fileDiv.appendChild(actionsDiv);
        }

        content.appendChild(fileDiv);
    });
}

function createItemActions(path, name, type) {
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'item-actions';

    if (permissions.can_download) {
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'icon-button download';
        downloadBtn.innerHTML = '⬇️';
        downloadBtn.title = type === 'folder' ? 'Download as ZIP' : 'Download';
        downloadBtn.onclick = (e) => {
            e.stopPropagation();
            downloadItem(path, name);
        };
        actionsDiv.appendChild(downloadBtn);
    }

    if (permissions.can_rename) {
        const renameBtn = document.createElement('button');
        renameBtn.className = 'icon-button rename';
        renameBtn.innerHTML = '✏️';
        renameBtn.title = 'Rename';
        renameBtn.onclick = (e) => {
            e.stopPropagation();
            showRenameModal(path, name);
        };
        actionsDiv.appendChild(renameBtn);
    }

    if (permissions.can_delete) {
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'icon-button delete';
        deleteBtn.innerHTML = '🗑️';
        deleteBtn.title = 'Delete';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            confirmDeleteAction(path, name, type);
        };
        actionsDiv.appendChild(deleteBtn);
    }

    return actionsDiv;
}

function updateBreadcrumb(path) {
    const breadcrumb = document.getElementById('breadcrumb');
    if (!breadcrumb) return;

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
            separator.textContent = '/';
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

    if (permissions.can_create_file) {
        const createFileBtn = document.createElement('button');
        createFileBtn.className = 'action-button';
        createFileBtn.innerHTML = '📄 New File';
        createFileBtn.onclick = showCreateFileModal;
        actionsDiv.appendChild(createFileBtn);
    }

    if (permissions.can_create_folder) {
        const createFolderBtn = document.createElement('button');
        createFolderBtn.className = 'action-button';
        createFolderBtn.innerHTML = '📁 New Folder';
        createFolderBtn.onclick = showCreateFolderModal;
        actionsDiv.appendChild(createFolderBtn);
    }

    breadcrumb.innerHTML = '';
    breadcrumb.appendChild(pathDiv);
    if (actionsDiv.children.length > 0) {
        breadcrumb.appendChild(actionsDiv);
    }
}

function downloadItem(path, name) {
    const downloadUrl = getDownloadURL(currentMount, path);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}


async function loadFile(path, name) {
    const content = document.getElementById('content');
    if (!content) return;

    content.innerHTML = '<div class="loading">⏳ Loading file...</div>';

    try {
        const data = await getFile(currentMount, path);
        if (data.success) {
            renderFileEditor(path, name, data.content);
        } else {
            content.innerHTML = `<div class="empty-state">❌ Error loading file: ${data.error}</div>`;
        }
    } catch (error) {
        console.error('Error loading file:', error);
        content.innerHTML = '<div class="empty-state">❌ Error loading file</div>';
    }
}

function renderFileEditor(path, name, content) {
    const contentDiv = document.getElementById('content');
    if (!contentDiv) return;

    contentDiv.innerHTML = '';

    const container = document.createElement('div');
    container.className = 'file-editor-container';

    const header = document.createElement('div');
    header.className = 'editor-header';

    const titleDiv = document.createElement('div');
    titleDiv.className = 'editor-title';
    titleDiv.innerHTML = `<h4>📝 ${escapeHtml(name)}</h4>`;

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
        const saveButton = document.getElementById('saveBtn');

        if (isFileModified) {
            if (status) {
                status.textContent = 'Modified';
                status.classList.add('modified');
            }
            if (saveButton) saveButton.disabled = false;
        } else {
            if (status) {
                status.textContent = 'Ready';
                status.classList.remove('modified');
            }
            if (saveButton) saveButton.disabled = true;
        }
    };

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
        saveBtn.onclick = handleSaveFile;
        actions.appendChild(saveBtn);
    }

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'editor-button cancel';
    cancelBtn.textContent = '◀ Back';
    cancelBtn.onclick = () => {
        if (isFileModified && permissions.can_edit) {
            if (confirm('У вас есть несохраненные изменения. Вы уверены, что хотите выйти?')) {
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

async function handleSaveFile() {
    if (!permissions.can_edit) {
        showError('У вас нет прав для редактирования файлов');
        return;
    }

    const editor = document.getElementById('codeEditor');
    if (!editor) return;

    const content = editor.value;

    try {
        const data = await apiSaveFile(currentMount, currentEditingFile, content);

        if (data.success) {
            showSuccess('Файл сохранен успешно');
            originalFileContent = content;
            isFileModified = false;

            const status = document.getElementById('editorStatus');
            if (status) {
                status.textContent = 'Saved ✓';
                status.classList.remove('modified');
            }

            const saveBtn = document.getElementById('saveBtn');
            if (saveBtn) saveBtn.disabled = true;

            setTimeout(() => {
                if (status) {
                    status.textContent = 'Ready';
                }
            }, 2000);
        } else {
            showError(data.error || 'Ошибка при сохранении файла');
        }
    } catch (error) {
        console.error('Error saving file:', error);
        showError('Ошибка при сохранении файла');
    }
}


function showCreateFileModal() {
    if (!permissions.can_create_file) {
        showError('У вас нет прав для создания файлов');
        return;
    }

    clearInlineError('fileNameError');
    const modal = document.getElementById('createFileModal');
    const input = document.getElementById('fileNameInput');
    if (modal) modal.classList.add('active');
    if (input) {
        input.value = '';
        input.focus();
    }
}

function hideCreateFileModal() {
    const modal = document.getElementById('createFileModal');
    if (modal) modal.classList.remove('active');
    clearInlineError('fileNameError');
}

function showCreateFolderModal() {
    if (!permissions.can_create_folder) {
        showError('У вас нет прав для создания папок');
        return;
    }

    clearInlineError('folderNameError');
    const modal = document.getElementById('createFolderModal');
    const input = document.getElementById('folderNameInput');
    if (modal) modal.classList.add('active');
    if (input) {
        input.value = '';
        input.focus();
    }
}

function hideCreateFolderModal() {
    const modal = document.getElementById('createFolderModal');
    if (modal) modal.classList.remove('active');
    clearInlineError('folderNameError');
}

function showRenameModal(path, currentName) {
    if (!permissions.can_rename) {
        showError('У вас нет прав для переименования');
        return;
    }

    itemToRename = path;
    clearInlineError('renameError');

    const modal = document.getElementById('renameModal');
    const input = document.getElementById('renameInput');
    if (modal) modal.classList.add('active');
    if (input) {
        input.value = currentName;
        input.focus();
    }
}

function hideRenameModal() {
    const modal = document.getElementById('renameModal');
    if (modal) modal.classList.remove('active');
    clearInlineError('renameError');
    itemToRename = null;
}

function confirmDeleteAction(path, name, type) {
    if (!permissions.can_delete) {
        showError('У вас нет прав для удаления');
        return;
    }

    itemToDelete = { path, name, type };

    const message = document.getElementById('deleteMessage');
    const modal = document.getElementById('confirmDeleteModal');

    if (message) {
        message.textContent = `Are you sure you want to delete this ${type}: "${name}"?`;
    }
    if (modal) modal.classList.add('active');
}

function hideConfirmDeleteModal() {
    const modal = document.getElementById('confirmDeleteModal');
    if (modal) modal.classList.remove('active');
    itemToDelete = null;
}

function showError(message) {
    const messageEl = document.getElementById('errorMessage');
    const modal = document.getElementById('errorModal');
    if (messageEl) messageEl.textContent = message;
    if (modal) modal.classList.add('active');
}

function hideErrorModal() {
    const modal = document.getElementById('errorModal');
    if (modal) modal.classList.remove('active');
}

function showSuccess(message) {
    const messageEl = document.getElementById('successMessage');
    const modal = document.getElementById('successModal');
    if (messageEl) messageEl.textContent = message;
    if (modal) modal.classList.add('active');
}

function hideSuccessModal() {
    const modal = document.getElementById('successModal');
    if (modal) modal.classList.remove('active');
}

function showInlineError(errorElementId, message) {
    const errorElement = document.getElementById(errorElementId);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.classList.add('visible');
    }
}

function clearInlineError(errorElementId) {
    const errorElement = document.getElementById(errorElementId);
    if (errorElement) {
        errorElement.textContent = '';
        errorElement.classList.remove('visible');
    }
}


async function createFile() {
    const input = document.getElementById('fileNameInput');
    if (!input) return;

    const fileName = input.value.trim();
    if (!fileName) {
        showInlineError('fileNameError', 'Введите имя файла');
        return;
    }

    try {
        const data = await apiCreateFile(currentMount, currentPath, fileName);
        if (data.success) {
            hideCreateFileModal();
            showSuccess('Файл создан успешно');
            loadContents(currentPath);
            loadTree();
        } else {
            showInlineError('fileNameError', data.error || 'Ошибка при создании файла');
        }
    } catch (error) {
        console.error('Error creating file:', error);
        showInlineError('fileNameError', 'Ошибка при создании файла');
    }
}

async function createFolder() {
    const input = document.getElementById('folderNameInput');
    if (!input) return;

    const folderName = input.value.trim();
    if (!folderName) {
        showInlineError('folderNameError', 'Введите имя папки');
        return;
    }

    try {
        const data = await apiCreateFolder(currentMount, currentPath, folderName);
        if (data.success) {
            hideCreateFolderModal();
            showSuccess('Папка создана успешно');
            loadContents(currentPath);
            loadTree();
        } else {
            showInlineError('folderNameError', data.error || 'Ошибка при создании папки');
        }
    } catch (error) {
        console.error('Error creating folder:', error);
        showInlineError('folderNameError', 'Ошибка при создании папки');
    }
}

async function confirmRename() {
    const input = document.getElementById('renameInput');
    if (!input) return;

    const newName = input.value.trim();
    if (!newName) {
        showInlineError('renameError', 'Введите новое имя');
        return;
    }

    try {
        const data = await apiRenameItem(currentMount, itemToRename, newName);
        if (data.success) {
            hideRenameModal();
            showSuccess('Элемент переименован успешно');
            loadContents(currentPath);
            loadTree();
        } else {
            showInlineError('renameError', data.error || 'Ошибка при переименовании');
        }
    } catch (error) {
        console.error('Error renaming item:', error);
        showInlineError('renameError', 'Ошибка при переименовании');
    }
}

async function deleteItem() {
    if (!itemToDelete) return;

    try {
        const data = await apiDeleteItem(currentMount, itemToDelete.path);
        if (data.success) {
            hideConfirmDeleteModal();
            showSuccess('Элемент удален успешно');
            loadContents(currentPath);
            loadTree();
        } else {
            hideConfirmDeleteModal();
            showError(data.error || 'Ошибка при удалении');
        }
    } catch (error) {
        console.error('Error deleting item:', error);
        hideConfirmDeleteModal();
        showError('Ошибка при удалении');
    }
}


function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
