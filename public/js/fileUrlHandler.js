import { getFileUrl } from './fileService.js';
import { marked } from 'https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js';

document.addEventListener('DOMContentLoaded', () => {
    const currentDocumentId = getCookie('currentDocumentId');
    if (currentDocumentId) {
        loadDocumentContent(currentDocumentId);
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

async function loadDocumentContent(id) {
    try {
        const response = await fetch(`/dropbox/file/${id}`);
        if (!response.ok) {
            throw new Error('Failed to fetch document content');
        }
        const data = await response.json();
        const htmlContent = marked(data.content);
        document.getElementById('selectedContent').innerHTML = htmlContent;
        document.getElementById('markdownTextarea').value = data.content;
        updatePreviewContent();

        const userId = localStorage.getItem('userId');
        const fileUrl = await getFileUrl(id, userId);

        if (fileUrl) {
            document.getElementById('returnFileURL').href = fileUrl;
            document.getElementById('returnFileURL').text = fileUrl;
            document.cookie = `fileUrl=${fileUrl}; path=/; max-age=31536000`;
        }

        document.cookie = `currentDocumentId=${id}; path=/; max-age=31536000`;
    } catch (error) {
        console.error('Error loading document content:', error);
    }
}

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

function updatePreviewContent() {
    const markdownTextarea = document.getElementById('markdownTextarea');
    const previewContent = document.getElementById('previewContent');
    const markdownContent = markdownTextarea.value;
    const htmlContent = marked(markdownContent);
    previewContent.innerHTML = htmlContent;
}
