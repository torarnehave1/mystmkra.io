async function searchFiles(query) {
    try {
        const response = await fetch(`/search?q=${encodeURIComponent(query)}`);
        if (!response.ok) {
            throw new Error('Failed to search files');
        }
        return await response.json();
    } catch (error) {
        console.error('Error searching files:', error);
        throw error;
    }
}
