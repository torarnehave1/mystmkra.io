// Import dependencies
import TelegramBot from 'node-telegram-bot-api';
import express from 'express';
import dotenv from 'dotenv';
import generateOpenAIResponseforMystMkra from '../services/mystmkraOpenaiservices.js';
import logMessage from '../services/logMessage.js';
import config from '../config/config.js'; // Import config.js
import { getThread, saveMessage, clearThread } from '../services/threadService.js'; // Import thread service
import { saveMarkdownFile, getMarkdownFileContent } from '../services/markdownService.js'; // Import markdown service

// Load environment variables from .env file
dotenv.config();

// Log the current environment
console.log(`Environment: ${config.NODE_ENV}`);

// Access the Telegram bot token based on the environment
const TELEGRAM_BOT_TOKEN = config.NODE_ENV === 'production'
    ? process.env.TELEGRAM_BOT4_TOKEN_PROD // Production token
    : process.env.TELEGRAM_BOT4_TOKEN_DEV; // Development token

if (!TELEGRAM_BOT_TOKEN) {
    console.error('Error: Telegram bot token is not set in the environment variables.');
    process.exit(1); // Exit the process if the bot token is missing
}

console.log(`Telegram Bot Token for MystMkra: ${TELEGRAM_BOT_TOKEN}`);
let bot;

if (config.NODE_ENV === 'production') {
    // Create a Telegram bot instance using webhook
    bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { webHook: true });

    // Set the webhook URL
    const WEBHOOK_URL = `${config.webhookBaseUrl4}/bot${TELEGRAM_BOT_TOKEN}`;

    // Delete the existing webhook before setting a new one
    bot.deleteWebHook()
        .then(() => {
            console.log('Existing webhook deleted.');
            return bot.setWebHook(WEBHOOK_URL);
        })
        .then(() => {
            console.log(`Webhook set to ${WEBHOOK_URL}`);
            return bot.getMe(); // Fetch bot information
        })
        .then((botInfo) => {
            bot.me = botInfo; // Store bot information
        })
        .catch((error) => {
            console.error(`Error setting webhook: ${error.message}`);
        });
} else {
    // Create a Telegram bot instance using polling
    bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

    // Fetch bot information
    bot.getMe()
        .then((botInfo) => {
            bot.me = botInfo; // Store bot information
        })
        .catch((error) => {
            console.error('Error fetching bot information:', error.message);
        });

    // Handle polling errors globally
    bot.on('polling_error', (error) => {
        console.error('Polling error occurred:', error.message);
    });
}

// Function to check if a string contains a URL
function containsURL(text) {
    const urlPattern = /(https?:\/\/[^\s]+)/g;
    return urlPattern.test(text);
}

// Function to truncate or summarize the conversation history
function truncateThread(thread, maxLength) {
    let totalLength = 0;
    const truncatedMessages = [];

    for (let i = thread.length - 1; i >= 0; i--) {
        const message = thread[i];
        totalLength += message.content.length;

        if (totalLength > maxLength) {
            break;
        }

        truncatedMessages.unshift(message);
    }

    return truncatedMessages;
}

