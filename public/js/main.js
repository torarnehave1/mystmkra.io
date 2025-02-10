import { searchFiles, displaySearchResults } from './search.js';
import { marked } from 'https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js';

document.getElementById('searchButton').addEventListener('click', async () => {
    const query = document.querySelector('.search-box').value.trim();
    if (!query) {
        alert('Please enter a search term');
        return;
    }

    try {
        const results = await searchFiles(query);
        displaySearchResults(results);
    } catch (error) {
        console.error('Error searching files:', error);
        if (error.message.includes('Initialization failed')) {
            alert('Initialization failed! Please try again later.');
        } else {
            alert('Error searching files');
        }
    }
});

export async function loadDocumentContent(id) {
    try {
        const response = await fetch(`/dropbox/file/${id}`);
        if (!response.ok) {
            throw new Error('Failed to fetch document content');
        }
        const data = await response.json();
        const htmlContent = marked(data.content);
        document.getElementById('selectedContent').innerHTML = htmlContent;
        document.getElementById('markdownTextarea').value = data.content;
        updatePreviewContent(); // Ensure preview is updated when content is loaded
    } catch (error) {
        console.error('Error loading document content:', error);
        alert('Error loading document content');
    }
}

function updatePreviewContent() {
    const markdownTextarea = document.getElementById('markdownTextarea');
    const previewContent = document.getElementById('previewContent');
    const markdownContent = markdownTextarea.value;
    const htmlContent = marked(markdownContent);
    previewContent.innerHTML = htmlContent;
}

document.getElementById('markdownTextarea').addEventListener('input', updatePreviewContent);
