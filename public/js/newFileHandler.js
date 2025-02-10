let currentDocumentId = null;

export function initializeNewFileHandler() {
  try {
    document.getElementById('newFileButton').addEventListener('click', () => {
      try {
        // Reset current document settings and URL
        currentDocumentId = null;
        document.cookie = 'currentDocumentId=; path=/; max-age=0'; // Clear the currentDocumentId cookie
        document.cookie = 'fileUrl=; path=/; max-age=0'; // Clear the fileUrl cookie

        // Clear the markdown textarea and preview content
        document.getElementById('markdownTextarea').value = '';
        document.getElementById('previewContent').innerHTML = 'Your preview will appear here...';
        document.getElementById('returnFileURL').href = '#';
        document.getElementById('returnFileURL').text = 'Your new file URL will appear here...';
        document.getElementById('documentTitle').textContent = 'Document Title';

        console.log('New file created and settings reset');
      } catch (error) {
        console.error('Error resetting document settings:', error);
      }
    });
  } catch (error) {
    console.error('Initialization failed:', error);
  }
}
