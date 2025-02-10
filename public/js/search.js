import { loadDocumentContent, updatePreviewContent } from './documentContentHandler.js';

export async function searchFiles(query) {
    try {
        const response = await fetch(`/dropbox/search?query=${encodeURIComponent(query)}`);
        if (!response.ok) {
            if (response.status === 401) {
                // Redirect to login page if unauthorized
                
                window.location.href = '/login.html?message=logged_out';
                return;
            }
            console.error('Search request failed:', response);
            throw new Error('Failed to search files');
        }
        return response.json();
    } catch (error) {
        console.error('Error during search:', error);
        throw error;
    }
}

export function displaySearchResults(results) {
    const searchResults = document.getElementById('searchResults');
    searchResults.innerHTML = '';

    if (results.length === 0) {
        searchResults.innerHTML = '<p>No results found.</p>';
        return;
    }

    const resultList = document.createElement('ul');
    resultList.classList.add('list-group');

    results.forEach((result, index) => {
        const resultItem = document.createElement('li');
        resultItem.classList.add('list-group-item', 'list-group-item-action');
        resultItem.setAttribute('data-id', result.id);
        resultItem.setAttribute('tabindex', index + 1);
        resultItem.textContent = result.abs;
        resultItem.addEventListener('click', () => loadDocumentContent(result.id));
        resultList.appendChild(resultItem);
    });

    searchResults.appendChild(resultList);

    // Add keyboard navigation
    searchResults.addEventListener('keydown', async (event) => {
        const activeElement = document.activeElement;
        if (activeElement.parentElement === resultList) {
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                const nextElement = activeElement.nextElementSibling;
                if (nextElement) {
                    nextElement.focus();
                    await loadDocumentContent(nextElement.getAttribute('data-id'));
                }
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                const previousElement = activeElement.previousElementSibling;
                if (previousElement) {
                    previousElement.focus();
                    await loadDocumentContent(previousElement.getAttribute('data-id'));
                }
            }
        }
    });
}

document.getElementById('markdownTextarea').addEventListener('input', updatePreviewContent);
