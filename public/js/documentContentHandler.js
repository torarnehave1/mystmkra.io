import { marked } from 'https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js';

export async function loadDocumentContent(id) {
    if (!id) {
        id = getCookie('currentDocumentId');
        if (!id) {
            console.error('Document ID is undefined.');
            return;
        }
    }
    try {
        const response = await fetch(`/dropbox/file/${id}`);
        if (!response.ok) {
            throw new Error('Failed to fetch document content');
        }
        const data = await response.json();
        const htmlContent = marked(data.content);
        const documentContentElement = document.getElementById('selectedContent');
        if (documentContentElement) {
            documentContentElement.innerHTML = htmlContent;
        } else {
            console.error('Error loading document content: Element with ID "selectedContent" not found.');
        }
        document.getElementById('markdownTextarea').value = data.content;
        updatePreviewContent(); // Ensure preview is updated when content is loaded

        // Set tags
        const tags = Array.isArray(data.tags) ? data.tags : [];
        const tagsElement = document.getElementById('tags');
        if (tagsElement) {
            tagsElement.value = tags.join(' ');
            setCookie('documentTags', tags.join(' '), 7); // Store tags in a cookie for 7 days
        } else {
            console.error('Error loading document content: Element with ID "tags" not found.');
        }

        // Load the document title
        const titleElement = document.getElementById('documentTitle');
        if (titleElement && data.title) {
            titleElement.textContent = data.title;
        }
    } catch (error) {
        console.error('Error loading document content:', error);
        alert('Error loading document content');
    }
}

export function updatePreviewContent() {
    const markdownTextarea = document.getElementById('markdownTextarea');
    const previewContent = document.getElementById('previewContent');
    const markdownContent = markdownTextarea.value;
    const htmlContent = marked(markdownContent);
    previewContent.innerHTML = htmlContent;
}

document.getElementById('markdownTextarea').addEventListener('input', updatePreviewContent);

// Utility function to set a cookie
function setCookie(name, value, days) {
    const d = new Date();
    d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = "expires=" + d.toUTCString();
    document.cookie = name + "=" + value + ";" + expires + ";path=/";
}

// Utility function to get a cookie
function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

// Load tags from cookie on page load
document.addEventListener('DOMContentLoaded', () => {
    const tagsElement = document.getElementById('tags');
    if (tagsElement) {
        const savedTags = getCookie('documentTags');
        if (savedTags) {
            tagsElement.value = savedTags;
        }
    }
});

// Function to handle document selection from search results
export function handleDocumentSelection(id) {
    loadDocumentContent(id);
    setCookie('currentDocumentId', id, 7); // Store current document ID in a cookie for 7 days
    const tagsElement = document.getElementById('tags');
    if (tagsElement) {
        const savedTags = getCookie('documentTags');
        if (savedTags) {
            tagsElement.value = savedTags;
        }
    }
}

// Save the document title to the database
async function saveDocumentTitle(id, title) {
    try {
        const response = await fetch(`/dropbox/file/${id}/title`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ title })
        });

        if (!response.ok) {
            throw new Error('Failed to save document title');
        }
    } catch (error) {
        console.error('Error saving document title:', error);
        alert('Error saving document title');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const titleElement = document.getElementById('documentTitle');

    titleElement.addEventListener('click', () => {
        const currentTitle = titleElement.textContent;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentTitle;
        input.id = 'title-input';

        titleElement.replaceWith(input);
        input.focus();

        input.addEventListener('blur', async () => {
            const newTitle = input.value.trim();
            if (newTitle) {
                titleElement.textContent = newTitle;
                input.replaceWith(titleElement);
                await saveDocumentTitle(window.currentDocumentId, newTitle);
            } else {
                alert('Title cannot be empty.');
                input.focus();
            }
        });

        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                input.blur();
            }
        });
    });
});
