import TelegramBot from 'node-telegram-bot-api';
import express from 'express';
import dotenv from 'dotenv';
import logMessage from '../services/logMessage.js';
import config from '../config/config.js';

dotenv.config();

// Telegram bot token
const TELEGRAM_BOT2_TOKEN = config.NODE_ENV === 'production'
  ? process.env.TELEGRAM_BOT2_TOKEN_PROD
  : process.env.TELEGRAM_BOT2_TOKEN_DEV;

if (!TELEGRAM_BOT2_TOKEN) {
  console.error('Error: Telegram Bot 2 token is not set.');
  process.exit(1);
}

// Create a Telegram bot instance
const bot2 = new TelegramBot(TELEGRAM_BOT2_TOKEN, { polling: true });

// Bot logic for messages
bot2.on('message', async (msg) => {
  const chatId = msg.chat.id;
  try {
    await logMessage(msg); // Log incoming message
    if (msg.text === '/start') {
      await bot2.sendMessage(chatId, 'Welcome to Bot 2!');
    } else {
      await bot2.sendMessage(chatId, 'This is Bot 2. How can I help you?');
    }
  } catch (error) {
    console.error('Error in Bot 2:', error.message);
    await bot2.sendMessage(chatId, 'An error occurred. Please try again.');
  }
});

// Express router for Bot 2
const bot2Router = express.Router();

// Endpoint to check Bot 2 status
bot2Router.get('/status', (req, res) => {
  res.json({ status: 'Bot 2 is running', uptime: process.uptime() });
});

export default bot2Router;
