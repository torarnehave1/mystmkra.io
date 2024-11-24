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
        const textContent = message.caption || "";

        // Step 3: Check for the required phrase
        if (!textContent.includes("Livskraft på Tallerken")) {
            console.log("The required phrase 'Livskraft på Tallerken' is missing. Skipping analysis.");
            return `"Livskraft på Tallerken" må være en del av meldingen for å utføre analysen. Vennligst legg til dette i bildeteksten din.`;
        }

        // Step 4: Call OpenAI for analysis
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: `Du er en ernæringsfaglig assistent som lager omfattende rapporter for måltider. Strukturer rapporten basert på denne malen:
                    - Tittel og Introduksjon
                    - Beskrivelse av Retten
                    - Næringsanalyse
                    - Retten Fordeler
                    - Muligheter for Forbedring
                    - Klarhet og Livskraft
                    - Refleksjon og Brukeropplevelse
                    - Utforsking og Neste Steg
                    Inkluder detaljer om næringsinnhold, kalorier, og balanse mellom ingredienser.`,
                },
                {
                    role: "user",
                    content: [
                        { type: "text", text: textContent },
                        { type: "image_url", image_url: { url: imageUrl } },
                    ],
                },
            ],
        });

        // Step 5: Extract the OpenAI analysis and append the closing statement
        const analysisContent = response.choices[0].message.content;

        const closingStatement = `
        "Livskraft på Tallerkenen" handler om å velge mat og drikke som gir næring til både kropp, sinn og sjel.
        Takk for at du deler med oss i AlivenessLAβ Klarhet og Livskraft Challenge!`;

        // Combine the analysis and the closing statement
        return `${analysisContent}\n\n${closingStatement}`;

    } catch (error) {
        console.error("Error analyzing photo and text:", error.message || error.response?.data);
        throw new Error("Failed to analyze the image and text.");
    }
}

