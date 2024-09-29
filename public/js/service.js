(function () {
    // Function to load the registration form into the target container
    function loadForm(serviceUrl, containerId, tag) {
        fetch(`${serviceUrl}/a/register-form?tag=${encodeURIComponent(tag)}`)
            .then(response => response.text())
            .then(formHTML => {
                // Find the target container where the form will be embedded
                var container = document.getElementById(containerId);
                if (container) {
                    container.innerHTML = formHTML;
                } else {
                    console.error("Container with ID " + containerId + " not found.");
                }
            })
            .catch(error => console.error("Error loading form:", error));
    }

    // Automatically execute when the script is loaded
    document.addEventListener("DOMContentLoaded", function () {
        // Get script tag with src="myservice.js"
        var scriptTag = document.querySelector('script[src*="myservice.js"]');
        
        // Get custom attributes from the script tag (e.g., serviceUrl, containerId, and tag)
        var serviceUrl = scriptTag.getAttribute('data-service-url') || 'https://mystmkra.io';
        var containerId = scriptTag.getAttribute('data-container-id') || 'formContainer';
        var tag = scriptTag.getAttribute('data-tag') || 'defaultTag';

        // Load the form into the specified container
        loadForm(serviceUrl, containerId, tag);
    });
})();
