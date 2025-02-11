import { searchFiles, displaySearchResults } from './search.js';
import { setCurrentDocumentId } from './saveToMarkdownHandler.js';

function addSearchButtonEventListener() {
    const searchButton = document.getElementById('searchButton');
    if (searchButton) {
        searchButton.addEventListener('click', async () => {
            console.log('Search button clicked');
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
                const documentId = target.getAttribute('data-id');
                setCurrentDocumentId(documentId); // Set currentDocumentId when a document is selected
                console.log('Selected document ID:', documentId); // Log the currentDocumentId to the console
                // ...existing code to handle document selection...
            }
        });
    } else {
        console.error('Search results container not found.');
    }
});
