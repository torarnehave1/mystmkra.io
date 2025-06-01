export async function openContent(id, textareaId, returnFileURLClass) {
    if (!id) {
        console.error('No id provided');
        alert('No document id provided');
        return;
    }

    // Retrieve the user ID from local storage
    const userId = localStorage.getItem('userId');
    if (!userId) {
        alert('User ID not found. Please log in again.');
        return;
    }

    try {
        const response = await fetch(`/dropbox/file/${id}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const data = await response.json();
        const textarea = document.getElementById(textareaId);
        if (textarea) {
            textarea.value = data.content; // Load content into the textarea
            textarea.focus();

            // Hide the search results display
            document.getElementById('FileListfromSearch').style.display = 'none';
            document.getElementById('paginationControls').style.display = 'none';

            // Update the current document ID
            window.currentDocumentId = id;
            
            // Construct the file URL with the user ID
            const fileUrl = `https://mystmkra.io/dropbox/blog/${userId}/${window.currentDocumentId}.md`;

            // Update the return file URL element
            const returnFileURL = document.getElementById('returnFileURL');
            if (returnFileURL) {
                returnFileURL.href = fileUrl;
                returnFileURL.textContent = fileUrl;
                returnFileURL.setAttribute('data-url', fileUrl);
            }
            
            window.isChanged = true;

            // Store the file URL in a cookie
            document.cookie = `fileUrl=${fileUrl}; path=/; max-age=31536000`; // Expires in 1 year

            // Load the document title
            const titleElement = document.getElementById('documentTitle');
            if (titleElement && data.title) {
                titleElement.textContent = data.title;
            }

            alert('Document loaded successfully.');
        } else {
            console.error('Textarea element not found');
            alert('Textarea element not found');
        }
    } catch (error) {
        console.error('Error fetching document:', error);
        alert('Error fetching document');
    }
}

export async function getFileUrl(id, userId) {
    if (!id) {
        console.error('No id provided');
        alert('No document id provided');
        return null;
    }

    if (!userId) {
        alert('User ID not found. Please log in again.');
        return null;
    }

    // Construct the file URL with the user ID
    const fileUrl = `https://mystmkra.io/dropbox/blog/${userId}/${id}.md`;

    return fileUrl;
}
