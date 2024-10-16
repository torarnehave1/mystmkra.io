document.addEventListener('DOMContentLoaded', function() {
    
   
    // Function to load images for the modal gallery
    function loadImages() {
        fetch('/img/images', { credentials: 'include' })
        .then(response => response.json())
        .then(data => {
            const imagesList = document.getElementById('imagesList');
            imagesList.innerHTML = '';  // Clear previous images
            data.forEach(filename => {
                const imageUrl = `/images/${filename}`;
                const img = document.createElement('img');
                img.src = imageUrl;
                img.alt = filename;
                img.className = 'image-item img-thumbnail';
                img.addEventListener('click', function() {
                    insertImageToTextarea(imageUrl);
                });
                imagesList.appendChild(img);
            });
        })
        .catch(error => console.error('Error loading images:', error));
    }

    // Event listener to open the image gallery modal
    document.getElementById('insertImageFromGallery').addEventListener('click', function() {
        loadImages();  // Load images when the button is clicked
        $('#imageGalleryModal').modal('show');  // Show the modal
    });

    // Event listener for the image upload form
    document.getElementById('uploadForm').addEventListener('submit', function(e) {
        e.preventDefault();

        var formData = new FormData(this);

        fetch('/img/upload', {
            method: 'POST',
            body: formData,
            credentials: 'include' // Include cookies in the request
        })
        .then(response => response.json())
        .then(data => {
            var uploadStatus = document.getElementById('uploadStatus');
            uploadStatus.innerHTML = '<div class="alert alert-' + (data.status === 'success' ? 'success' : 'danger') + '">' + data.message + '</div>';
            if (data.status === 'success') {
                loadImages(); // Reload images after successful upload
            }
        })
        .catch(error => {
            console.error('Error:', error);
            document.getElementById('uploadStatus').innerHTML = '<div class="alert alert-danger">An error occurred while uploading the file.</div>';
        });
    });
});
