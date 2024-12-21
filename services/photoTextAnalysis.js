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
        const fileId = message.photo?.[message.photo.length - 1]?.file_id;
        if (!fileId) {
            throw new Error("No image found in the message.");
        }

        const fileResponse = await axios.get(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
        const filePath = fileResponse.data.result.file_path;
        const imageUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;

        const textContent = message.caption || "Analyser dette bilde og gi en rapport på det som vises.";

        if (!textContent.includes("Livskraft på Tallerken")) {
            console.log("The required phrase 'Livskraft på Tallerken' is missing. Skipping analysis.");
            return `"Livskraft på Tallerken" må være en del av meldingen for å utføre analysen. Vennligst legg til dette i bildeteksten din.`;
        }

        // Updated OpenAI prompt
        const response = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                {
                    role: "system",
                    content: `Du er en ernæringsfaglig assistent som lager omfattende rapporter for måltider. Generer en Tittel basert på innholdet tittelen skal være formatert med 1 # som i heading1 ikke bruk ordet Tittel , kun ditt forslag til tittel, Strukturer rapporten basert på denne malen:
                    - Introduksjon
                    - Beskrivelse av Retten
                    - Næringsanalyse
                    - Retten Fordeler
                    - Muligheter for Forbedring
                    - Klarhet og Livskraft
                    - Refleksjon og Brukeropplevelse
                    - Utforsking og Neste Steg
                    Bruk følgende kriterier for poengsetting på en skala fra 1 til 10:
                    **Klarhet**:
                    - Økologisk mat og gressfôrede dyr gir høyere score.
                    - Minimalt bearbeidede råvarer gir høyere score.
                    - Hurtigbearbeidet mat, tilsetningsstoffer (E-stoffer, søtningsstoffer) trekker ned.
                    - Anta at ost, leverpostei, og brød er bearbeidet.
                    - Inkluder en forklaring for hver score du setter.

                    **Livskraft**:
                    - Høy næringstetthet fra naturlige kilder (vitaminer, mineraler) gir høyere score.
                    - Sunt fett (olivenolje, avokado), gressfôret kjøtt og ferske økologiske grønnsaker gir høyere score.
                    - Raffinerte karbohydrater og usunt fett trekker ned.
                    - Sukkerholdige drikker, bearbeidet mat, og hurtigmat trekker ned.
                    - Koffeinholdige drikker trekker ned.
                    Inkluder en forklaring for hver score du setter.`,
                },
                {
                    role: "user",
                    content: textContent,
                },
                {
                    role: "user",
                    content: imageUrl,
                },
            ],
        });

        const analysisContent = response.choices[0].message.content;

        const closingStatement = `
        "Livskraft på Tallerkenen" handler om å velge mat og drikke som gir næring til både kropp, sinn og sjel.
        Takk for at du deler med oss i AlivenessLAβ Klarhet og Livskraft Challenge!`;

        return `${analysisContent}\n\n${closingStatement}`;

    } catch (error) {
        console.error("Error analyzing photo and text:", error.message || error.response?.data);
        throw new Error("Failed to analyze the image and text.");
    }
}


