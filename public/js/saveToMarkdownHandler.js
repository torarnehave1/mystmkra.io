function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
}

function setCookie(name, value, days) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = name + '=' + encodeURIComponent(value) + '; expires=' + expires + '; path=/';
}

export { getCookie, setCookie };

export function initializeSaveToMarkdownHandler() {
    document.getElementById('saveButton').addEventListener('click', async () => {
        const content = document.getElementById('markdownTextarea').value;
        const tagsElement = document.getElementById('tags');
        const tags = tagsElement ? tagsElement.value.split(' ').filter(tag => tag.startsWith('#')) : [];
        const userId = localStorage.getItem('userId');
        let currentDocumentId = getCookie('currentDocumentId'); // Get currentDocumentId from cookie

        if (!userId) {
            alert('User ID not found. Please log in again.');
            return;
        }

        if (!currentDocumentId) {
            alert('No document selected. Please create or open a document.');
            return;
        }

        try {
            const response = await fetch('/openai/say-hello', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ content, tags, userId, documentId: currentDocumentId }) // Include tags and documentId in the request body
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Failed to save document: ${errorData.error}`);
            }
            const data = await response.json();
            // Set the returnFileURL correctly
            const returnFileURL = document.getElementById('returnFileURL');
            returnFileURL.href = data.fileUrl;
            returnFileURL.value = data.fileUrl;
            returnFileURL.setAttribute('data-url', data.fileUrl);
            
            // Ensure the currentDocumentId is not overwritten or set to null/empty
            if (data.id) {
                currentDocumentId = data.id;
                setCookie('currentDocumentId', currentDocumentId, 7);
            }

            // Store document content, title, and tags in local storage
            localStorage.setItem('documentContent', content);
            localStorage.setItem('documentTitle', document.getElementById('documentTitle').textContent);
            setCookie('tags', JSON.stringify(tags), 7);

            // Show save success message
            showSaveSuccess();
        } catch (error) {
            console.error('Error:', error.message);
            alert(`Failed to save document: ${error.message}`);
        }
    });
}

export function showSaveSuccess() {
    const alertElement = document.getElementById('info-alert');
    if (alertElement) {
        alertElement.style.display = 'block';
        alertElement.textContent = 'Document saved successfully!';
        setTimeout(() => {
            alertElement.style.display = 'none';
        }, 3000); // Hide after 3 seconds
    } else {
        console.error('Error: Element with ID "info-alert" not found.');
    }
}

// Function to set currentDocumentId when a document is selected from the search list
export function setCurrentDocumentId(documentId) {
    setCookie('currentDocumentId', documentId, 7); // Set cookie for 7 days
}
