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
  console.log(`[DEBUG] /start called with args: "${args}" for chatId: ${chatId}`);

  let userState = await UserState.findOne({ userId: chatId });

  if (!userState) {
    console.log(`[DEBUG] Creating new user state for chatId: ${chatId}`);
    userState = new UserState({ userId: chatId });
    await userState.save();
  }

  if (args) {
    const processId = args; // Assume args is the processId
    const process = await Process.findOne({ processId });
    console.log(`[DEBUG] Process lookup for processId: "${processId}" found: ${!!process}`);

    if (process) {
      userState.processId = processId;
      userState.currentStepIndex = 0;
      await userState.save();

      await bot.sendMessage(chatId, getTranslation(userState.systemLanguage, 'processStarted', { processTitle: process.title }));
      await executeStep(chatId); // Start the process
      return;
    } else {
      console.log(`[ERROR] Invalid process link for processId: "${processId}"`);
      await bot.sendMessage(chatId, getTranslation(userState.systemLanguage, 'invalidProcessLink'));
      return;
    }
  }

  // Default start behavior if no arguments are provided
  console.log(`[DEBUG] Sending welcome message to chatId: ${chatId}`);
  await bot.sendMessage(chatId, getTranslation(userState.systemLanguage, 'welcome'), {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'English', callback_data: 'lang_EN' }],
        [{ text: 'Norwegian', callback_data: 'lang_NO' }],
      ],
    },
  });
});

// Handle Language Selection and Execute Step If Possible
bot.on('callback_query', async (callbackQuery) => {
  const { data, message } = callbackQuery;
  const chatId = message.chat.id;

  console.log(`[DEBUG] Callback query received: "${data}" for chatId: ${chatId}`);

  if (data.startsWith('lang_')) {
    const language = data.split('_')[1];
    console.log(`[DEBUG] Language selected: "${language}" for chatId: ${chatId}`);

    let userState = await UserState.findOne({ userId: chatId });
    if (!userState) {
      console.log(`[ERROR] No user state found for chatId: ${chatId}`);
      await bot.sendMessage(chatId, 'An error occurred. Please start again with /start.');
      return;
    }

    userState.systemLanguage = language;
    await userState.save();

    await bot.sendMessage(chatId, getTranslation(language, 'languageSet', { language: language === 'EN' ? 'English' : 'Norwegian' }));
    console.log(`[DEBUG] User language updated to "${language}" for chatId: ${chatId}`);

    // Check if there's a process already associated
    if (userState.processId) {
      console.log(`[DEBUG] Existing processId "${userState.processId}" found for chatId: ${chatId}`);
      await executeStep(chatId); // Proceed to execute the step
    } else {
      // If no process is associated, prompt the user to start one
      console.log(`[DEBUG] No process associated with chatId: ${chatId}`);
      await bot.sendMessage(chatId, getTranslation(language, 'noProcessAssociated'), {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Start a New Process', callback_data: 'start_process' }],
          ],
        },
      });
    }
  } else if (data === 'start_process') {
    console.log(`[DEBUG] User requested to start a new process for chatId: ${chatId}`);

    // Check if processes exist
    const availableProcesses = await Process.find({}, { processId: 1, title: 1 });

    if (availableProcesses.length === 0) {
      console.log(`[DEBUG] No processes found for chatId: ${chatId}`);
      await bot.sendMessage(chatId, getTranslation('EN', 'noProcessesAvailable'), {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Create a Process', callback_data: 'create_process' }],
          ],
        },
      });
    } else {
      const buttons = availableProcesses.map((process) => [
        { text: process.title, callback_data: `process_${process.processId}` },
      ]);

      await bot.sendMessage(chatId, getTranslation('EN', 'selectProcess'), {
        reply_markup: {
          inline_keyboard: buttons,
        },
      });
    }
  } else if (data === 'create_process') {
    console.log(`[DEBUG] User initiated process creation for chatId: ${chatId}`);
    await bot.sendMessage(chatId, "Please provide the title of the process:");

    bot.once('message', async (msg) => {
      const processTitle = msg.text;
      console.log(`[DEBUG] Received process title: "${processTitle}" for chatId: ${chatId}`);

      const newProcess = new Process({
        processId: `process_${Date.now()}`,
        title: processTitle,
        description: '',
        steps: [], // Start with no steps; steps can be added dynamically
      });

      await newProcess.save();
      console.log(`[DEBUG] New process created with title: "${processTitle}" for chatId: ${chatId}`);
      await bot.sendMessage(chatId, `Process "${processTitle}" has been created. You can now start adding steps.`);
    });
  } else if (data.startsWith('process_')) {
    const processId = data.split('_')[1];
    console.log(`[DEBUG] User selected processId "${processId}" for chatId: ${chatId}`);

    let userState = await UserState.findOne({ userId: chatId });
    const process = await Process.findOne({ processId });

    if (process) {
      userState.processId = processId;
      userState.currentStepIndex = 0;
      await userState.save();

      await bot.sendMessage(chatId, getTranslation(userState.systemLanguage, 'processStarted', { processTitle: process.title }));
      console.log(`[DEBUG] Process started for chatId: ${chatId}, processId: ${processId}`);
      await executeStep(chatId); // Start the process
    } else {
      console.log(`[ERROR] Invalid processId "${processId}" selected for chatId: ${chatId}`);
      await bot.sendMessage(chatId, getTranslation(userState.systemLanguage, 'invalidProcessLink'));
    }
  }
});

// Execute Process Step
const executeStep = async (chatId) => {
  const userState = await UserState.findOne({ userId: chatId });
  const process = await Process.findOne({ processId: userState.processId });

  if (!process) {
    await bot.sendMessage(chatId, getTranslation(userState.systemLanguage, 'noProcessFound'));
    return;
  }

  const step = process.steps[userState.currentStepIndex];
  const userLang = userState.systemLanguage;

  if (step) {
    // Process the step
    await bot.sendMessage(chatId, getTranslation(userLang, step.prompt || 'nextStepPrompt'));
  } else {
    // Finalize the process
    await bot.sendMessage(chatId, getTranslation(userLang, 'finalMessage'));
  }

  if (userState.currentStepIndex + 1 < process.steps.length) {
    userState.currentStepIndex += 1;
    await userState.save();
    await executeStep(chatId);
  }
};

// Status endpoint for health checks
router.get('/status', (req, res) => {
  res.json({ status: 'Running' });
});

export default router;
