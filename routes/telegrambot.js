// Import dependencies
import TelegramBot from 'node-telegram-bot-api';
import express from 'express';
import dotenv from 'dotenv';
import generateOpenAIResponse from '../services/openAIService.js';
import analyzePhotoAndText from '../services/photoTextAnalysis.js';
import  searchDocuments  from '../services/documentSearchService.js';
import OpenAI from 'openai';
import mongoose from 'mongoose';
import Mdfiles from '../models/Mdfiles.js';



// Load environment variables from .env file
dotenv.config();

// Access the Telegram bot token from the environment variables
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT1_TOKEN;

if (!TELEGRAM_BOT_TOKEN) {
    console.error('Error: Telegram bot token is not set in the environment variables.');
    process.exit(1); // Exit the process if the bot token is missing
}

// Create a Telegram bot instance using polling
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

// Handle polling errors globally
bot.on('polling_error', (error) => {
    console.error('Polling error occurred:', error.message);
});


const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

let currentThreadId = null;  // In-memory store for the current thread ID

const performSearch = async (query) => {
    try {
        // Generate embedding for the query
        const queryEmbedding = await generateEmbedding(query);

        // Ensure the embedding is valid
        if (!Array.isArray(queryEmbedding) || !queryEmbedding.every(item => typeof item === 'number')) {
            throw new Error('Invalid query embedding format.');
        }

        // Find documents with similar embeddings
        const documents = await Mdfiles.aggregate([
            {
                $addFields: {
                    similarity: {
                        $let: {
                            vars: {
                                queryVector: queryEmbedding,
                                docVector: '$embeddings',
                            },
                            in: {
                                $reduce: {
                                    input: { $range: [0, { $size: '$$queryVector' }] },
                                    initialValue: 0,
                                    in: {
                                        $add: [
                                            '$$value',
                                            {
                                                $multiply: [
                                                    { $arrayElemAt: ['$$queryVector', '$$this'] },
                                                    { $arrayElemAt: ['$$docVector', '$$this'] },
                                                ],
                                            },
                                        ],
                                    },
                                },
                            },
                        },
                    },
                },
            },
            { $sort: { similarity: -1 } },
            { $limit: 10 }, // Limit to top 5 most similar documents
            {
                $project: {
                    _id: 0, // Exclude the _id field
                    title: 1, // Include the title field
                    URL: 1, // Include the URL field
                },
            },
        ]);

        return documents.map(doc => ({
            title: doc.title || 'Untitled',
            URL: doc.URL || 'No URL available',
        }));
    } catch (err) {
        console.error('Error performing search:', err);
        throw err;
    }
};








/**
 * Function to generate embeddings using OpenAI
 * @param {string} text - The text content to generate embeddings for
 * @returns {Array} - The generated embedding
 */
async function generateEmbedding(text) {
    if (!text || typeof text !== 'string') {
        throw new Error('Input text is required and must be a non-empty string.');
    }
    try {
        const response = await openai.embeddings.create({
            model: 'text-embedding-ada-002',
            input: text,
        });
        return response.data[0].embedding;
    } catch (error) {
        console.error('Error generating embedding:', error.message);
        throw error;
    }
}


// Bot logic: handle all incoming messages
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;

    try {
        if (msg.photo && Array.isArray(msg.photo) && msg.photo.length > 0) {
            console.log('Photo detected in the message.');

            // Extract the highest resolution photo (last in the array)
            const photoId = msg.photo[msg.photo.length - 1].file_id;

            // Retrieve the file path for the photo
            const file = await bot.getFile(photoId);
            const photoUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${file.file_path}`;

            console.log(`Photo URL: ${photoUrl}`);

            // Use the caption if provided, or an empty string otherwise
            const caption = msg.caption || '';

            console.log(`Caption: ${caption}`);

            // Analyze the photo and caption
            const analysisResult = await analyzePhotoAndText(TELEGRAM_BOT_TOKEN, msg);

            // Send the analysis result back to the user
            await bot.sendMessage(chatId, analysisResult);
        } else if (msg.text) {
           
            //I want to check if the message contains the word mystmkra.io

           
                const documents = await performSearch(msg.text);

                // Check if any documents were found
                if (documents.length === 0) {
                    await bot.sendMessage(chatId, 'No relevant documents found.');
                } else {
                    // Format the documents into a readable string
                    const formattedResponse = documents
                        .map((doc, index) => `${index + 1}. [${doc.title}](${doc.URL})`)
                        .join('\n');
    
                    // Send the formatted response to the user
                    await bot.sendMessage(chatId, formattedResponse, { parse_mode: 'Markdown' });
                
            

        

            //generateOpenAIResponse
            //const response = await generateOpenAIResponse(msg.text);
           // await bot.sendMessage(chatId, response);



        }

            // Perform a search for the provided text
           
        } else {
            console.log('Unsupported message type.');
            await bot.sendMessage(chatId, 'Sorry, I only understand text or photo messages.');
        }
    } catch (error) {
        console.error('Error processing message:', error.message);
        await bot.sendMessage(chatId, 'An error occurred while processing your message. Please try again later.');
    }
});



// Express router for Telegram-related routes
const telegramRouter = express.Router();

// Endpoint to check bot status
telegramRouter.get('/status', (req, res) => {
    try {
        res.json({ status: 'Bot is running', uptime: process.uptime() });
    } catch (error) {
        console.error('Error retrieving bot status:', error.message);
        res.status(500).json({ error: 'Unable to retrieve bot status' });
    }
});

// Export the router for use in the main app
export default telegramRouter;
