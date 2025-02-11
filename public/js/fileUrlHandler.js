import { getFileUrl } from './fileService.js';
import { loadDocumentContent } from './documentContentHandler.js';
import { marked } from 'https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js';

document.addEventListener('DOMContentLoaded', () => {
    const currentDocumentId = getCookie('currentDocumentId');
    if (currentDocumentId) {
        loadDocumentContent(currentDocumentId);
    }

    const fileUrl = getCookie('fileUrl');
    if (fileUrl) {
        const returnFileURL = document.getElementById('returnFileURL');
        if (returnFileURL) {
            returnFileURL.href = fileUrl;
            returnFileURL.text = fileUrl;
        }
    }

    const saveButton = document.getElementById('saveButton');
    if (saveButton) {
        saveButton.addEventListener('click', () => {
            const fileUrl = document.getElementById('returnFileURL').href;
            if (fileUrl) {
                document.cookie = `fileUrl=${fileUrl}; path=/; max-age=31536000`; // Expires in 1 year
            }
        });
    }

    const searchResults = document.getElementById('searchResults');
    if (searchResults) {
        searchResults.addEventListener('click', async (event) => {
            if (event.target.classList.contains('list-group-item')) {
                const id = event.target.getAttribute('data-id');
                if (id) {
                    await loadDocumentContent(id);
                }
            }
        });
    }
});

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}
