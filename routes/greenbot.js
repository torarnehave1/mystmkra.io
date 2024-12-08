import express from 'express';
import TelegramBot from 'node-telegram-bot-api';
import config from '../config/config.js';
import translationsData from '../translations/process_translations.json' assert { type: 'json' };
import { getTranslation, extractProcessId, extractStepTypeAndProcessId } from '../services/helpers.js';
import { handleViewProcess, handleNextStep } from '../services/viewprocess.js'; // Use modular functions
import Process from '../models/process.js';
import UserState from '../models/UserState.js';
import { handleCreateProcessManual } from '../services/createProcessManual.js';
import { handleAddStep } from '../services/AddStepService.js';
import { handleFinishProcess } from '../services/finishprocess.js';
import { generateDeepLink } from '../services/deeplink.js'; // Import generateDeepLink function
//import { saveAnswer } from '../services/answerservice.js';

//import { handleGenerateQuestions } from '../services/GenerateQuestionsService.js';


// [SECTION 1: Initialization]
const router = express.Router();
const bot = new TelegramBot(config.botToken, { polling: true });
const translations = translationsData[0].translations;



// [SECTION 2: Bot Commands]

// Step 1: Start Command and Language Selection
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  console.log(`[DEBUG] /start triggered by user ${chatId}`);

  try {
    // Create or retrieve user state
    let userState = await UserState.findOne({ userId: chatId });
    if (!userState) {
      console.log(`[DEBUG] Creating a new user state for user ${chatId}`);
      userState = new UserState({ userId: chatId, language: 'EN' }); // Add language property
      await userState.save();
    }

    // Reset process-related state
    userState.processId = null;
    userState.currentStepIndex = 0;
    userState.answers = [];
    userState.isProcessingStep = false;
    await userState.save();

    // Send welcome message with language selection
    await bot.sendMessage(chatId, 'Welcome! Please select your language:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'English', callback_data: 'lang_EN' }],
          [{ text: 'Norwegian', callback_data: 'lang_NO' }],
        ],
      },
    });
  } catch (error) {
    console.error(`[ERROR] Failed to execute /start command: ${error.message}`);
    await bot.sendMessage(chatId, 'An error occurred. Please try again later.');
  }
});


// Handle callback queries
bot.on('callback_query', async (callbackQuery) => {
  const { data, message } = callbackQuery;
  const chatId = message.chat.id;
 // console.log(`[DEBUG] Callback query received:`, callbackQuery); // Log the entire callbackQuery object

  // Handle language selection
  if (data.startsWith('lang_')) {
    const language = data.split('_')[1];
    console.log(`[DEBUG] Language selected: ${language} for user ${chatId}`);

    try {
      const userState = await UserState.findOne({ userId: chatId });
      userState.systemLanguage = language;
      await userState.save();

      const welcomeMessage = getTranslation(
        language,
        'language_set_message',
        { language: language === 'EN' ? 'English' : 'Norwegian' },
        translations
      );

      await bot.sendMessage(chatId, welcomeMessage, {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Create Process Manually', callback_data: 'create_process_manual' }],
            [{ text: 'Use AI to Create Process', callback_data: 'create_process_ai' }],
          ],
        },
      });
    } catch (error) {
      console.error(`[ERROR] Failed to handle language selection: ${error.message}`);
      await bot.sendMessage(chatId, 'An error occurred. Please try again later.');
    }
    return;
  }

  // Handle viewing a finished process
  if (data.startsWith('view_process_')) {
    const processId = extractProcessId(data);
    await handleViewProcess(bot, chatId, processId); // Use modular function
    return;
  }

  // Handle starting a process
  if (data.startsWith('start_process_')) {
    const processId = extractProcessId(data);
    await handleNextStep(bot, chatId, processId); // Use modular function
    return;
  }

  if (data === 'create_process_manual') {
    const userState = await UserState.findOne({ userId: chatId });
    userState.processId = null;
    userState.currentStepIndex = 0;
    userState.answers = [];
    userState.isProcessingStep = false;
    await userState.save();
    await handleCreateProcessManual(bot, chatId);
    return;
  }

  if (data.startsWith('add_step_')) {
    const processId = extractProcessId(data);
    await handleAddStep(bot, chatId, processId);
    return;
  }

  if (data.startsWith('finish_process_')) {
    const processId = data.replace('finish_process_', '');
    await handleFinishProcess(bot, chatId, processId);

    // Generate and present the deep link
    const botUsername = config.bot2Username; // Replace with your actual bot username variable
    const deepLink = generateDeepLink(botUsername, processId);
    await bot.sendMessage(chatId, `Share this deep link with users: ${deepLink}`);
    return;
  }

  if (data.startsWith('start_process_')) {
    const processId = extractProcessId(data);
    const userState = await UserState.findOne({ userId: chatId });
    const process = await Process.findById(processId);
    const currentStep = process.steps[userState.currentStepIndex];
    presentStep(bot, chatId, processId, currentStep, userState);
  }
  // Additional callback handlers (original logic intact)
});

// [SECTION 3: View Finished Process Command]

// Command to view finished processes
bot.onText(/\/view/, async (msg) => {
  const chatId = msg.chat.id;
  console.log(`[DEBUG] /view triggered by user ${chatId}`);

  try {
    const finishedProcesses = await Process.find({ isFinished: true, createdBy: chatId });

    if (!finishedProcesses.length) {
      await bot.sendMessage(chatId, 'You have no finished processes.');
      return;
    }

    // Deduplicate processes if necessary
    const uniqueProcesses = [...new Map(finishedProcesses.map((p) => [p._id.toString(), p])).values()];
    const processButtons = uniqueProcesses.map((process) => [
      { text: process.title, callback_data: `view_process_${process._id}` },
    ]);

    await bot.sendMessage(chatId, 'Select a finished process to view:', {
      reply_markup: { inline_keyboard: processButtons },
    });
  } catch (error) {
    console.error(`[ERROR] Failed to retrieve finished processes: ${error.message}`);
    await bot.sendMessage(chatId, 'An error occurred. Please try again later.');
  }
});

// [SECTION 4: Status Endpoint]
router.get('/status', (req, res) => {
  res.json({ status: 'Running' });
});

export default router;
