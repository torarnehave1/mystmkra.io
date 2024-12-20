
import axios from 'axios';

const getChatHistory = async (token, chatId) => {
    const url = `https://api.telegram.org/bot${token}/getChatHistory`;
    try {
        const response = await axios.post(url, { chat_id: chatId });
        if (response.data.ok) {
            return response.data.result;
        } else {
            throw new Error('Failed to fetch chat history');
        }
    } catch (error) {
        console.error('Error fetching chat history:', error.message);
        throw error;
    }
};

export default getChatHistory;