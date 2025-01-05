import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function generateDescription(name, model, instructions, currentDescription) {
    try {
        const prompt = `Generate a description for an assistant named "${name}" using the model "${model}" with the following instructions: "${instructions}". Current description: "${currentDescription}".`;

        const response = await openai.completions.create({
            model: 'text-davinci-003',
            prompt: prompt,
            max_tokens: 150,
        });

        if (response.choices && response.choices.length > 0) {
            return response.choices[0].text.trim();
        } else {
            throw new Error('No description generated');
        }
    } catch (error) {
        console.error('Error generating description:', error);
        throw error;
    }
}
