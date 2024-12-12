// Import OpenAI and Axios
import OpenAI from "openai";
import axios from "axios";

// Initialize OpenAI client
const openai = new OpenAI();

/**
 * Analyze a conversation between Mentor and Participant using OpenAI's GPT-4 model and integrates with Telegram Bot API.
 * @param {string} botToken - Telegram bot token.
 * @param {object} message - Telegram message object containing transcription or related data.
 * @returns {string} - The analysis result from OpenAI.
 */
export default async function analyzeConversation(botToken, message) {
    try {
        const transcription = message.text || "Ingen transkripsjon tilgjengelig i meldingen.";

        if (!transcription.includes("//MENTOR")) {
            console.log("The required phrase '//MENTOR' is missing. Skipping analysis.");
            return `\"//MENTOR\" må være en del av meldingen for å utføre analysen. Vennligst legg til dette i meldingen din.`;
        }

        // Updated OpenAI prompt
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: `For å få denne typen detaljerte og innsiktsfulle svar fra ChatGPT, kan du bruke følgende forslag til promt for ulike deler av samtaleanalysen:

---

### 1. Generell Oppsummering
**Prompt:**
"Analyser denne samtalen mellom en mentor og en deltaker. Oppsummer hovedtemaene, koblingen mellom de ulike delene av samtalen, og den overordnede innsikten. Forslag en tittel som gjenspeiler samtalens kjerne."

---

### 2. Identifisering av Gullkorn
**Prompt:**
"Identifiser gullkorn fra både mentor og deltaker i denne samtalen. Kommenter hvorfor disse uttalelsene er spesielt innsiktsfulle eller betydningsfulle, og hvordan de kan påvirke deltakerens utvikling. Ta med konkrete eksempler og reflekter over relevansen."

---

### 3. Selvrefleksjon og Feiringer
**Prompt:**
"Analyser deltakerens refleksjoner i samtalen. Identifiser områder der de viser økt selvforståelse eller feirer personlige gjennombrudd. Beskriv hvordan disse innsiktene kan bidra til videre vekst."

---

### 4. Temaer som Kan Utforskes Videre
**Prompt:**
"Er det noen temaer i denne samtalen som fortjener videre utforsking? Lag en kort liste over spesifikke temaer og hvordan de kan utdypes i en fremtidig samtale eller rapport."

---

### 5. Ressurser og Prinsipper
**Prompt:**
"Basert på temaene i denne samtalen, foreslå relevante ressurser, bøker, eller artikler som kan støtte deltakeren i videre refleksjon. Fokuser på prinsipper som SlowYou, Tre prinsipper, og Advaita Vedanta."

---

### 6. Hvordan En Spesifikk Praksis Kan Hjelpe
**Prompt:**
"Beskriv hvordan SlowYou-prinsipper og øvelser kan være nyttige for denne deltakeren basert på samtalen. Foreslå konkrete bioenergetiske øvelser eller refleksjoner som kan støtte dem."

---

### 7. Metaforer og Språklige Bilder
**Prompt:**
"Se etter metaforer eller språklige bilder som deltaker eller mentor bruker i samtalen. Forklar hvordan disse kan gi innsikt i deres perspektiv og følelser, og hvordan de kan brukes til videre refleksjon."

---

### 8. Fremheving av Indre Dynamikk
**Prompt:**
"Analyser hvordan deltakerens indre dynamikk, som tanker og følelser, utvikler seg gjennom samtalen. Identifiser spesifikke øyeblikk hvor deltaker viser ny forståelse eller endret perspektiv."

---

Med disse promtene kan du få svar som dykker dypt inn i samtalens innhold og gir reflekterte analyser og praktiske forslag. Du kan også kombinere flere av disse for å dekke ulike aspekter.`
                },
                {
                    role: "user",
                    content: `${transcription}`
                }
            ],
        });

        const analysisContent = response.choices[0].message.content;

        const closingStatement = `**[Join AlivenessLAβ on Telegram](https://t.me/+zcY08tT_g75iZDk0)**`;

        return `${analysisContent}\n\n${closingStatement}`;
    } catch (error) {
        console.error("Error analyzing conversation:", error.message || error.response?.data);
        throw new Error("Failed to analyze the conversation.");
    }
}

/**
 * Analyze text using OpenAI's GPT-4 model.
 * @param {string} text - The text to analyze.
 * @returns {string} - The analysis result from OpenAI.
 */
export async function analyzeText(text) {
    try {
        if (!text.includes("//MENTOR")) {
            console.log("The required phrase '//MENTOR' is missing. Skipping analysis.");
            return `\"//MENTOR\" må være en del av meldingen for å utføre analysen. Vennligst legg til dette i meldingen din.`;
        }

        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: `For å få denne typen detaljerte og innsiktsfulle svar fra ChatGPT, kan du bruke følgende forslag til promt for ulike deler av samtaleanalysen:
                    <!-- ...existing prompt content... -->
                    `
                },
                {
                    role: "user",
                    content: `${text}`
                }
            ],
        });

        const analysisContent = response.choices[0].message.content;
        const closingStatement = `**[Join AlivenessLAβ on Telegram](https://t.me/+zcY08tT_g75iZDk0)**`;

        return `${analysisContent}\n\n${closingStatement}`;
    } catch (error) {
        console.error("Error analyzing text:", error.message || error.response?.data);
        throw new Error("Failed to analyze the text.");
    }
}