// Bot logic: handle all incoming messages
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userName = msg.from.username || 'Unknown User'; // Get the username from the message
    const botName = bot.me?.username || 'MystmkraBot'; // Get the bot's username

    // Debug log to see the received message
    console.log('Received message:', msg);

    try {
        // Log the incoming message
        await logMessage(msg);

        if (msg.text) {
            if (msg.text.startsWith('SYOU:')) {
                const question = msg.text.replace('SYOU:', '').trim();

                // Determine the URL based on the environment
                const apiUrl = config.NODE_ENV === 'production'
                    ? `https://mystmakra.io/assistants/ask-assistant`
                    : `http://localhost:${process.env.PORT || 3001}/assistants/ask-assistant`;

                // Send the question to the /ask-assistant endpoint
                const response = await axios.post(
                    apiUrl,
                    { question },
                    {
                        headers: {
                            'Content-Type': 'application/json',
                        },
                    }
                );

                const assistantResponse = response.data.response;

                // Log the outgoing message
                await logMessage({
                    chat: { id: chatId },
                    text: assistantResponse,
                    from: { is_bot: true },
                });

                // Send the assistant's response to the user
                await bot.sendMessage(chatId, assistantResponse);
            } else {
                // Save the user's message to the thread with the role 'user'
                await saveMessage(chatId, 'user', msg.text, userName, botName);

                // Retrieve the current thread
                let thread = await getThread(chatId);

                // Truncate the thread to a manageable length
                thread = truncateThread(thread, 2000); // Adjust the maxLength as needed

                let openAIResponse;

                if (containsURL(msg.text)) {
                    // If the message contains a URL, summarize the content of the URL
                    openAIResponse = await generateOpenAIResponseforMystMkra(`Summarize the content of this URL: ${msg.text}. Focus on the most relevant information.`, thread);
                } else {
                    // Generate a response from OpenAI
                    openAIResponse = await generateOpenAIResponseforMystMkra(`${msg.text}. Focus on the most relevant information from the conversation.`, thread);
                }

                // Save the bot's response to the thread with the role 'assistant'
                await saveMessage(chatId, 'assistant', openAIResponse, userName, botName);

                // Log the outgoing message
                await logMessage({
                    chat: { id: chatId },
                    text: openAIResponse,
                    from: { is_bot: true },
                });

                // Send the OpenAI response to the user
                await bot.sendMessage(chatId, openAIResponse);
            }
        } else if (msg.document && msg.document.file_name.endsWith('.md')) {
            // Debug log for document upload
            console.log('Handling Markdown file upload:', msg.document);

            // Handle Markdown file upload
            const fileId = msg.document.file_id;
            const fileLink = await bot.getFileLink(fileId);
            console.log('File link:', fileLink); // Debug log for file link

            const markdownContent = await fetch(fileLink).then(res => res.text());
            console.log('Markdown content:', markdownContent); // Debug log for markdown content

            // Save the Markdown file content to MongoDB
            await saveMarkdownFile(chatId, markdownContent);

            // Add the Markdown content to the thread
            await saveMessage(chatId, 'user', markdownContent, userName, botName);

            const confirmationMessage = 'Markdown file received and saved. You can now ask questions about the document or request a summary.';
            
            // Log the outgoing message
            await logMessage({
                chat: { id: chatId },
                text: confirmationMessage,
                from: { is_bot: true },
            });

            // Send confirmation to the user
            await bot.sendMessage(chatId, confirmationMessage);

            // If the message has a caption requesting a summary, generate the summary
            if (msg.caption && msg.caption.toLowerCase().includes('summary')) {
                let thread = await getThread(chatId);
                
                // Truncate the thread to a manageable length
                thread = truncateThread(thread, 2000); // Adjust the maxLength as needed

                const summaryResponse = await generateOpenAIResponseforMystMkra('summary. Focus on the most relevant information from the document.', thread);

                // Save the bot's response to the thread with the role 'assistant'
                await saveMessage(chatId, 'assistant', summaryResponse, userName, botName);

                // Log the outgoing message
                await logMessage({
                    chat: { id: chatId },
                    text: summaryResponse,
                    from: { is_bot: true },
                });

                // Send the summary response to the user
                await bot.sendMessage(chatId, summaryResponse);
            }
        } else {
            console.log('Unsupported message type.');
            const unsupportedMessage = 'Beklager, jeg forstår bare tekstmeldinger og Markdown-filer.';
            
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
        const errorMessage = 'En feil oppstod under behandlingen av meldingen din. Vennligst prøv igjen senere.';
        
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
const telegramRouter4 = express.Router();

if (config.NODE_ENV === 'production') {
    // Endpoint to handle incoming webhook requests
    telegramRouter4.post(`/bot${TELEGRAM_BOT_TOKEN}`, (req, res) => {
        console.log('Received webhook request:', req.body); // Log the incoming webhook request
        bot.processUpdate(req.body);
        res.sendStatus(200);
    });
}

// Endpoint to check bot status
telegramRouter4.get('/status', (req, res) => {
    try {
        res.json({ status: 'Bot is running', uptime: process.uptime(), environment: config.NODE_ENV });
    } catch (error) {
        console.error('Error retrieving bot status:', error.message);
        res.status(500).json({ error: 'Unable to retrieve bot status' });
    }
});

// Export the router for use in the main app
export default telegramRouter4;
