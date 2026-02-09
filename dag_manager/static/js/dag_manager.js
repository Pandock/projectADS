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

document.addEventListener('DOMContentLoaded', function() {
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
    fetch(`/dagmanager/api/tree?mount=${encodeURIComponent(currentMount)}`)
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
    
    fetch(`/dagmanager/api/contents?mount=${encodeURIComponent(currentMount)}&path=${encodeURIComponent(path)}`)
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
        
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'icon-button download';
        downloadBtn.innerHTML = '⬇️';
        downloadBtn.title = 'Download as ZIP';
        downloadBtn.onclick = (e) => {
            e.stopPropagation();
            downloadItem(folder.path, folder.name);
        };
        
        const renameBtn = document.createElement('button');
        renameBtn.className = 'icon-button rename';
        renameBtn.innerHTML = '✏️';
        renameBtn.title = 'Rename';
        renameBtn.onclick = (e) => {
            e.stopPropagation();
            showRenameModal(folder.path, folder.name);
        };
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'icon-button delete';
        deleteBtn.innerHTML = '🗑️';
        deleteBtn.title = 'Delete';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            confirmDelete(folder.path, folder.name, 'folder');
        };
        
        actionsDiv.appendChild(downloadBtn);
        actionsDiv.appendChild(renameBtn);
        actionsDiv.appendChild(deleteBtn);
        
        folderDiv.appendChild(mainInfo);
        folderDiv.appendChild(metaDiv);
        folderDiv.appendChild(actionsDiv);
        
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
        
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'icon-button download';
        downloadBtn.innerHTML = '⬇️';
        downloadBtn.title = 'Download';
        downloadBtn.onclick = (e) => {
            e.stopPropagation();
            downloadItem(file.path, file.name);
        };
        
        const renameBtn = document.createElement('button');
        renameBtn.className = 'icon-button rename';
        renameBtn.innerHTML = '✏️';
        renameBtn.title = 'Rename';
        renameBtn.onclick = (e) => {
            e.stopPropagation();
            showRenameModal(file.path, file.name);
        };
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'icon-button delete';
        deleteBtn.innerHTML = '🗑️';
        deleteBtn.title = 'Delete';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            confirmDelete(file.path, file.name, 'file');
        };
        
        actionsDiv.appendChild(downloadBtn);
        actionsDiv.appendChild(renameBtn);
        actionsDiv.appendChild(deleteBtn);
        
        fileDiv.appendChild(mainInfo);
        fileDiv.appendChild(metaDiv);
        fileDiv.appendChild(actionsDiv);
        
        content.appendChild(fileDiv);
    });
}

function loadFile(path, filename) {
    document.getElementById('content').innerHTML = '<div class="loading">Loading file...</div>';
    
    console.log('Loading file:', path);
    
    fetch(`/dagmanager/api/file?mount=${encodeURIComponent(currentMount)}&path=${encodeURIComponent(path)}`)
        .then(response => {
            console.log('File response status:', response.status);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('File data received:', data.success, 'Content length:', data.content ? data.content.length : 0);
            
            if (data.success && data.content !== undefined) {
                currentEditingFile = path;
                originalFileContent = data.content;
                isFileModified = false;
                renderFileEditor(filename, data.content);
            } else {
                console.error('File loading failed:', data);
                showError(data.error || 'Error loading file - invalid response');
                document.getElementById('content').innerHTML = '<div class="empty-state">❌ Error loading file</div>';
            }
        })
        .catch(error => {
            console.error('Error loading file:', error);
            showError('Error loading file: ' + error.message);
            document.getElementById('content').innerHTML = '<div class="empty-state">❌ Error loading file</div>';
        });
}

function renderFileEditor(filename, content) {
    const contentArea = document.getElementById('content');
    
    // Подсчитываем статистику
    const lines = content.split('\n').length;
    const chars = content.length;
    const sizeKB = (new Blob([content]).size / 1024).toFixed(2);
    
    // Создаем HTML структуру
    contentArea.innerHTML = `
        <div class="file-editor-container">
            <div class="editor-header">
                <div class="editor-title">
                    <h4>📄 ${escapeHtml(filename)}</h4>
                    <span class="editor-status" id="editorStatus"></span>
                </div>
            </div>
            <textarea class="code-editor" id="fileContentEditor" spellcheck="false"></textarea>
            <div class="editor-footer">
                <div class="editor-info">
                    <span id="editorStats">Lines: ${lines} | Characters: ${chars} | Size: ${sizeKB} KB</span>
                </div>
                <div class="editor-actions">
                    <button class="editor-button cancel" onclick="closeFileEditor()">Close</button>
                    <button class="editor-button save" id="saveButton" onclick="saveFile()" disabled>💾 Save Changes</button>
                </div>
            </div>
        </div>
    `;
    
    // Устанавливаем содержимое текста ПОСЛЕ создания textarea
    const editor = document.getElementById('fileContentEditor');
    editor.value = content;
    
    // Добавляем обработчик изменений
    editor.addEventListener('input', onFileContentChange);
    
    // Автофокус на редактор
    editor.focus();
}

