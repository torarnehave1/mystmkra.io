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
import { handleHeaderEditCallbacks } from '../services/greenbot/menus/editHeaderMenu.js';
import { displayViewMenu, handleViewMenuCallbacks } from '../services/greenbot/menus/viewProcessMenu.js';
import { displayCreateHeaderProcessMenu, handleCreateHeaderProcessMenu } from '../services/greenbot/menus/createHeaderProcessMenu.js';
import { sendEditMenu, handleEditStepsCallback, removeEditStepsCallback, removeEditStepCallback } from '../services/greenbot/menus/editMenu.js';
import { handleAddStep } from '../services/greenbot/addStepService.js';

const router = express.Router();
dotenv.config();

function extractProcessIdFromStartParam(startParam) {
  console.log(`[DEBUG GREENBOT] Extracting process ID from startParam: ${startParam}`);
  const match = startParam.match(/^view_process_(.+)$/);
  return match ? match[1] : null;
}

function extractProcessIdFromCallbackData(data) {
  const match = data.match(/(?:view_process_|start_process_|add_step_|finish_process_|edit_process_|edit_prompt_|edit_type_|next_step_|previous_step_|edit_title_|edit_description_|add_step_before_|add_step_after_|edit_image_url_|duplicate_process_|use_ai_|edit_category_|next_review_step_)([0-9a-fA-F]{24})/);
  return match ? match[1] : null;
}

const TELEGRAM_BOT_TOKEN = config.NODE_ENV === 'production' ? config.botToken2 : config.botToken2;
if (!TELEGRAM_BOT_TOKEN) {
  console.error('Error: Telegram bot token is not set in the environment variables.');
  process.exit(1);
}

// Initialize bot
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

// Remove existing listeners before adding new ones to prevent duplicates
handleHeaderEditCallbacks(bot);
removeEditStepsCallback(bot); // Ensure cleanup
handleEditStepsCallback(bot); // Register once
removeEditStepCallback(bot);

async function clearPendingUpdates(bot) {
  try {
    const updates = await bot.getUpdates({ offset: -1, limit: 1 });
    if (updates.length > 0) {
      const latestUpdateId = updates[0].update_id;
      await bot.getUpdates({ offset: latestUpdateId + 1 });
    }
  } catch (error) {
    console.error('[DEBUG] Error clearing pending updates:', error.message);
  }
}

bot.onText(/\/restart/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, "Restarting bot polling...");
  bot.stopPolling();
  await clearPendingUpdates(bot);
  setTimeout(() => bot.startPolling(), 3000);
});

bot.onText(/\/create/, async (msg) => {
  const chatId = msg.chat.id;
  await UserState.updateOne(
    { userId: chatId },
    { creationMode: null, processId: null, step: null, currentStepIndex: null, isProcessingStep: false },
    { upsert: true }
  );
  await displayCreateHeaderProcessMenu(bot, chatId);
});

handleCreateHeaderProcessMenu(bot);

bot.onText(/\/start(?: (.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const startParam = match[1];
  console.log(`[DEBUG GREENBOT] /start triggered by user ${chatId} with parameter: ${startParam}`);

  if (startParam) {
    const processId = extractProcessIdFromStartParam(startParam);
    console.log(`[DEBUG GREENBOT] Extracted process ID: ${processId}`);
    await initializeProcess(bot, chatId, 'view_process', processId);
    await viewProcessHeader(bot, chatId, processId);
  } else {
    await bot.sendMessage(chatId, "Welcome! Please select a process type to begin.");
  }
});

bot.onText(/\/view/, async (msg) => {
  const chatId = msg.chat.id;
  console.log(`[DEBUG GREENBOT] /view triggered by user ${chatId}`);
  await displayViewMenu(bot, chatId);
});

bot.onText(/\/edit/, async (msg) => {
  const chatId = msg.chat.id;
  console.log(`[DEBUG GREENBOT] /edit triggered by user ${chatId}`);
  await sendEditMenu(bot, chatId);
});

bot.on('callback_query', async (callbackQuery) => {
  const { data, message, id: callbackId } = callbackQuery;
  const chatId = message.chat.id;
  console.log(`[DEBUG CALLBACK] Callback ID: ${callbackId}, Data: ${data} [UNIQUE_CODE_12345]`);

  if (data.startsWith('create_header_')) return;

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
        await bot.sendMessage(chatId, "User state not found.");
        return;
      }
      userState.processId = processId;
      await userState.save();
      await goToFirstStep(bot, chatId, userState);
    } catch (error) {
      console.error(`[DEBUG CALLBACK] Error retrieving UserState: ${error.message}`);
      await bot.sendMessage(chatId, "Error retrieving user state.");
      return;
    }
  } else if (data === "next_step") {
    let userState;
    try {
      userState = await UserState.findOne({ userId: chatId });
      if (!userState || !userState.processId) {
        await bot.sendMessage(chatId, "Process not set.");
        return;
      }
      await handleNextStep(bot, chatId, userState);
    } catch (error) {
      console.error(`[DEBUG CALLBACK] Error retrieving UserState: ${error.message}`);
      await bot.sendMessage(chatId, "Error retrieving user state.");
      return;
    }
  } else if (data === "previous_step") {
    let userState;
    try {
      userState = await UserState.findOne({ userId: chatId });
      if (!userState || !userState.processId) {
        await bot.sendMessage(chatId, "Process not set.");
        return;
      }
      await handlePreviousStep(bot, chatId, userState);
    } catch (error) {
      console.error(`[DEBUG CALLBACK] Error retrieving UserState: ${error.message}`);
      await bot.sendMessage(chatId, "Error retrieving user state.");
      return;
    }
  } else if (data === "/reset") {
    await initializeProcess(bot, chatId, 'reset');
    await bot.sendMessage(chatId, "Process has been reset.");
  } else if (data.startsWith("add_steps_manual_")) {
    const processId = data.replace("add_steps_manual_", "");
    await bot.answerCallbackQuery(callbackId, { text: "Adding steps" });
    await handleAddStep(bot, chatId, processId);
  } else if (data.startsWith("edit_header_exit_")) {
    await bot.answerCallbackQuery(callbackId, { text: "Exiting header edit mode" });
    await bot.sendMessage(chatId, "Exited header edit mode.");
    await displayViewMenu(bot, chatId);
  } else {
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
      console.log('[DEBUG ALT 2] fileId is missing');
      return res.status(400).json({ error: 'fileId is required.' });
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
      throw new Error('Failed to get file info');
    }
    const filePath = fileInfoResponse.data.result.file_path;
    console.log(`[DEBUG ALT 6] Retrieved file_path: ${filePath}`);
    const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${filePath}`;
    console.log(`[DEBUG ALT 7] Constructed file URL: ${fileUrl}`);
    const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
    console.log('[DEBUG ALT 8] File downloaded');
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
    console.error('[DEBUG ALT 10] Error downloading file:', error.message);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

router.get('/status', (req, res) => {
  res.json({ status: 'Running' });
});

export default router;