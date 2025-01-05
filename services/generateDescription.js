import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function generateDescription(name, model, instructions, currentDescription) {
    try {
        const messages = [
            {
                role: 'system',
                content: 'You are a helpful assistant.',
            },
            {
                role: 'user',
                content: `Generate a description for an assistant named "${name}" using the model "${model}" with the following instructions: "${instructions}". Current description: "${currentDescription}".`,
            },
        ];

        const response = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: messages,
            max_tokens: 1500,
        });

        if (response.choices && response.choices.length > 0) {
            return response.choices[0].message.content.trim();
        } else {
            throw new Error('No description generated');
        }
    } catch (error) {
        console.error('Error generating description:', error);
        throw error;
    }
}
