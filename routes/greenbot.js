import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import TelegramBot from 'node-telegram-bot-api';
import express from 'express';
import config from '../config/config.js';
import UserState from '../models/UserState.js';
import { viewProcessHeader } from '../services/greenbot/ViewProcessHeader.js';
import { initializeProcess } from '../services/greenbot/processInitializer.js';
import { goToFirstStep, handleNextStep, handlePreviousStep } from '../services/greenbot/processNavigator.js';
//import { sendEditMenu } from '../services/greenbot/menus/editMenu.js';
import { handleHeaderEditCallbacks } from '../services/greenbot/menus/editHeaderMenu.js';
import { displayViewMenu, handleViewMenuCallbacks } from '../services/greenbot/menus/viewProcessMenu.js';
import { displayCreateHeaderProcessMenu, handleCreateHeaderProcessMenu } from '../services/greenbot/menus/createHeaderProcessMenu.js';
import { sendEditMenu, handleEditStepsCallback } from '../services/greenbot/menus/editMenu.js';
import { handleAddStep } from '../services/greenbot/addStepService.js';

const router = express.Router();
dotenv.config();

/**
 * Helper function to extract a process ID from a deep-link start parameter.
 * Expected format: "view_process_<processId>"
 */
function extractProcessIdFromStartParam(startParam) {
  console.log(`[DEBUG GREENBOT] Extracting process ID from startParam: ${startParam}`);
  const match = startParam.match(/^view_process_(.+)$/);
  return match ? match[1] : null;
}

/**
 * Helper function to extract a process ID from callback data.
 * This regex matches a 24-character hex string following known prefixes.
 */
function extractProcessIdFromCallbackData(data) {
  const match = data.match(/(?:view_process_|start_process_|add_step_|finish_process_|edit_process_|edit_prompt_|edit_type_|next_step_|previous_step_|edit_title_|edit_description_|add_step_before_|add_step_after_|edit_image_url_|duplicate_process_|use_ai_|edit_category_|next_review_step_)([0-9a-fA-F]{24})/);
  return match ? match[1] : null;
}

const TELEGRAM_BOT_TOKEN = config.NODE_ENV === 'production' ? config.botToken2 : config.botToken2;
if (!TELEGRAM_BOT_TOKEN) {
  console.error('Error: Telegram bot token is not set in the environment variables.');
  process.exit(1);
}

// Initialize the bot and handle header edit callbacks
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
handleHeaderEditCallbacks(bot);
handleEditStepsCallback(bot);
/**
 * Helper function to display the header edit interface.
 * Shows current header details with an "(EDIT MODE)" indicator and inline buttons
 * for editing individual fields and exiting edit mode.
 */
bot.onText(/\/restart/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, "Restarting bot polling...");
  bot.stopPolling();
  // Optionally, wait a moment before restarting polling.
  setTimeout(() => {
    bot.startPolling();
  }, 3000);
});

// When a user sends the /create command:
// When a user sends the /create command:
bot.onText(/\/create/, async (msg) => {
  const chatId = msg.chat.id;
  // Reset the user state for creation.
  await UserState.updateOne(
    { userId: chatId },
    {
      creationMode: null,
      processId: null,
      step: null,
      currentStepIndex: null,
      isProcessingStep: false
    },
    { upsert: true }
  );
  await displayCreateHeaderProcessMenu(bot, chatId);
});


// Initialize the creation callback handler (if not already initialized)
handleCreateHeaderProcessMenu(bot);



/**
 * /start command handler:
 * - If a deep-link parameter is provided, extract the processId,
 *   call initializeProcess (with type 'view_process') to reset and set up UserState,
 *   then display the process header.
 * - Otherwise, instruct the user to select a process type.
 */
