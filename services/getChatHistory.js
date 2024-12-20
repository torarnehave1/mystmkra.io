import axios from 'axios';

const getChatHistory = async (token, chatId) => {
    const url = `https://api.telegram.org/bot${token}/getUpdates`;
    try {
        const response = await axios.post(url, {
            timeout: 100,
            allowed_updates: ['message'],
        });
        if (response.data.ok) {
            // Filter messages by chat ID
            const chatHistory = response.data.result.filter(update => update.message.chat.id === parseInt(chatId));
            return chatHistory.map(update => update.message);
        } else {
            throw new Error('Failed to fetch chat history');
        }
    } catch (error) {
        if (error.response && error.response.status === 409) {
            console.error('Conflict error: Multiple instances of the bot may be running. This can happen if the bot is running on multiple servers or if there are multiple webhook configurations.');
            throw new Error('Conflict error: Please ensure only one instance of the bot is running. Check for multiple servers or webhook configurations.');
        } else if (error.response && error.response.status === 426) {
            throw new Error('Upgrade Required: Please check your Telegram Bot API access level.');
        } else {
            console.error('Error fetching chat history:', error.message);
            throw error;
        }
    }
};

export default getChatHistory;