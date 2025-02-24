import UserState from '../../../models/UserState.js';
import Process from '../../../models/process.js';
import mongoose from 'mongoose';
import { sendEditMenu } from '../menus/editMenu.js';

/**
 * Displays the create process header menu.
 * Provides two options: Create Manually or Create with AI.
 *
 * @param {TelegramBot} bot - The Telegram bot instance.
 * @param {Number} chatId - The Telegram chat ID.
 */
export async function displayCreateHeaderProcessMenu(bot, chatId) {
  console.log(`[DEBUG GREENBOT] /create header process menu displayed for user ${chatId}`);
  try {
    await bot.sendMessage(chatId, 'How would you like to create your process header?', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Create Manually', callback_data: 'create_header_manual' }],
          [{ text: 'Create with AI', callback_data: 'create_header_ai' }]
        ]
      }
    });
  } catch (error) {
    console.error(`[DEBUG GREENBOT] Error displaying create header process menu: ${error.message}`);
    await bot.sendMessage(chatId, 'Oops, something went wrong. Please try again!');
  }
}

/**
 * Starts the manual creation flow.
 * Uses chained bot.once calls to handle the following steps:
 *  1. Collect Title and create a new Process document.
 *  2. Prompt for and update the description.
 *  3. Prompt for and update the image URL (optional), and mark the process as finished.
 *
 * @param {TelegramBot} bot - The Telegram bot instance.
 * @param {Number} chatId - The Telegram chat ID.
 */
async function handleManualCreation(bot, chatId) {
  // Step 1: Ask for Title.
  await bot.sendMessage(chatId, 'Please enter the title for your process:');
  bot.once('message', async (msgTitle) => {
    if (msgTitle.chat.id !== chatId || !msgTitle.text) return;
    const title = msgTitle.text.trim();
    if (!title) {
      await bot.sendMessage(chatId, 'Title is required. Please enter the title for your process:');
      return;
    }
    try {
      // Create the process document. Process.create() automatically saves it.
      const newProcess = await Process.create({
        stepId: new mongoose.Types.ObjectId(),
        title: title,
        description: '',
        steps: [],
        createdBy: chatId,
        createdAt: Date.now(),
        isFinished: false
      });
      const processId = newProcess._id;
      console.log(`[DEBUG CREATE HEADER MENU] Process created with ID: ${processId} for chatId: ${chatId}`);
      // Update UserState with the new processId and move to the next step.
      await UserState.updateOne(
        { userId: chatId },
        { creationMode: 'manual', step: 'description', processId: processId, currentStepIndex: 1, isProcessingStep: true },
        { upsert: true }
      );
      // Step 2: Ask for Description.
      await bot.sendMessage(chatId, 'Please enter the description for your process:');
      bot.once('message', async (msgDesc) => {
        if (msgDesc.chat.id !== chatId || !msgDesc.text) return;
        const description = msgDesc.text.trim();
        console.log(`[DEBUG CREATE HEADER MENU] Description received: ${description} for processId: ${processId}`);
        await Process.findByIdAndUpdate(processId, { description });
        await UserState.updateOne(
          { userId: chatId },
          { step: 'imageUrl', currentStepIndex: 2 }
        );
        // Step 3: Ask for Image URL.
        await bot.sendMessage(chatId, 'Please enter the image URL for your process (optional):');
        bot.once('message', async (msgImage) => {
          if (msgImage.chat.id !== chatId) return;
          const imageUrl = msgImage.text ? msgImage.text.trim() : '';
          console.log(`[DEBUG CREATE HEADER MENU] Image URL received: ${imageUrl} for processId: ${processId}`);
          await Process.findByIdAndUpdate(processId, { imageUrl: imageUrl || undefined, isFinished: true });
          await UserState.updateOne(
            { userId: chatId },
            { step: 'pending', isProcessingStep: false }
          );
          await bot.sendMessage(chatId, 'Process created successfully. What next?', {
            reply_markup: {
              inline_keyboard: [
                [{ text: 'Add Steps Now', callback_data: `add_steps_manual_${processId}` }],
                [{ text: 'Save as Draft', callback_data: `draft_manual_${processId}` }]
              ]
            }
          });
        });
      });
    } catch (error) {
      console.error(`[DEBUG CREATE HEADER MENU] Error creating process: ${error.message}`);
      await bot.sendMessage(chatId, 'Failed to create process. Please try again later.');
    }
  });
}

/**
 * Handles the callback query and message flow for creating a process header.
 * This function is dedicated to processing callbacks that start with "create_header_".
 *
 * @param {TelegramBot} bot - The Telegram bot instance.
 */
export function handleCreateHeaderProcessMenu(bot) {
  // Callback query listener for create header actions.
  bot.on('callback_query', async (callbackQuery) => {
    const { data, message } = callbackQuery;
    const chatId = message.chat.id;
    // Only process callbacks with the "create_header_" prefix.
    if (!data.startsWith('create_header_') && !data.startsWith('draft_manual_')) return;
    
    console.log(`[DEBUG CREATE HEADER MENU] Callback query received: ${data} for chatId: ${chatId}`);
    try {
      if (data === 'create_header_manual') {
        console.log(`[DEBUG CREATE HEADER MENU] User selected manual creation for chatId: ${chatId}`);
        // Reset or update the UserState for a fresh creation session.
        await UserState.updateOne(
          { userId: chatId },
          { creationMode: 'manual', step: 'title', processId: null, currentStepIndex: 0, isProcessingStep: true },
          { upsert: true }
        );
        await bot.answerCallbackQuery(callbackQuery.id, { text: 'Starting manual creation' });
        // Begin the manual creation flow.
        handleManualCreation(bot, chatId);
      } else if (data === 'create_header_ai') {
        console.log(`[DEBUG CREATE HEADER MENU] User selected AI creation for chatId: ${chatId}`);
        await UserState.updateOne(
          { userId: chatId },
          { creationMode: 'ai', step: 'input', processId: null, currentStepIndex: 0, isProcessingStep: true },
          { upsert: true }
        );
        await bot.answerCallbackQuery(callbackQuery.id, { text: 'Starting AI creation' });
        await bot.sendMessage(chatId, 'Please send the title, description, and image URL (optional) in this format for AI to generate your process: Title|Description|ImageURL. Leave the last part blank if no image (e.g., My Process|This is a test||).');
      } else if (data.startsWith('draft_manual_')) {
        const processId = data.split('_')[2];
        console.log(`[DEBUG CREATE HEADER MENU] User selected to save as draft for processId: ${processId}`);
        await bot.answerCallbackQuery(callbackQuery.id, { text: 'Process saved as draft' });
        await bot.sendMessage(chatId, 'Your process has been saved as a draft. You can edit it from the list of processes.');
        await sendEditMenu(bot, chatId);
      } else {
        console.log(`[DEBUG CREATE HEADER MENU] Unrecognized callback data: ${data}`);
      }
    } catch (error) {
      console.error(`[DEBUG CREATE HEADER MENU] Error handling create header process menu callback: ${error.message}`);
      await bot.sendMessage(chatId, 'Oops, something went wrong. Please try again!');
    }
  });
}
