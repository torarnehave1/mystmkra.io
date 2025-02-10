export async function saveMarkdownContent(markdownTextarea, saveButtonId, returnUrlId, currentDocumentId, documentTitleId) {
    const textarea = document.getElementById(markdownTextarea);
    const saveButton = document.getElementById(saveButtonId);
    const returnUrl = document.getElementById(returnUrlId);
    const documentTitleElement = document.getElementById(documentTitle);

    if (!textarea) {
        alert('Textarea element not found.');
        return;
    }

    if (!documentTitleElement) {
        alert('Document title element not found.');
        return;
    }

    const content = textarea.value;

    if (!content.trim()) {
        alert('Textarea is empty. Please enter some content.');
        return;
    }

    const documentTitle = documentTitleElement.textContent.trim();
    if (!documentTitle) {
        alert('Document title is empty. Please enter a title.');
        return;
    }

    // Check if content length exceeds the model's maximum context length
    //const maxContextLength = 8192;
    //if (content.length > maxContextLength) {
   //     alert(`Content length exceeds the maximum allowed length of ${maxContextLength} characters. Please reduce the content length.`);
    //    return;
   // }

    // Retrieve the user ID from local storage
    const userId = localStorage.getItem('userId');
    if (!userId) {
        alert('User ID not found. Please log in again.');
        return;
    }

    saveButton.disabled = true;

    try {
        const response = await fetch('/dropbox/save-markdown', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ content, documentId: currentDocumentId, title: documentTitle }) // Include documentId and title if they exist
        });

        if (response.ok) {
            const result = await response.json();
            console.log('File saved successfully:', result.filePath);

            // Update the return file URL in the DOM
            returnUrl.href = result.url;
            returnUrl.text = result.url;
            returnUrl.setAttribute('data-url', result.url);
        } else {
            const errorText = await response.text();
            console.error('Error saving file:', errorText);
            alert('Error saving file');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred while saving the file');
    } finally {
        saveButton.disabled = false;
    }
}

export function showSaveSuccess() {
    const alertElement = document.getElementById('info-alert');
    alertElement.classList.remove('hidden');
    setTimeout(() => {
        alertElement.classList.add('hidden');
    }, 3000); // Hide after 3 seconds
}

document.getElementById('saveButton').addEventListener('click', () => {
    const markdownTextarea = document.getElementById('markdownTextarea');
    if (markdownTextarea.value.trim() === '') {
        alert('Cannot save an empty document.');
        return;
    }

    saveMarkdownContent('markdownTextarea', 'saveButton', 'returnFileURL', null, 'documentTitle')
        .then(() => {
            showSaveSuccess();
        });
});
