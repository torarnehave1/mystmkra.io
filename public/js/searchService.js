export async function searchFiles(query) {
    try {
        const response = await fetch(`/dropbox/search?query=${encodeURIComponent(query)}`);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Error searching files: ${errorText}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error searching files:', error);
        if (error.message.includes('Initialization failed')) {
            alert('Initialization failed! Please try again later.');
        }
        throw error;
    }
}
