import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Use your environment variable
});

async function main() {
  try {
    const list = await openai.files.list();

    for await (const file of list) {
      console.log(file);
    }
  } catch (error) {
    console.error("Error fetching files:", error);
  }
}

main();
