import { searchFiles, displaySearchResults } from './search.js';
import { setCurrentDocumentId } from './saveToMarkdownHandler.js';

function addSearchButtonEventListener() {
    const searchButton = document.getElementById('searchButton');
    if (searchButton) {
        searchButton.addEventListener('click', async () => {
            console.log('Search button clicked');
            // Try to get the search query from an element with class "search-box".
            // If not found, use the textarea inside the search panel.
            let queryElement = document.querySelector('.search-box');
            if (!queryElement) {
                queryElement = document.querySelector('#searchContent textarea');
            }
            const query = queryElement ? queryElement.value.trim() : '';
            if (!query) {
                alert('Please enter a search term');
                return;
            }

            try {
                console.log('Searching for:', query);
                const results = await searchFiles(query);
                console.log('Search results:', results);
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
    } else {
        console.error('Search button not found.');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('Document loaded');
    
    // Attach the event listener to the search button
    addSearchButtonEventListener();

    // Attach click event to the search results container
    const searchResults = document.getElementById('searchResults');
    if (searchResults) {
        searchResults.addEventListener('click', (event) => {
            const target = event.target;
            if (target.classList.contains('list-group-item')) {
                const documentId = target.getAttribute('data-document-id');
                setCurrentDocumentId(documentId); // Set currentDocumentId when a document is selected
                // ...existing code to handle document selection...
            }
        });
    } else {
        console.error('Search results container not found.');
    }
});
