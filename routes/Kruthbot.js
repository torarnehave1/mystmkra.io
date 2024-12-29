// Import dependencies
import TelegramBot from 'node-telegram-bot-api';
import express from 'express';
import dotenv from 'dotenv';
import generateOpenAIResponseforKruthBot from '../services/RuthBothOpenAiQuestions.js';
import logMessage from '../services/logMessage.js';
import config from '../config/config.js'; // Import config.js

// Load environment variables from .env file
dotenv.config();

// Log the current environment
console.log(`Environment: ${config.NODE_ENV}`);

// Access the Telegram bot token based on the environment
const TELEGRAM_BOT_TOKEN = config.NODE_ENV === 'production'
    ? process.env.TELEGRAM_BOT3_TOKEN_PROD // Production token
    : process.env.TELEGRAM_BOT3_TOKEN_DEV; // Development token

if (!TELEGRAM_BOT_TOKEN) {
    console.error('Error: Telegram bot token is not set in the environment variables.');
    process.exit(1); // Exit the process if the bot token is missing
}

console.log(`Telegram Bot Token for Kruth: ${TELEGRAM_BOT_TOKEN}`);
let bot;

if (config.NODE_ENV === 'production') {
    // Create a Telegram bot instance using webhook
    bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { webHook: true });

    // Set the webhook URL
    const WEBHOOK_URL = `${config.webhookBaseUrl3}/bot${TELEGRAM_BOT_TOKEN}`;

    // Delete the existing webhook before setting a new one
    bot.deleteWebHook()
        .then(() => {
            console.log('Existing webhook deleted.');
            return bot.setWebHook(WEBHOOK_URL);
        })
        .then(() => {
            console.log(`Webhook set to ${WEBHOOK_URL}`);
        })
        .catch((error) => {
            console.error(`Error setting webhook: ${error.message}`);
        });
} else {
    // Create a Telegram bot instance using polling
    bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

    // Handle polling errors globally
    bot.on('polling_error', (error) => {
        console.error('Polling error occurred:', error.message);
    });
}

// Bot logic: handle all incoming messages
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;

    try {
        // Log the incoming message
        await logMessage(msg);

        if (msg.text) {
            // Generate a response from OpenAI
            const openAIResponse = await generateOpenAIResponseforKruthBot(msg.text);

            // Log the outgoing message
            await logMessage({
                chat: { id: chatId },
                text: openAIResponse,
                from: { is_bot: true },
            });

            // Send the OpenAI response to the user
            await bot.sendMessage(chatId, openAIResponse);
        } else {
            console.log('Unsupported message type.');
            const unsupportedMessage = 'Sorry, I only understand text messages.';
            
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
const telegramRouter3 = express.Router();

if (config.NODE_ENV === 'production') {
    // Endpoint to handle incoming webhook requests
    telegramRouter3.post(`/bot${TELEGRAM_BOT_TOKEN}`, (req, res) => {
        console.log('Received webhook request:', req.body); // Log the incoming webhook request
        bot.processUpdate(req.body);
        res.sendStatus(200);
    });
}

// Endpoint to check bot status
telegramRouter3.get('/status', (req, res) => {
    try {
        res.json({ status: 'Bot is running', uptime: process.uptime(), environment: config.NODE_ENV });
    } catch (error) {
        console.error('Error retrieving bot status:', error.message);
        res.status(500).json({ error: 'Unable to retrieve bot status' });
    }
});

// Export the router for use in the main app
export default telegramRouter3;
