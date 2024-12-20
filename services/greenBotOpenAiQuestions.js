
import OpenAI from 'openai';

// Initialize OpenAI with your API key
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Function to generate a response from OpenAI for GreenBot
async function generateOpenAIResponseforGreenBot(question) {
    try {
        const response = await openai.completions.create({
            model: 'text-davinci-003',
            prompt: question,
            max_tokens: 150,
        });
        return response.choices[0].text.trim();
    } catch (error) {
        console.error('Error generating OpenAI response:', error.message);
        throw error;
    }
}

export default generateOpenAIResponseforGreenBot;