function onFileContentChange() {
    const editor = document.getElementById('fileContentEditor');
    const currentContent = editor.value;
    const statusElement = document.getElementById('editorStatus');
    const saveButton = document.getElementById('saveButton');
    
    // Обновляем статистику
    const lines = currentContent.split('\n').length;
    const chars = currentContent.length;
    const sizeKB = (new Blob([currentContent]).size / 1024).toFixed(2);
    document.getElementById('editorStats').textContent = `Lines: ${lines} | Characters: ${chars} | Size: ${sizeKB} KB`;
    
    // Проверяем, изменен ли файл
    if (currentContent !== originalFileContent) {
        isFileModified = true;
        statusElement.textContent = '● Modified';
        statusElement.className = 'editor-status modified';
        saveButton.disabled = false;
    } else {
        isFileModified = false;
        statusElement.textContent = '';
        statusElement.className = 'editor-status';
        saveButton.disabled = true;
    }
}

function saveFile() {
    if (!currentEditingFile) {
        showError('No file is currently being edited');
        return;
    }
    
    const editor = document.getElementById('fileContentEditor');
    const content = editor.value;
    const saveButton = document.getElementById('saveButton');
    
    // Отключаем кнопку во время сохранения
    saveButton.disabled = true;
    saveButton.textContent = '⏳ Saving...';
    
    fetch('/dagmanager/api/save_file', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            mount: currentMount,
            path: currentEditingFile,
            content: content
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Обновляем оригинальное содержимое
            originalFileContent = content;
            isFileModified = false;
            
            // Обновляем UI
            document.getElementById('editorStatus').textContent = '✓ Saved';
            document.getElementById('editorStatus').className = 'editor-status';
            saveButton.textContent = '💾 Save Changes';
            saveButton.disabled = true;
            
            // Показываем уведомление
            showSuccess('File saved successfully');
            setTimeout(() => {
                hideSuccessModal();
            }, 1500);
            
            // Обновляем список файлов
            loadContents(currentPath);
        } else {
            showError(data.error || 'Error saving file');
            saveButton.disabled = false;
            saveButton.textContent = '💾 Save Changes';
        }
    })
    .catch(error => {
        console.error('Error saving file:', error);
        showError('Error saving file');
        saveButton.disabled = false;
        saveButton.textContent = '💾 Save Changes';
    });
}

function closeFileEditor() {
    if (isFileModified) {
        // Используем модальное окно подтверждения
        const confirmMsg = 'You have unsaved changes. Are you sure you want to close?';
        document.getElementById('deleteMessage').textContent = confirmMsg;
        document.getElementById('confirmDeleteModal').classList.add('active');
        
        // Переопределяем кнопку Delete на Close
        const footer = document.querySelector('#confirmDeleteModal .modal-footer');
        footer.innerHTML = `
            <button class="modal-button secondary" onclick="hideConfirmDeleteModal()">Cancel</button>
            <button class="modal-button primary" onclick="confirmCloseEditor()">Close Without Saving</button>
        `;
    } else {
        // Закрываем без подтверждения
        confirmCloseEditor();
    }
}

function confirmCloseEditor() {
    hideConfirmDeleteModal();
    currentEditingFile = null;
    originalFileContent = null;
    isFileModified = false;
    loadContents(currentPath);
}

function updateBreadcrumb(path) {
    const breadcrumb = document.getElementById('breadcrumb');
    
    const pathContainer = document.createElement('div');
    pathContainer.className = 'breadcrumb-path';
    pathContainer.innerHTML = '<button class="home-btn" onclick="goHome()">🏠 Home</button>';
    
    if (path) {
        const parts = path.split('/');
        let accumulated = '';
        parts.forEach((part, index) => {
            accumulated += (index > 0 ? '/' : '') + part;
            const separator = document.createElement('span');
            separator.textContent = ' / ';
            pathContainer.appendChild(separator);
            
            const link = document.createElement('a');
            link.href = '#';
            link.textContent = part;
            const pathToNavigate = accumulated;
            link.onclick = () => { navigateToPath(pathToNavigate); return false; };
            pathContainer.appendChild(link);
        });
    }
    
    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'breadcrumb-actions';
    actionsContainer.innerHTML = `
        <button class="action-button" onclick="showCreateFileModal()">📄 Create File</button>
        <button class="action-button secondary" onclick="showCreateFolderModal()">📁 Create Folder</button>
    `;
    
    breadcrumb.innerHTML = '';
    breadcrumb.appendChild(pathContainer);
    breadcrumb.appendChild(actionsContainer);
}

