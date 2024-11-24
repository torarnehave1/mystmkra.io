// Import OpenAI and Axios
import OpenAI from "openai";
import axios from "axios";

// Initialize OpenAI client
const openai = new OpenAI();

/**
 * Analyze photo and text using OpenAI's GPT-4 model.
 * @param {string} botToken - Telegram bot token.
 * @param {object} message - Telegram message object containing photo and/or text.
 * @returns {string} - The analysis result from OpenAI.
 */


export default async function analyzePhotoAndText(botToken, message) {
    try {
        // Step 1: Extract the photo URL from Telegram
        const fileId = message.photo?.[message.photo.length - 1]?.file_id;
        if (!fileId) {
            throw new Error("No image found in the message.");
        }

        const fileResponse = await axios.get(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
        const filePath = fileResponse.data.result.file_path;
        const imageUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;

        // Step 2: Prepare the text content (if any)
        const textContent = message.caption || "Analyze this image.";

        // Step 3: Call OpenAI for analysis
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: textContent },
                        { type: "image_url", image_url: { url: imageUrl } },
                    ],
                },
            ],
        });

        // Step 4: Extract and return OpenAI's analysis
        return response.choices[0].message.content;

    } catch (error) {
        console.error("Error analyzing photo and text:", error.message || error.response?.data);
        throw new Error("Failed to analyze the image and text.");
    }
}
