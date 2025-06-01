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
        searchResults.addEventListener('click', async (event) => {
            if (event.target.classList.contains('list-group-item')) {
                const id = event.target.getAttribute('data-id');
                if (id) {
                    // Get the user ID from local storage
                    const userId = localStorage.getItem('userId');
                    if (!userId) {
                        alert('User ID not found. Please log in again.');
                        return;
                    }

                    // Update the document URL immediately
                    const fileUrl = `https://mystmkra.io/dropbox/blog/${userId}/${id}.md`;
                    const returnFileURL = document.getElementById('returnFileURL');
                    if (returnFileURL) {
                        returnFileURL.href = fileUrl;
                        returnFileURL.textContent = fileUrl;
                        returnFileURL.setAttribute('data-url', fileUrl);
                    }

                    // Load the document content
                    await loadDocumentContent(id);
                }
            }
        });
    } else {
        console.error('Search results container not found.');
    }
});
