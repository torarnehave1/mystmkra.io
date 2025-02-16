import express from 'express';

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

import TelegramBot from 'node-telegram-bot-api';
import mongoose from 'mongoose'; // Import mongoose
import config from '../config/config.js';
import translationsData from '../translations/process_translations.json' with { type: 'json' };
import { getTranslation, extractProcessId, extractStepTypeAndProcessId } from '../services/helpers.js';
import { handleViewProcess, handleNextStep } from '../services/viewprocess.js'; // Use modular functions
import Process from '../models/process.js';
import UserState from '../models/UserState.js';
import { handleCreateProcessManual } from '../services/createProcessManual.js';
import { handleAddStepBefore, handleAddStepAfter, handleAddStep } from '../services/AddStepService.js'; // Import handleAddStepBefore, handleAddStepAfter, and handleAddStep functions
import { handleFinishProcess } from '../services/finishprocess.js';
import { generateDeepLink } from '../services/deeplink.js'; // Import generateDeepLink function
import analyzeConversation from '../services/conversationanalysis.js'; // Import analyzeConversation function
import generateOpenAIResponseforGreenBot from '../services/greenBotOpenAiQuestions.js'; // Correct import
import logMessage from '../services/logMessage.js'; // Import logMessage function
import { handleEditProcess, handleEditPrompt, handleEditType, handleNextEditStep, handlePreviousEditStep, handleEditTitle, handleEditDescription, handleEditImageUrl, handleUseAIToCreateProcess, handleEditStepDescription, handleEditCategory } from '../services/editProcessService.js'; // Remove duplicate imports
import generateStepsForProcess from '../services/generateStepsForProcess.js';
import { presentStep, presentCategorySelection } from '../services/answerservice.js'; // Import presentStep and presentCategorySelection functions
import { handleNextReviewStep } from '../services/reviewProcessService.js'; // Import handleNextReviewStep function
import { Console } from 'console';

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
  const match = data.match(/(?:view_process_|start_process_|add_step_|finish_process_|edit_process_|edit_prompt_|edit_type_|next_step_|previous_step_|edit_title_|edit_description_|add_step_before_|add_step_after_|edit_image_url_|duplicate_process_|use_ai_|edit_category_|next_review_step_)([0-9a-fA-F]{24})/);
  return match ? match[1] : null;
}

// Helper function to extract process ID and step index from callback data
function extractProcessIdAndStepIndexFromCallbackData(data) {
  const match = data.match(/(?:edit_prompt_|edit_type_|edit_step_description_)([0-9a-fA-F]{24})_(\d+)/);
  return match ? { processId: match[1], stepIndex: parseInt(match[2]) } : null;
}

// Helper function to validate process ID
function isValidObjectId(id) {
  return /^[0-9a-fA-F]{24}$/.test(id);
}

// [SECTION 2: Bot Commands]