bot.onText(/\/start(?: (.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const startParam = match[1];
  console.log(`[DEBUG GREENBOT] /start triggered by user ${chatId} with parameter: ${startParam}`);

  if (startParam) {
    const processId = extractProcessIdFromStartParam(startParam);
    console.log(`[DEBUG GREENBOT] Extracted process ID: ${processId} from parameter: ${startParam}`);
    
    // Initialize UserState for viewing process.
    await initializeProcess(bot, chatId, 'view_process', processId);
    // Display the process header.
    await viewProcessHeader(bot, chatId, processId);
  } else {
    console.log(`[DEBUG GREENBOT] /start triggered without a parameter.`);
    await bot.sendMessage(chatId, "Welcome! Please select a process type to begin.");
  }
});

/**
 * /view command handler:
 * - Lists finished processes for the user.
 * - Resets the UserState for viewing.
 */
bot.onText(/\/view/, async (msg) => {
  const chatId = msg.chat.id;
  console.log(`[DEBUG GREENBOT] /view triggered by user ${chatId}`);
  await displayViewMenu(bot, chatId);
});

/**
 * /edit command handler:
 * - Displays a full list of processes with inline buttons for each process:
 *   [Process] [Edit Header] [Edit Steps] [Reorder Steps]
 */
bot.onText(/\/edit/, async (msg) => {
  const chatId = msg.chat.id;
  console.log(`[DEBUG GREENBOT] /edit triggered by user ${chatId}`);
  await sendEditMenu(bot, chatId);
});

/**
 * Callback query handler for navigation buttons, start, view, edit commands:
 * - "Start" button (callback data starting with "start_process_") triggers goToFirstStep.
 * - "Next" and "Previous" buttons trigger handleNextStep and handlePreviousStep.
 * - "Exit" (reset) button (callback data "/reset") resets the UserState.
 * - Edit options: view_process_, edit_steps_, reorder_steps_.
 */
bot.on('callback_query', async (callbackQuery) => {
  const { data, message } = callbackQuery;
  const chatId = message.chat.id;
  console.log(`[DEBUG CALLBACK] Callback data received: ${data} [UNIQUE_CODE_12345]`);
  if (data.startsWith('create_header_')) {
    return;
  }

  if (data.startsWith('finish_process_')) {
    await bot.sendMessage(chatId, "Finished process editing.");
    await sendEditMenu(bot, chatId);
  }

  if (data.startsWith('start_process_')) {
    const processId = extractProcessIdFromCallbackData(data);
    let userState;
    try {
      userState = await UserState.findOne({ userId: chatId });
      if (!userState) {
        console.error(`[DEBUG CALLBACK] UserState not found for chatId: ${chatId}`);
        await bot.sendMessage(chatId, "User state not found. Please try again.");
        return;
      }
      userState.processId = processId;
      await userState.save();
    } catch (error) {
      console.error(`[DEBUG CALLBACK] Error retrieving UserState: ${error.message}`);
      await bot.sendMessage(chatId, "Error retrieving user state.");
      return;
    }
    console.log(`[DEBUG CALLBACK] Calling goToFirstStep for chatId: ${chatId}`);
    await goToFirstStep(bot, chatId, userState);
  }
  else if (data === "next_step") {
    let userState;
    try {
      userState = await UserState.findOne({ userId: chatId });
      if (!userState || !userState.processId) {
        console.error(`[DEBUG CALLBACK] UserState or process not set for chatId: ${chatId}`);
        await bot.sendMessage(chatId, "Process not set. Please start a process.");
        return;
      }
    } catch (error) {
      console.error(`[DEBUG CALLBACK] Error retrieving UserState: ${error.message}`);
      await bot.sendMessage(chatId, "Error retrieving user state.");
      return;
    }
    console.log(`[DEBUG CALLBACK] Calling handleNextStep for chatId: ${chatId}`);
    await handleNextStep(bot, chatId, userState);
  }
  else if (data === "previous_step") {
    let userState;
    try {
      userState = await UserState.findOne({ userId: chatId });
      if (!userState || !userState.processId) {
        console.error(`[DEBUG CALLBACK] UserState or process not set for chatId: ${chatId}`);
        await bot.sendMessage(chatId, "Process not set. Please start a process.");
        return;
      }
    } catch (error) {
      console.error(`[DEBUG CALLBACK] Error retrieving UserState: ${error.message}`);
      await bot.sendMessage(chatId, "Error retrieving user state.");
      return;
    }
    console.log(`[DEBUG CALLBACK] Calling handlePreviousStep for chatId: ${chatId}`);
    await handlePreviousStep(bot, chatId, userState);
  }
  else if (data === "/reset") {
    console.log(`[DEBUG CALLBACK] /reset triggered for chatId: ${chatId}`);
    await initializeProcess(bot, chatId, 'reset');
    await bot.sendMessage(chatId, "Process has been reset.");
  }
  // Handle add steps manually
  else if (data.startsWith("add_steps_manual_")) {
    const processId = data.replace("add_steps_manual_", "");
    console.log(`[DEBUG CALLBACK] Add Steps selected for process ${processId}`);
    await bot.answerCallbackQuery(callbackQuery.id, { text: "Adding steps" });
    await handleAddStep(bot, chatId, processId);
  }
  // Handle edit existing steps
  else if (data.startsWith("edit_existing_steps_") || data.startsWith("edit_step_")) {
    await handleEditStepsCallback(bot);
  }
  // Handle exit header edit mode
  else if (data.startsWith("edit_header_exit_")) {
    console.log(`[DEBUG CALLBACK] Exiting header edit mode for chatId: ${chatId}`);
    await bot.answerCallbackQuery(callbackQuery.id, { text: "Exiting header edit mode" });
    await bot.sendMessage(chatId, "Exited header edit mode.");
    
await displayViewMenu(bot, chatId) ;

}
  // Edit Steps and Reorder Steps branches (placeholders for further implementation)
  else if (data.startsWith("edit_steps_")) {
    const processId = data.replace("edit_steps_", "");
    console.log(`[DEBUG CALLBACK] Edit Steps selected for process ${processId}`);
    await bot.answerCallbackQuery(callbackQuery.id, { text: "Editing steps" });
    await bot.sendMessage(chatId, `You selected to edit a process step for process ${processId}. Please send the step ID and new details in the format: StepID|NewPrompt|NewDescription`);
  }
  else if (data.startsWith("reorder_steps_")) {
    const processId = data.replace("reorder_steps_", "");
    console.log(`[DEBUG CALLBACK] Reorder Steps selected for process ${processId}`);
    await bot.answerCallbackQuery(callbackQuery.id, { text: "Reordering steps" });
    await bot.sendMessage(chatId, `You selected to reorder steps for process ${processId}. Please send the step ID and direction (up/down) in the format: StepID|up or StepID|down`);
  }
  else {
    await handleViewMenuCallbacks(bot, callbackQuery);
  }
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

router.post('/download', async (req, res) => {
    console.log('[DEBUG ALT 1] /download endpoint triggered');
    try {
      const { fileId } = req.body;
  
      if (!fileId) {
        console.log('[DEBUG ALT 2] fileId is missing in the request body');
        return res.status(400).json({ error: 'fileId is required in the request body.' });
      }
  
      console.log(`[DEBUG ALT 3] Received fileId: ${fileId}`);
  
      const downloadDir = path.join(__dirname, '..', 'public', 'telegram_files');
      if (!fs.existsSync(downloadDir)) {
        console.log('[DEBUG ALT 4] Creating download directory');
        fs.mkdirSync(downloadDir, { recursive: true });
      }
  
      const getFileUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`;
      console.log(`[DEBUG ALT 5] Calling getFile API: ${getFileUrl}`);
      const fileInfoResponse = await axios.get(getFileUrl);
      if (!fileInfoResponse.data.ok) {
        throw new Error('Failed to get file info from Telegram API');
      }
      const filePath = fileInfoResponse.data.result.file_path;
      console.log(`[DEBUG ALT 6] Retrieved file_path: ${filePath}`);
  
      const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${filePath}`;
      console.log(`[DEBUG ALT 7] Constructed file URL: ${fileUrl}`);
  
      const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
      console.log('[DEBUG ALT 8] File downloaded from Telegram');
  
      const ext = path.extname(filePath) || '.dat';
      const newFileName = `telegram_file_${Date.now()}${ext}`;
      const newFilePath = path.join(downloadDir, newFileName);
  
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
  
// Express route for status check.
router.get('/status', (req, res) => {
  res.json({ status: 'Running' });
});

export default router;
