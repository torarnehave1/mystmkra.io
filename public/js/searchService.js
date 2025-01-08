export async function searchFiles(query) {
    try {
        const response = await fetch(`/dropbox/search?query=${encodeURIComponent(query)}`);
        if (!response.ok) {
            throw new Error('Error searching files');
        }
        return await response.json();
    } catch (error) {
        console.error('Error:', error);
        throw error;
    }
}
