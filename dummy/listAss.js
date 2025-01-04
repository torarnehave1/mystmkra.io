import OpenAI from 'openai';
import dotenv from 'dotenv';

import { connect } from 'mongoose';
import Assistant from '../models/assitants.js'; // Import the Assistant model

dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

connect(process.env.MONGO_DB_URL)
  .then(() => console.log('Connected to MongoDB with Mongoose'))
  .catch(err => console.error('Could not connect to MongoDB', err));

async function main() {
  const myAssistants = await openai.beta.assistants.list({
    order: "desc",
    limit: "20",
  });

  for (const assistant of myAssistants.data) {
    // Ensure tools is an array of strings
    if (assistant.tools && !Array.isArray(assistant.tools)) {
      assistant.tools = assistant.tools.map(tool => tool.type);
    }

    try {
      await Assistant.updateOne(
        { id: assistant.id },
        { $set: {
            ...assistant,
            tools: assistant.tools.map(tool => tool.toString()) // Ensure tools are strings
          }
        },
        { upsert: true } // Create a new document if it doesn't exist
      );
    } catch (error) {
      console.error(`Error updating assistant with ID ${assistant.id}:`, error);
    }
  }

  console.log('Assistants have been updated in the database.');
}

main();
