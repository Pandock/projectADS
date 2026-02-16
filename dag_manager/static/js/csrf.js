(function(window) {
    'use strict';

    let _csrfToken = '';

    function initializeCSRFToken() {
        _csrfToken = getCSRFToken();

        if (_csrfToken) {
            console.log('✅ CSRF Token initialized successfully');
        } else {
            console.warn('⚠️ CSRF Token not found! POST requests may fail.');
        }
    }


    function getCSRFToken() {
        if (window.DAG_MANAGER_CSRF_TOKEN) {
            console.log('CSRF token source: window variable');
            return window.DAG_MANAGER_CSRF_TOKEN;
        }

        const csrfMeta = document.querySelector('meta[name="csrf-token"]');
        if (csrfMeta && csrfMeta.content) {
            console.log('CSRF token source: meta tag');
            return csrfMeta.content;
        }

        const csrfCookie = document.cookie
            .split('; ')
            .find(row => row.startsWith('csrf_token='));

        if (csrfCookie) {
            console.log('CSRF token source: cookie');
            return csrfCookie.split('=')[1];
        }

        return '';
    }

    function getSecureHeaders() {
        return {
            'Content-Type': 'application/json',
            'X-CSRFToken': _csrfToken
        };
    }

    function getCurrentCSRFToken() {
        return _csrfToken;
    }

    window.initializeCSRFToken = initializeCSRFToken;
    window.getCSRFToken = getCSRFToken;
    window.getSecureHeaders = getSecureHeaders;
    window.getCurrentCSRFToken = getCurrentCSRFToken;

})(window);
