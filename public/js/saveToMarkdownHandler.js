function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
}

function setCookie(name, value, days) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = name + '=' + encodeURIComponent(value) + '; expires=' + expires + '; path=/';
}

export function initializeSaveToMarkdownHandler() {
    document.getElementById('saveButton').addEventListener('click', async () => {
        const content = document.getElementById('markdownTextarea').value;
        const userId = localStorage.getItem('userId');
        const currentDocumentId = getCookie('currentDocumentId'); // Get currentDocumentId from cookie

        if (!userId) {
            alert('User ID not found. Please log in again.');
            return;
        }

        try {
            const response = await fetch('/openai/say-hello', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ content, userId, documentId: currentDocumentId }) // Include documentId in the request body
            });
            const data = await response.json();
           // alert(`Message: ${data.message}, Token Count: ${data.tokenCount}`);
            
            // Set the returnFileURL correctly
            const returnFileURL = document.getElementById('returnFileURL');
            returnFileURL.href = data.fileUrl;
            returnFileURL.value = data.fileUrl;
            returnFileURL.setAttribute('data-url', data.fileUrl);
            
            // Set the currentDocumentId in the cookie
            setCookie('currentDocumentId', data.id, 7);

            // Show save success message
            showSaveSuccess();
            
        } catch (error) {
            console.error('Error:', error);
            alert('Failed to call the endpoint.');
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
