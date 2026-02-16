(function(window) {
    'use strict';

    let _baseURL = '';

    function initializeAPIClient(url) {
        _baseURL = (url || '/dagmanager').replace(/\/+$/, '');
        console.log('API Client initialized with base URL:', _baseURL);
    }

    async function getMounts() {
        const response = await fetch(`${_baseURL}/api/mounts`);
        return await response.json();
    }

    async function getTree(mount, path = '') {
        const url = `${_baseURL}/api/tree?mount=${encodeURIComponent(mount)}&path=${encodeURIComponent(path)}`;
        console.log('Fetching tree from:', url);
        const response = await fetch(url);
        return await response.json();
    }

    async function getContents(mount, path = '') {
        const url = `${_baseURL}/api/contents?mount=${encodeURIComponent(mount)}&path=${encodeURIComponent(path)}`;
        console.log('Fetching contents from:', url);
        const response = await fetch(url);
        return await response.json();
    }

    async function getFile(mount, path) {
        const url = `${_baseURL}/api/file?mount=${encodeURIComponent(mount)}&path=${encodeURIComponent(path)}`;
        const response = await fetch(url);
        return await response.json();
    }

    async function apiCreateFile(mount, path, name) {
        const response = await fetch(`${_baseURL}/api/create_file`, {
            method: 'POST',
            headers: window.getSecureHeaders(),
            body: JSON.stringify({ mount, path, name })
        });
        return await response.json();
    }

    async function apiCreateFolder(mount, path, name) {
        const response = await fetch(`${_baseURL}/api/create_folder`, {
            method: 'POST',
            headers: window.getSecureHeaders(),
            body: JSON.stringify({ mount, path, name })
        });
        return await response.json();
    }

    async function apiDeleteItem(mount, path) {
        const response = await fetch(`${_baseURL}/api/delete`, {
            method: 'POST',
            headers: window.getSecureHeaders(),
            body: JSON.stringify({ mount, path })
        });
        return await response.json();
    }

    async function apiRenameItem(mount, path, newName) {
        const response = await fetch(`${_baseURL}/api/rename`, {
            method: 'POST',
            headers: window.getSecureHeaders(),
            body: JSON.stringify({ mount, path, new_name: newName })
        });
        return await response.json();
    }

    async function apiSaveFile(mount, path, content) {
        const response = await fetch(`${_baseURL}/api/save_file`, {
            method: 'POST',
            headers: window.getSecureHeaders(),
            body: JSON.stringify({ mount, path, content })
        });
        return await response.json();
    }

    function getDownloadURL(mount, path) {
        return `${_baseURL}/api/download?mount=${encodeURIComponent(mount)}&path=${encodeURIComponent(path)}`;
    }

    window.initializeAPIClient = initializeAPIClient;
    window.getMounts = getMounts;
    window.getTree = getTree;
    window.getContents = getContents;
    window.getFile = getFile;
    window.apiCreateFile = apiCreateFile;
    window.apiCreateFolder = apiCreateFolder;
    window.apiDeleteItem = apiDeleteItem;
    window.apiRenameItem = apiRenameItem;
    window.apiSaveFile = apiSaveFile;
    window.getDownloadURL = getDownloadURL;

})(window);
