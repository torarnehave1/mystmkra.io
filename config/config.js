// Import dependencies
import TelegramBot from 'node-telegram-bot-api';
import express from 'express';
import dotenv from 'dotenv';
import generateOpenAIResponse from '../services/openAIService.js';
import analyzePhotoAndText from '../services/photoTextAnalysis.js';
import searchDocuments from '../services/documentSearchService.js';
import OpenAI from 'openai';
import mongoose from 'mongoose';
import Mdfiles from '../models/Mdfiles.js';
import logMessage from '../services/logMessage.js';
import config from '../config.js'; // Import config.js

// Load environment variables from .env file
dotenv.config();

// Log the current environment
console.log(`Environment: ${config.NODE_ENV}`);

// Access the Telegram bot token based on the environment
const TELEGRAM_BOT_TOKEN = config.NODE_ENV === 'production'
    ? process.env.TELEGRAM_BOT1_TOKEN_PROD // Production token
    : process.env.TELEGRAM_BOT1_TOKEN_DEV; // Development token

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

// OpenAI initialization
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

let currentThreadId = null; // In-memory store for the current thread ID

// Function to perform document search
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
            { $limit: 10 }, // Limit to top 10 most similar documents
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

// Bot logic: handle all incoming messages
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;

    try {
        // Log the incoming message
        await logMessage(msg);

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

            // Log the outgoing message
            await logMessage({
                chat: { id: chatId },
                text: analysisResult,
                from: { is_bot: true },
            });

            // Send the analysis result back to the user
            await bot.sendMessage(chatId, analysisResult);
        } else if (msg.text) {
            // Log the incoming text message
            await logMessage(msg);

            // Perform a search for the provided text
            const documents = await performSearch(msg.text);

            // Check if any documents were found
            if (documents.length === 0) {
                const noDocsMessage = 'No relevant documents found.';
                
                // Log the outgoing message
                await logMessage({
                    chat: { id: chatId },
                    text: noDocsMessage,
                    from: { is_bot: true },
                });

                await bot.sendMessage(chatId, noDocsMessage);
            } else {
                // Format the documents into a readable string
                const formattedResponse = documents
                    .map((doc, index) => `${index + 1}. [${doc.title}](${doc.URL})`)
                    .join('\n');
                
                // Log the outgoing message
                await logMessage({
                    chat: { id: chatId },
                    text: formattedResponse,
                    from: { is_bot: true },
                });

                // Send the formatted response to the user
                await bot.sendMessage(chatId, formattedResponse, { parse_mode: 'Markdown' });
            }
        } else {
            console.log('Unsupported message type.');
            const unsupportedMessage = 'Sorry, I only understand text or photo messages.';
            
            // Log the outgoing message
            await logMessage({
                chat: { id: chatId },
                text: unsupportedMessage,
                from: { is_bot: true },
            });

            await bot.sendMessage(chatId, unsupportedMessage);
        }
    } catch (error) {
        console.error('Error processing message:', error.message);
        const errorMessage = 'An error occurred while processing your message. Please try again later.';
        
        // Log the outgoing error message
        await logMessage({
            chat: { id: chatId },
            text: errorMessage,
            from: { is_bot: true },
        });

        await bot.sendMessage(chatId, errorMessage);
    }
});

// Express router for Telegram-related routes
const telegramRouter = express.Router();

// Endpoint to check bot status
telegramRouter.get('/status', (req, res) => {
    try {
        res.json({ status: 'Bot is running', uptime: process.uptime(), environment: config.NODE_ENV });
    } catch (error) {
        console.error('Error retrieving bot status:', error.message);
        res.status(500).json({ error: 'Unable to retrieve bot status' });
    }
});

// Export the router for use in the main app
export default telegramRouter;
