// Function to load the document title from the database
export function loadDocumentTitle(documentId) {
    fetch(`/api/document/${documentId}/title`)
        .then(response => response.json())
        .then(data => {
            const titleElement = document.getElementById('documentTitle');
            titleElement.textContent = data.title;
        })
        .catch(error => console.error('Error loading document title:', error));
}

// Function to save the document title to the database
export function saveDocumentTitle(documentId, newTitle) {
    fetch(`/api/document/${documentId}/title`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title: newTitle })
    })
    .then(response => response.json())
    .then(data => {
        console.log('Title saved successfully:', data);
    })
    .catch(error => console.error('Error saving document title:', error));
}

document.addEventListener('DOMContentLoaded', () => {
    const titleElement = document.getElementById('documentTitle');
    const documentId = titleElement.dataset.documentId; // Assuming documentId is stored in a data attribute

    loadDocumentTitle(documentId);

    titleElement.addEventListener('click', () => {
        const currentTitle = titleElement.textContent;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentTitle;
        input.id = 'title-input';

        titleElement.replaceWith(input);
        input.focus();

        input.addEventListener('blur', () => {
            const newTitle = input.value.trim();
            if (newTitle) {
                titleElement.textContent = newTitle;
                input.replaceWith(titleElement);
                saveDocumentTitle(documentId, newTitle);
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
