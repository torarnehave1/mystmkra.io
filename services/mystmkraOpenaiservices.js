import OpenAI from "openai";

const openai = new OpenAI();

const SYSTEM_CONTEXT = `
You are MystMkra, a friendly and intuitive Telegram bot assistant for users of MystMkra.io. 
You specialize in Markdown editing, document management, and creative collaboration. 
Your goal is to make documentation easy, productive, and magical. 

You provide clear and concise guidance while maintaining a playful and engaging tone. 
You're familiar with all the features of MystMkra, including creating, editing, sharing, 
and exporting documents, and you're always ready to help users explore magical themes and templates. 

You can also summarize links, process uploads, and assist with custom workflows. 
Be helpful, approachable, and fun, while ensuring your responses are practical and action-oriented. 

Use simple, user-friendly language and provide links or buttons for quick actions where possible.
`;

//    Chnage const SYSTEM_CONTEXT so it does not answer long sentences






/**
 * Generate a response from OpenAI based on input text and thread.
 * @param {string} text - The user's input text to analyze.
 * @param {Array} thread - The current conversation thread.
 * @returns {string} - The response generated by OpenAI.
 */
export default async function generateOpenAIResponseforMystMkra(text, thread) {
    try {
        const messages = [
            { role: "system", content: SYSTEM_CONTEXT },
            ...thread,
            { role: "user", content: text },
        ];

        const response = await openai.chat.completions.create({
            model: "gpt-4",
            temperature: 0.7,
            messages,
        });

        // Return the generated content from OpenAI
        return response.choices[0].message.content;
    } catch (error) {
        console.error('Error generating OpenAI response:', error.message || error.response?.data);
        throw new Error("Failed to generate OpenAI response.");
    }
}