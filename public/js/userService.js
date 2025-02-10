async function fetchUserId() {
    if (typeof localStorage === 'undefined' || !localStorage) {
        console.error('Local storage is not available in this context.');
        return;
    }

    try {
        const response = await fetch('/dropbox/get-user-id', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('jwtToken')}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            setUserId(data.userId); // Store the user ID using the previously defined function
        } else if (response.status === 401) {
            // Handle unauthorized access, e.g., redirect to login
            window.location.href = '/login.html?message=session_expired';
        } else {
            console.error('Failed to fetch user ID');
        }
    } catch (error) {
        console.error('Error fetching user ID:', error);
    }
}

function setUserId(userId) {
    if (typeof localStorage === 'undefined' || !localStorage) {
        console.error('Local storage is not available in this context.');
        return;
    }

    if (!userId) {
        console.error('No user ID provided');
        return;
    }
    localStorage.setItem('userId', userId);
    console.log(`User ID set to: ${userId}`);
}

async function updateLoggedInStatus() {
    if (typeof localStorage === 'undefined' || !localStorage) {
        console.error('Local storage is not available in this context.');
        return;
    }

    try {
        const response = await fetch('/dropbox/protected', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('jwtToken')}`
            }
        });

        if (response.status === 401) {
            const data = await response.json();
            if (data.redirect) {
                window.location.href = '/login.html?message=session_expired';
            } else {
                alert(data.message || 'Unauthorized access.');
            }
            return;
        }

        if (response.ok) {
            const text = await response.text();
            document.getElementById('loggedinas').innerText = text;
        } else {
            document.getElementById('loggedinas').innerText = 'Failed to retrieve user information.';
        }
    } catch (error) {
        console.error('Error fetching authentication status:', error);
        document.getElementById('loggedinas').innerText = 'Error fetching authentication status.';
    }
}

function initializeUser() {
    if (typeof localStorage !== 'undefined' && localStorage) {
        fetchUserId();
        updateLoggedInStatus(); // Ensure this function is called to set the logged-in status
        const logoutButton = document.querySelector('a.nav-link[onclick="logout()"]');
        if (logoutButton) {
            logoutButton.addEventListener('click', logout);
        }
    } else {
        console.error('Local storage is not available in this context.');
    }
}

// Attach initializeUser to the window object
window.initializeUser = initializeUser;

function logout() {
    if (typeof localStorage !== 'undefined' && localStorage) {
        localStorage.removeItem('jwtToken');
        localStorage.removeItem('userId');
        window.location.href = '/login.html?message=logged_out';
    } else {
        console.error('Local storage is not available in this context.');
    }
}