function navigateToPath(path) {
    currentPath = path;
    loadContents(path);
    updateBreadcrumb(path);
    expandToCurrentPath();
}

function downloadItem(path, name) {
    const downloadUrl = `/dagmanager/api/download?mount=${encodeURIComponent(currentMount)}&path=${encodeURIComponent(path)}`;
    
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Modal functions
function showCreateFileModal() {
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

// CRUD operations
function createFile() {
    const fileName = document.getElementById('fileNameInput').value.trim();
    
    if (!fileName) {
        showInlineError('fileNameError', 'Please enter a file name');
        return;
    }
    
    clearInlineError('fileNameError');
    
    fetch('/dagmanager/api/create_file', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            mount: currentMount,
            path: currentPath,
            name: fileName
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            hideCreateFileModal();
            showSuccess('File created successfully');
            setTimeout(() => {
                hideSuccessModal();
                loadContents(currentPath);
                loadTree();
            }, 1000);
        } else {
            showInlineError('fileNameError', data.error || 'Error creating file');
        }
    })
    .catch(error => {
        console.error('Error creating file:', error);
        showInlineError('fileNameError', 'Error creating file');
    });
}

function createFolder() {
    const folderName = document.getElementById('folderNameInput').value.trim();
    
    if (!folderName) {
        showInlineError('folderNameError', 'Please enter a folder name');
        return;
    }
    
    clearInlineError('folderNameError');
    
    fetch('/dagmanager/api/create_folder', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            mount: currentMount,
            path: currentPath,
            name: folderName
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            hideCreateFolderModal();
            showSuccess('Folder created successfully');
            setTimeout(() => {
                hideSuccessModal();
                loadContents(currentPath);
                loadTree();
            }, 1000);
        } else {
            showInlineError('folderNameError', data.error || 'Error creating folder');
        }
    })
    .catch(error => {
        console.error('Error creating folder:', error);
        showInlineError('folderNameError', 'Error creating folder');
    });
}

function deleteItem() {
    if (!itemToDelete) {
        console.error('No item to delete');
        return;
    }
    
    const itemType = itemToDelete.type;
    const itemPath = itemToDelete.path;
    
    console.log('Deleting item:', itemPath);
    
    hideConfirmDeleteModal();
    
    fetch('/dagmanager/api/delete', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            mount: currentMount,
            path: itemPath
        })
    })
    .then(response => {
        console.log('Delete response status:', response.status);
        return response.json();
    })
    .then(data => {
        console.log('Delete response data:', data);
        if (data.success) {
            showSuccess(`${itemType} deleted successfully`);
            setTimeout(() => {
                hideSuccessModal();
                loadContents(currentPath);
                loadTree();
            }, 1000);
        } else {
            showError(data.error || 'Error deleting item');
        }
    })
    .catch(error => {
        console.error('Error deleting item:', error);
        showError('Error deleting item: ' + error.message);
    });
}

function confirmRename() {
    const newName = document.getElementById('renameInput').value.trim();
    
    if (!newName) {
        showInlineError('renameError', 'Please enter a new name');
        return;
    }
    
    clearInlineError('renameError');
    
    fetch('/dagmanager/api/rename', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            mount: currentMount,
            path: itemToRename,
            new_name: newName
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            hideRenameModal();
            showSuccess('Item renamed successfully');
            setTimeout(() => {
                hideSuccessModal();
                loadContents(currentPath);
                loadTree();
            }, 1000);
        } else {
            showInlineError('renameError', data.error || 'Error renaming item');
        }
    })
    .catch(error => {
        console.error('Error renaming item:', error);
        showInlineError('renameError', 'Error renaming item');
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Обработка Enter в модальных окнах
document.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        if (document.getElementById('createFileModal').classList.contains('active')) {
            createFile();
        } else if (document.getElementById('createFolderModal').classList.contains('active')) {
            createFolder();
        } else if (document.getElementById('renameModal').classList.contains('active')) {
            confirmRename();
        }
    }
});

// Закрытие модальных окон по Escape
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        hideCreateFileModal();
        hideCreateFolderModal();
        hideRenameModal();
        hideConfirmDeleteModal();
        hideErrorModal();
        hideSuccessModal();
    }
});

// Предупреждение при попытке покинуть страницу с несохраненными изменениями
window.addEventListener('beforeunload', function(e) {
    if (isFileModified) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
    }
});
