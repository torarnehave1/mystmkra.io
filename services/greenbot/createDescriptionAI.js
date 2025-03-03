import OpenAI from 'openai';
import config from '../../config/config.js';

const openai = new OpenAI({
  apiKey: config.openaiApiKey,
});

/**
 * Removes HTML tags and specific signs from a given text.
 *
 * @param {String} text - The text to sanitize.
 * @returns {String} The sanitized text without HTML tags and specific signs.
 */
function sanitizeText(text) {
  text = text.replace(/<\/?[^>]+(>|$)/g, ""); // Remove HTML tags
  text = text.replace(/["/]/g, ""); // Remove " and /
  return text;
}

/**
 * Generates a detailed process description based on the process title.
 *
 * @param {String} processId - The process ID.
 * @param {String} title - The title of the process.
 * @returns {String} The AI-generated process description (plain text), limited to 1023 characters.
 */
export async function handleCreateDescriptionAI(processId, title) {
  const systemMessage = `You are an AI that generates detailed process descriptions for business processes.
Given a process title, produce a comprehensive, clear, and engaging description that outlines the purpose, key elements, and value proposition of the process.
Title: "${title}"
Return only a pure text message without any markdown or formatting.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: `Generate a process description for: "${title}".` }
      ],
      temperature: 0.7,
      max_tokens: 600,
    });
    let description = response.choices[0].message.content.trim();
    // Sanitize the description.
    description = sanitizeText(description);
    // Limit the description to 1023 characters.
    if (description.length > 900) {
      description = description.substring(0, 900);
    }
    return description;
  } catch (error) {
    console.error(`[ERROR] Failed to generate description: ${error.message}`);
    throw error;
  }
}