// Step 1: Start Command and Language Selection
bot.onText(/\/start(?: (.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const startParam = match[1];
  console.log(`[DEBUG] /start triggered by user ${chatId} with param: ${startParam}`);

  if (startParam) {
    const processId = extractProcessIdFromStartParam(startParam);
    console.log(`[DEBUG] Extracted processId: ${processId}`);
    if (processId) {
      if (!isValidObjectId(processId)) {
        console.error(`[ERROR] Invalid process ID format: "${processId}"`);
        await bot.sendMessage(chatId, 'Invalid process ID format. Please check the link and try again.');
        return;
      }
      try {
        console.log(`[DEBUG] Attempting to find process with ID: ${processId}`);
        const process = await Process.findById(processId);
        if (!process) {
          console.error(`[ERROR] Process not found for processId: "${processId}"`);
          throw new Error(`Process not found for processId: "${processId}"`);
        }
        if (!process.steps || process.steps.length === 0) {
          console.error(`[ERROR] No steps found for processId: "${processId}"`);
          throw new Error(`No steps found for processId: "${processId}"`);
        }
        console.log(`[DEBUG] Process found: ${JSON.stringify(process)}`);
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

// New command to edit an existing process
bot.onText(/\/edit/, async (msg) => {
  const chatId = msg.chat.id;
  console.log(`[DEBUG] /edit triggered by user ${chatId}`);

  try {
    const processes = await Process.find({ isFinished: true});

    if (!processes.length) {
      await bot.sendMessage(chatId, 'You have no processes to edit.');
      return;
    }

    const processButtons = processes.map((process) => [
      { text: process.title, callback_data: `edit_process_${process._id}` },
      { text: 'Duplicate Process', callback_data: `duplicate_process_${process._id}` }, // Add duplicate button
    ]);

    await bot.sendMessage(chatId, 'Select a process to edit or duplicate:', {
      reply_markup: { inline_keyboard: processButtons },
    });
  } catch (error) {
    console.error(`[ERROR] Failed to retrieve processes: ${error.message}`);
    await bot.sendMessage(chatId, 'An error occurred. Please try again later.');
  }
});

// New command to reset all states and inputs
bot.onText(/\/reset/, async (msg) => {
  const chatId = msg.chat.id;
  console.log(`[DEBUG] /reset triggered by user ${chatId}`);

  try {
    // Find and delete the user state
    const userState = await UserState.findOne({ userId: chatId });
    if (userState) {
      await userState.deleteOne();
      console.log(`[DEBUG] User state reset for user ${chatId}`);
    }

    // Send confirmation message
    await bot.sendMessage(chatId, 'All states and inputs have been reset.');
  } catch (error) {
    console.error(`[ERROR] Failed to reset states and inputs: ${error.message}`);
    await bot.sendMessage(chatId, 'An error occurred while resetting states and inputs. Please try again later.');
  }
});

// Bot logic: handle all incoming messages
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;

  try {
    // Log the incoming message
    console.log(`[DEBUG] Received message: ${msg.text || msg.document || 'unknown type'}`);
    await logMessage(msg);

    // Simple test for responding to "halla"
    if (msg.text && msg.text.toLowerCase() === 'halla') {
      console.log(`[DEBUG] Responding to "halla" message from user ${chatId}`);
      await bot.sendMessage(chatId, 'halla på deg');
      return;
    }

    if (msg.photo && Array.isArray(msg.photo) && msg.photo.length > 0) {
      // Handle photo message
      // ...existing code...
    } else if (msg.document) {
      const userState = await UserState.findOne({ userId: chatId });
      const process = await Process.findById(userState.processId);
      const currentStep = process.steps[userState.currentStepIndex];

    } else if (msg.text) {
      // Handle text message
      // ...existing code...
    } else {
      await bot.sendMessage(chatId, 'Unsupported message type.');
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
  console.log(`[DEBUG XXXX] Callback query received from user ${chatId} with data: ${data}`); // Log the callback query data

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

      await bot.sendMessage(chatId, welcomeMessage);
      await presentCategorySelection(bot, chatId); // Present category selection after language is set
    } catch (error) {
      console.error(`[ERROR] Failed to handle language selection: ${error.message}`);
      await bot.sendMessage(chatId, 'An error occurred. Please try again later.');
    }
    return;
  }

  // Handle category selection
  if (data.startsWith('select_category_')) {
    const categoryId = data.split('_')[2];
    console.log(`[DEBUG] Category selected: ${categoryId} for user ${chatId}`);

    try {
      const userState = await UserState.findOne({ userId: chatId });
      userState.selectedCategory = categoryId;
      await userState.save();

      await bot.sendMessage(chatId, 'Category selected successfully. You can now proceed with the process.');

      // Proceed with the process creation using existing logic
      await bot.sendMessage(chatId, 'Please provide a title for the new process:');
      bot.once('message', async (msg) => {
        const title = msg.text;
        await bot.sendMessage(chatId, 'Please provide a description for the new process:');
        bot.once('message', async (msg) => {
          const description = msg.text;
          const newProcess = new Process({
            title,
            description,
            createdBy: chatId,
            processCategory: categoryId, // Save the selected category
          });
          await newProcess.save();
          userState.processId = newProcess._id;
          await userState.save();

          await bot.sendMessage(chatId, `Process "${title}" created with description "${description}". You can now add steps to the process.`);
          // Proceed with adding steps using existing logic
          await handleAddStep(bot, chatId, newProcess._id);
        });
      });
    } catch (error) {
      console.error(`[ERROR] Failed to handle category selection: ${error.message}`);
      await bot.sendMessage(chatId, 'An error occurred. Please try again later.');
    }
    return;
  }

  // Handle viewing a finished process
  if (data.startsWith('view_process_')) {

    // Extract process ID from the callback data and console log it
   
    

    const processId = extractProcessIdFromCallbackData(data);
    console.log(`[DEBUG] View process callback triggered for process ${processId} by user ${chatId}`);

    if (!isValidObjectId(processId)) {
      console.error(`[ERROR] Invalid process ID format: "${processId}"`);
      await bot.sendMessage(chatId, 'Invalid process ID format. Please check the link and try again.');
      return;
    }

    try {
      console.log(`[DEBUG] Attempting to find process with ID: ${processId}`);
      const process = await Process.findById(processId);
      if (!process) {
        console.error(`[ERROR] Process not found for processId: "${processId}"`);
        throw new Error(`Process not found for processId: "${processId}"`);
      }
      if (!process.steps || process.steps.length === 0) {
        console.error(`[ERROR] No steps found for processId: "${processId}"`);
        throw new Error(`No steps found for processId: "${processId}"`);
      }
      console.log(`[DEBUG] Process found: ${JSON.stringify(process)}`);

      await bot.sendMessage(chatId, `${process.title}\n`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Start Process', callback_data: `start_process_${processId}` }],
          ],
        },
      });
    } catch (error) {
      console.error(`[ERROR] Failed to handle view process for process ${processId}: ${error.message}`);
      await bot.sendMessage(chatId, 'An error occurred while trying to view the process. Please try again later.');
    }
    return;
  }

  // Handle starting a process
  /*
    if (data.startsWith('start_process_')) {
      const processId = extractProcessIdFromCallbackData(data);
      const userState = await UserState.findOne({ userId: chatId });
      const process = await Process.findById(processId);
      const currentStep = process.steps[userState.currentStepIndex];
     // await presentStep(bot, chatId, processId, currentStep, userState);
      //add a consolog log statement to log the processId
      console.log(`[DEBUG STRTP01] start_process callback triggered for process ${processId} by user ${chatId}`);
    }
  */

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

  if (data === 'create_process_ai') {
    const userState = await UserState.findOne({ userId: chatId });
    userState.processId = null;
    userState.currentStepIndex = 0;
    userState.answers = [];
    userState.isProcessingStep = false;
    await userState.save();

    await bot.sendMessage(chatId, 'Please provide a title for the new process:');
    bot.once('message', async (msg) => {
      const title = msg.text;
      await bot.sendMessage(chatId, 'Please provide a description for the new process:');
      bot.once('message', async (msg) => {
        const description = msg.text;
        const newProcess = new Process({ title, description, createdBy: chatId });
        await newProcess.save();
        userState.processId = newProcess._id;
        await userState.save();

        try {
          const updatedProcess = await generateStepsForProcess(newProcess._id, title, description);
          if (!updatedProcess.steps.length) {
            throw new Error('No steps generated for the process.');
          }
          await bot.sendMessage(chatId, `Process "${title}" created with description "${description}". Steps have been generated.`);
        } catch (error) {
          console.error(`[ERROR] Failed to generate steps: ${error.message}`);
          await bot.sendMessage(chatId, 'An error occurred while generating steps. Please try again later.');
        }
      });
    });
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

  if (data.startsWith('edit_process_')) {
    const processId = extractProcessIdFromCallbackData(data);
    console.log(`[DEBUG] edit_process callback triggered for process ${processId} by user ${chatId}`);
    await handleEditProcess(bot, chatId, processId);
    return;
  }

  if (data.startsWith('edit_prompt_')) {
    const { processId, stepIndex } = extractProcessIdAndStepIndexFromCallbackData(data);
    console.log(`[DEBUG] edit_prompt callback triggered for process ${processId}, step ${stepIndex} by user ${chatId}`);
    await handleEditPrompt(bot, chatId, processId, stepIndex);
    return;
  }

  if (data.startsWith('edit_type_')) {
    const { processId, stepIndex } = extractProcessIdAndStepIndexFromCallbackData(data);
    console.log(`[DEBUG] edit_type callback triggered for process ${processId}, step ${stepIndex} by user ${chatId}`);
    await handleEditType(bot, chatId, processId, stepIndex);
    return;
  }

  if (data.startsWith('next_step_')) {
    const processId = extractProcessIdFromCallbackData(data);
    console.log(`[DEBUG] next_step callback triggered for process ${processId} by user ${chatId}`);
    await handleNextEditStep(bot, chatId, processId);
    return;
  }

  if (data.startsWith('previous_step_')) {
    const processId = extractProcessIdFromCallbackData(data);
    console.log(`[DEBUG] previous_step callback triggered for process ${processId} by user ${chatId}`);
    await handlePreviousEditStep(bot, chatId, processId);
    return;
  }

  if (data.startsWith('edit_title_')) {
    const processId = extractProcessIdFromCallbackData(data);
    console.log(`[DEBUG] edit_title callback triggered for process ${processId} by user ${chatId}`);
    await handleEditTitle(bot, chatId, processId);
    return;
  }

  if (data.startsWith('edit_description_')) {
    const processId = extractProcessIdFromCallbackData(data);
    console.log(`[DEBUG] edit_description callback triggered for process ${processId} by user ${chatId}`);
    await handleEditDescription(bot, chatId, processId);
    return;
  }

  if (data.startsWith('add_step_before_')) {
    const { processId, stepIndex } = extractProcessIdAndStepIndexFromCallbackData(data);
    console.log(`[DEBUG] add_step_before callback triggered for process ${processId}, step ${stepIndex} by user ${chatId}`);
    await handleAddStepBefore(bot, chatId, processId, stepIndex);
    return;
  }

  if (data.startsWith('add_step_after_')) {
    const { processId, stepIndex } = extractProcessIdAndStepIndexFromCallbackData(data);
    console.log(`[DEBUG] add_step_after callback triggered for process ${processId}, step ${stepIndex} by user ${chatId}`);
    await handleAddStepAfter(bot, chatId, processId, stepIndex);
    return;
  }

  if (data.startsWith('edit_image_url_')) {
    const processId = extractProcessIdFromCallbackData(data);
    console.log(`[DEBUG] edit_image_url callback triggered for process ${processId} by user ${chatId}`);
    await handleEditImageUrl(bot, chatId, processId);
    return;
  }

  if (data.startsWith('duplicate_process_')) {
    const processId = extractProcessIdFromCallbackData(data);
    console.log(`[DEBUG] duplicate_process callback triggered for process ${processId} by user ${chatId}`);

    try {
      const process = await Process.findById(processId);
      if (!process) {
        console.error(`[ERROR] Process not found for processId: "${processId}"`);
        await bot.sendMessage(chatId, 'The process could not be found. Please try again.');
        return;
      }

      const duplicatedProcess = new Process({
        ...process.toObject(),
        _id: new mongoose.Types.ObjectId(), // Correctly create a new ObjectId
        title: `${process.title} [DUPLICATE]`,
        createdAt: Date.now(),
      });

      await duplicatedProcess.save();
      console.log(`[DEBUG] Process duplicated with new ID: ${duplicatedProcess._id}`);

      await bot.sendMessage(chatId, `Process duplicated successfully. New process ID: ${duplicatedProcess._id}`);
    } catch (error) {
      console.error(`[ERROR] Failed to duplicate process: ${error.message}`);
      await bot.sendMessage(chatId, 'An error occurred while duplicating the process. Please try again later.');
    }
    return;
  }

  if (data.startsWith('use_ai_')) {
    const processId = extractProcessIdFromCallbackData(data);
    console.log(`[DEBUG] use_ai callback triggered for process ${processId} by user ${chatId}`);
    await handleUseAIToCreateProcess(bot, chatId, processId);
    return;
  }

  if (data.startsWith('edit_step_description_')) {
    const result = extractProcessIdAndStepIndexFromCallbackData(data);
    if (result) {
      const { processId, stepIndex } = result;
      console.log(`[DEBUG] edit_step_description callback triggered for process ${processId}, step ${stepIndex} by user ${chatId}`);
      await handleEditStepDescription(bot, chatId, processId, stepIndex);
    } else {
      console.error(`[ERROR] Failed to extract process ID and step index from callback data: "${data}"`);
      await bot.sendMessage(chatId, 'An error occurred. Please try again later.');
    }
    return;
  }

  if (data.startsWith('edit_category_')) {
    const processId = extractProcessIdFromCallbackData(data);
    if (!isValidObjectId(processId)) {
      console.error(`[ERROR] Invalid process ID format: "${processId}"`);
      await bot.sendMessage(chatId, 'Invalid process ID format. Please check the link and try again.');
      return;
    }
    console.log(`[DEBUG] edit_category callback triggered for process ${processId} by user ${chatId}`);
    await handleEditCategory(bot, chatId, processId);
    return;
  }

  if (data.startsWith('select_cat_')) {
    const parts = data.split('_');
    const categoryId = parts[2];
    const processId = parts[3];
    if (!isValidObjectId(categoryId) || !isValidObjectId(processId)) {
      console.error(`[ERROR] Invalid category or process ID format: "${categoryId}", "${processId}"`);
      await bot.sendMessage(chatId, 'Invalid category or process ID format. Please try again.');
      return;
    }
    console.log(`[DEBUG] select_cat callback triggered for category ${categoryId} and process ${processId} by user ${chatId}`);
    try {
      const process = await Process.findById(processId);
      if (!process) {
        console.error(`[ERROR] Process not found for processId: "${processId}"`);
        await bot.sendMessage(chatId, 'The process could not be found. Please try again.');
        return;
      }

      process.processCategory = categoryId;
      await process.save();
      console.log(`[DEBUG] Process category updated to ${categoryId} for processId: "${processId}"`);

      await bot.sendMessage(chatId, `Category updated successfully.`);
      await handleEditProcess(bot, chatId, processId);
    } catch (error) {
      console.error(`[ERROR] Failed to update category: ${error.message}`);
      await bot.sendMessage(chatId, 'An error occurred. Please try again later.');
    }
    return;
  }

  if (data.startsWith('next_review_step_')) {
    const processId = extractProcessIdFromCallbackData(data);
    console.log(`[DEBUG] next_review_step callback triggered for process ${processId} by user ${chatId}`);
    await handleNextReviewStep(bot, chatId, processId);
    return;
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
      { text: `${process.title}\n${process.description}`, url: `https://t.me/${botUsername}?start=view_process_${process._id}` },
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
//Create a post endpoint to download telegram file with the file id as the parameter
router.post('/download', async (req, res) => {
  console.log('[DEBUG ALT 1] /download endpoint triggered');
  
 

  try {
    const { fileId } = req.body;

    if (!fileId) {
      console.log('[DEBUG ALT 2] fileId is missing in the request body');
      return res.status(400).json({ error: 'fileId is required in the request body.' });
    }

    console.log(`[DEBUG ALT 3] Received fileId: ${fileId}`);

    // Define the directory where you want to save the downloaded file.
    const downloadDir = path.join(__dirname, '..', 'public', 'telegram_files');
    if (!fs.existsSync(downloadDir)) {
      console.log('[DEBUG ALT 4] Creating download directory');
      fs.mkdirSync(downloadDir, { recursive: true });
    }

    // Step 1: Call Telegram's getFile API to get file info
    const getFileUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`;
    console.log(`[DEBUG ALT 5] Calling getFile API: ${getFileUrl}`);
    const fileInfoResponse = await axios.get(getFileUrl);
    if (!fileInfoResponse.data.ok) {
      throw new Error('Failed to get file info from Telegram API');
    }
    const filePath = fileInfoResponse.data.result.file_path;
    console.log(`[DEBUG ALT 6] Retrieved file_path: ${filePath}`);

    // Step 2: Construct the file download URL.
    const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${filePath}`;
    console.log(`[DEBUG ALT 7] Constructed file URL: ${fileUrl}`);

    // Step 3: Download the file using axios.
    const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
    console.log('[DEBUG ALT 8] File downloaded from Telegram');

    // Determine file extension (if any) from filePath.
    const ext = path.extname(filePath) || '.dat';
    const newFileName = `telegram_file_${Date.now()}${ext}`;
    const newFilePath = path.join(downloadDir, newFileName);

    // Save the file to disk.
    fs.writeFileSync(newFilePath, response.data);
    console.log(`[DEBUG ALT 9] File saved to: ${newFilePath}`);

    res.status(200).json({
      message: 'File downloaded successfully',
      filePath: newFilePath,
      fileName: newFileName
    });
  } catch (error) {
    console.error('[DEBUG ALT 10] Error downloading telegram file:', error.message);
    console.error('[DEBUG ALT 11] Error details:', error.stack);
    res.status(500).json({ error: 'Failed to download telegram file' });
  }
});

export default router;
