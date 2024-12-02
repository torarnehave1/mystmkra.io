import express from 'express';
import TelegramBot from 'node-telegram-bot-api';
import config from '../config/config.js';
import UserState from '../models/UserState.js';
import Process from '../models/Process.js';
import { generateQuestionsFromOpenAI } from '../services/generateQuestions.js';
import { checkForDuplicates } from '../services/generateQuestions.js';
import translationsData from '../translations/process_translations.json' assert { type: 'json' };

const router = express.Router();
const bot = new TelegramBot(config.botToken, { polling: true });

const translations = translationsData[0].translations;

// Helper: Get translation
const getTranslation = (language, key, placeholders = {}) => {
  const translation = translations[language]?.[key] || key;
  return translation.replace(/\{(\w+)\}/g, (_, placeholder) => placeholders[placeholder] || `{${placeholder}}`);
};

// Start Command
bot.onText(/\/start(.*)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const args = match[1].trim(); // Extract any arguments after /start

  let userState = await UserState.findOne({ userId: chatId });

  if (!userState) {
    userState = new UserState({ userId: chatId });
    await userState.save();
  }

  if (args) {
    const processId = args; // Assume args is the processId
    const process = await Process.findOne({ processId });

    if (process) {
      userState.processId = processId;
      userState.currentStepIndex = 0;
      await userState.save();

      await bot.sendMessage(chatId, getTranslation(userState.systemLanguage, 'processStarted', { processTitle: process.title }));
      await executeStep(chatId); // Start the process
      return;
    } else {
      await bot.sendMessage(chatId, 'Invalid process link.');
      return;
    }
  }

  // Default start behavior if no arguments are provided
  await bot.sendMessage(chatId, getTranslation(userState.systemLanguage, 'welcome'), {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'English', callback_data: 'lang_EN' }],
        [{ text: 'Norwegian', callback_data: 'lang_NO' }],
      ],
    },
  });
});

// Handle Language Selection
bot.on('callback_query', async (callbackQuery) => {
  const { data, message } = callbackQuery;
  const chatId = message.chat.id;

  if (data.startsWith('lang_')) {
    const language = data.split('_')[1];
    let userState = await UserState.findOne({ userId: chatId });
    userState.systemLanguage = language;
    await userState.save();

    await bot.sendMessage(chatId, getTranslation(language, 'languageSet', { language: language === 'EN' ? 'English' : 'Norwegian' }));
  }
});

// Execute Process Step
const executeStep = async (chatId) => {
  const userState = await UserState.findOne({ userId: chatId });
  const process = await Process.findOne({ processId: userState.processId });

  if (!process) {
    await bot.sendMessage(chatId, 'No process found.');
    return;
  }

  const step = process.steps[userState.currentStepIndex];
  const userLang = userState.systemLanguage;

  switch (step.type) {
    case 'generate_questions': {
      const prompt = getTranslation(userLang, 'generateQuestionsPrompt');
      await bot.sendMessage(chatId, prompt);

      bot.once('message', async (msg) => {
        const userInput = msg.text;

        // Generate questions using OpenAI
        const generatedQuestions = await generateQuestionsFromOpenAI(userState, userInput);

        // Check for duplicates
        const uniqueQuestions = checkForDuplicates(generatedQuestions, userState.generatedQuestions);

        if (uniqueQuestions.length === 0) {
          await bot.sendMessage(chatId, 'All suggestions were duplicates. Please provide more details.');
          return;
        }

        userState.generatedQuestions.push(...uniqueQuestions.map((q) => ({ text: q, confirmed: false })));
        await userState.save();

        await bot.sendMessage(chatId, getTranslation(userLang, 'generatedQuestions', { questions: uniqueQuestions.join('\n') }));
      });
      break;
    }
    case 'final': {
      // Final step logic
      const botUsername = config.BOT_USERNAME || 'your_bot_username'; // Replace with your bot username
      const shareableLink = `https://t.me/${botUsername}?start=${userState.processId}`;

      // Send the final message with the link
      await bot.sendMessage(chatId, getTranslation(userLang, 'finalMessage'));
      await bot.sendMessage(chatId, `Share this process with others: ${shareableLink}`);

      // Clear the user's state
      userState.processId = null;
      userState.currentStepIndex = 0;
      userState.responses = [];
      userState.generatedQuestions = [];
      userState.conversationHistory = [];
      await userState.save();

      break;
    }
    default: {
      // Handle other step types
      await bot.sendMessage(chatId, getTranslation(userLang, step.prompt));
    }
  }

  // Advance to the next step, if applicable
  if (userState.currentStepIndex + 1 < process.steps.length) {
    userState.currentStepIndex += 1;
    await userState.save();
    await executeStep(chatId); // Move to the next step
  }
};

//add an enpoint to check the status of the bot

router.get('/status', (req, res) => {
    res.json({ status: 'Running' });
    }
);


export default router;
