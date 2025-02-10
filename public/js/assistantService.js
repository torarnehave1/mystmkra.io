export async function fetchAssistantDetails(assistantId) {
    try {
        const response = await fetch(`/adb/assistants/${assistantId}`);
        if (!response.ok) {
            throw new Error('Failed to fetch assistant details');
        }
        const data = await response.json();
        if (data.success) {
            document.getElementById('assistantDiv').classList.remove('hidden');
            document.getElementById('assistantTextarea').placeholder = `Write your prompt for @${data.assistant.name} here...`;
            
            // Fetch the assistant image
            const imageResponse = await fetch(`/adb/assistant-image/${assistantId}`);
            if (!imageResponse.ok) { 
                throw new Error('Failed to fetch assistant image');
            }
            const imageData = await imageResponse.json();
            document.getElementById('assistantImage').src = imageData.imageUrl;
        }
    } catch (error) {
        console.error('Error fetching assistant details:', error);
    }
}

export function setCurrentAssistantId(id) {
    document.cookie = `currentAssistantId=${id}; path=/; max-age=31536000`; // Expires in 1 year
console.log('currentAssistantId:', id);
}

export function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

export function initializeAssistant() {
    document.addEventListener('DOMContentLoaded', () => {
        const currentAssistantId = getCookie('currentAssistantId');
        if (currentAssistantId) {
            fetchAssistantDetails(currentAssistantId);
        }
    });

    document.querySelector('a[href="#content"]').addEventListener('click', () => {
        const currentAssistantId = getCookie('currentAssistantId');
        if (currentAssistantId) {
            fetchAssistantDetails(currentAssistantId);
        }
    });
}
