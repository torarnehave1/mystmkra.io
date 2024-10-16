document.addEventListener('DOMContentLoaded', function() {
    const toggleSidebarBtn = document.getElementById('toggleSidebarBtn');
    const sidebar = document.getElementById('sidebar');
    const contentArea = document.querySelector('.content-area');

    // Add an event listener to the toggle button to hide/show the sidebar and adjust content area
    toggleSidebarBtn.addEventListener('click', function() {
        sidebar.classList.toggle('sidebar-hidden');
        contentArea.classList.toggle('content-expanded'); // Toggle the left margin of the content area
    });
});
