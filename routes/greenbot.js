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
import analyzeConversation from '../services/conversationanalysis.js'; // Import analyzeConversation function
import generateOpenAIResponseforGreenBot from '../services/greenBotOpenAiQuestions.js'; // Correct import
import logMessage from '../services/logMessage.js'; // Import logMessage function

// [SECTION 1: Initialization]
const router = express.Router();

// Access the Telegram bot token based on the environment
const TELEGRAM_BOT_TOKEN = config.NODE_ENV === 'production'
    ? config.botToken2 // Production token
    : config.botToken2; // Development token

if (!TELEGRAM_BOT_TOKEN) {
    console.error('Error: Telegram bot token is not set in the environment variables.');
    process.exit(1); // Exit the process if the bot token is missing
}

// Log the Telegram bot token
console.log(`Telegram Bot Token for Green: ${TELEGRAM_BOT_TOKEN}`);

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
const translations = translationsData[0].translations;



// Helper function to extract process ID from start parameter
function extractProcessIdFromStartParam(startParam) {
  const match = startParam.match(/^view_process_(.+)$/);
  return match ? match[1] : null;
}

// Helper function to extract process ID from callback data
function extractProcessIdFromCallbackData(data) {
  const match = data.match(/(?:view_process_|start_process_|add_step_|finish_process_)(.+)$/);
  return match ? match[1] : null;
}

// [SECTION 2: Bot Commands]

// Step 1: Start Command and Language Selection
bot.onText(/\/start(?: (.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const startParam = match[1];
  console.log(`[DEBUG] /start triggered by user ${chatId} with param: ${startParam}`);

  if (startParam) {
    const processId = extractProcessIdFromStartParam(startParam);
    if (processId) {
      try {
        const process = await Process.findById(processId);
        if (!process || !process.steps || process.steps.length === 0) {
          throw new Error(`Process or steps not found for processId: "${processId}"`);
        }
        await handleViewProcess(bot, chatId, processId);
      } catch (error) {
        console.error(`[ERROR] Failed to handle deep link for process ${processId}: ${error.message}`);
        await bot.sendMessage(chatId, 'An error occurred while trying to view the process. Please try again later.');
      }
      return;
    } else {
      await bot.sendMessage(chatId, 'Invalid deep link parameter. Please check the link and try again.');
      return;
    }
  }

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

// Bot logic: handle all incoming messages
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;

    try {
        // Log the incoming message
        console.log(`[DEBUG] Received message: ${msg.text}`);
        await logMessage(msg);

        // Simple test for responding to "halla"
        if (msg.text.toLowerCase() === 'halla') {
            console.log(`[DEBUG] Responding to "halla" message from user ${chatId}`);
            await bot.sendMessage(chatId, 'halla på deg');
            return;
        }

        if (msg.photo && Array.isArray(msg.photo) && msg.photo.length > 0) {
            // ...existing code...
        } else if (msg.text) {
            // ...existing code...
        } else {
            // ...existing code...
        }
    } catch (error) {
        console.error(`[ERROR] Error processing message: ${error.message}`);
        const errorMessage = 'An error occurred while processing your message. Please try again later.';
        await bot.sendMessage(chatId, errorMessage);
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
    const processId = extractProcessIdFromCallbackData(data);
    try {
      const process = await Process.findById(processId);
      if (!process || !process.steps || process.steps.length === 0) {
        throw new Error(`Process or steps not found for processId: "${processId}"`);
      }
      await handleViewProcess(bot, chatId, processId);
    } catch (error) {
      console.error(`[ERROR] Failed to handle view process for process ${processId}: ${error.message}`);
      await bot.sendMessage(chatId, 'An error occurred while trying to view the process. Please try again later.');
    }
    return;
  }

  // Handle starting a process
  if (data.startsWith('start_process_')) {
    const processId = extractProcessIdFromCallbackData(data);
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
    const processId = extractProcessIdFromCallbackData(data);
    await handleAddStep(bot, chatId, processId);
    return;
  }

  if (data.startsWith('finish_process_')) {
    const processId = extractProcessIdFromCallbackData(data);
    try {
      await handleFinishProcess(bot, chatId, processId);
    } catch (error) {
      console.error(`[ERROR] Failed to finish process ${processId}: ${error.message}`);
      await bot.sendMessage(chatId, 'An error occurred while finishing the process. Please try again later.');
    }
    return;
  }

  if (data.startsWith('view_')) {
    const processId = extractProcessIdFromCallbackData(data);
    await handleViewProcess(bot, chatId, processId); // Use modular function
    return;
  }

  if (data.startsWith('start_process_')) {
    const processId = extractProcessIdFromCallbackData(data);
    const userState = await UserState.findOne({ userId: chatId });
    const process = await Process.findById(processId);
    const currentStep = process.steps[userState.currentStepIndex];
    presentStep(bot, chatId, processId, currentStep, userState);
  }
  // Additional callback handlers (original logic intact)
});

// Handle //MENTOR command
bot.onText(/\/\/MENTOR/, async (msg) => {
  const chatId = msg.chat.id;
  const transcription = msg.text;

  try {
    const analysisResult = await analyzeConversation(config.botToken, msg);
    await bot.sendMessage(chatId, analysisResult);
  } catch (error) {
    console.error(`[ERROR] Failed to analyze conversation: ${error.message}`);
    await bot.sendMessage(chatId, 'An error occurred while analyzing the conversation. Please try again later.');
  }
});

// [SECTION 3: View Finished Process Command]

bot.onText(/\/view/, async (msg) => {
  const chatId = msg.chat.id;
  console.log(`[DEBUG] /view triggered by user ${chatId}`);

  try {
   // const finishedProcesses = await Process.find({ isFinished: true, createdBy: chatId });
    const finishedProcesses = await Process.find({ isFinished: true});

    if (!finishedProcesses.length) {
      await bot.sendMessage(chatId, 'You have no finished processes.');
      return;
    }

    // Deduplicate processes if necessary
    const uniqueProcesses = [...new Map(finishedProcesses.map((p) => [p._id.toString(), p])).values()];
    const botUsername = config.botUsername; // Assuming botUsername is in the config
    const processButtons = uniqueProcesses.map((process) => [
      { text: process.title, url: `https://t.me/${botUsername}?start=view_process_${process._id}` },
    ]);

    await bot.sendMessage(chatId, 'Select a finished process to view:', {
      reply_markup: { inline_keyboard: processButtons },
    });

    // Generate and send deep link
    //const botUsername = config.botUsername; // Assuming botUsername is in the config
   // const deepLink = `https://t.me/${botUsername}?start=view_process_${uniqueProcesses[0]._id}`;
   // await bot.sendMessage(chatId, `You can also use this link to view your processes: ${deepLink}`);
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
