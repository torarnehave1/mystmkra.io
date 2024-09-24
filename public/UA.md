<!-- Inside the <form> element, add a hidden input field -->
<input type="hidden" id="fromPage" name="fromPage" value="">

<script>
    // Set the value of the hidden field to the current page URL or a custom value
    document.getElementById('fromPage').value = window.location.href; // or any custom value

    async function registerUser() {
        if (!validatePassword()) return;

        const form = document.getElementById('registrationForm');
        const formData = new FormData(form);
        const messageDiv = document.getElementById('message');

        try {
            const baseUrl = window.location.protocol + '//' + window.location.host;
            const response = await fetch(baseUrl + '/a/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    fullName: formData.get('fullName'),
                    username: formData.get('username'),
                    password: formData.get('password'),
                    fromPage: formData.get('fromPage') // Include the fromPage value
                })
            });

            // The rest of your registerUser function remains unchanged
        } catch (err) {
            // Error handling remains unchanged
        }
    }
</script>