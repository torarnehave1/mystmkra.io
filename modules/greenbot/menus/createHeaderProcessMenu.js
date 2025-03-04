import UserState from '../models/UserState.js';
import Process from '../models/process.js';
import mongoose from 'mongoose';
import { sendEditMenu } from '../menus/editMenu.js';
import handleCreateProcessAI from '../createProcessAI.js';
// Import the new description AI module (assume it's implemented similarly to handleCreateProcessAI)
import { handleCreateDescriptionAI } from '../createDescriptionAI.js';

/**
 * @file services/greenbot/menus/createHeaderProcessMenu.js
 * @module createHeaderProcessMenu

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
          [{ text: 'Create Process', callback_data: 'create_header_manual' }]
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
 * Uses chained bot.once calls to handle title, description, and image URL collection.
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
      // Create the process document.
      const newProcess = await Process.create({
        stepId: new mongoose.Types.ObjectId(),
        title: title,
        description: '',
        steps: [],
        createdBy: chatId,
        createdAt: Date.now(),
        isFinished: false,
        stepSequenceNumber: 1 // Initial sequence number
      });
      const processId = newProcess._id;
      console.log(`[DEBUG CREATE HEADER MENU] Process created with ID: ${processId} for chatId: ${chatId}`);
      // Update UserState with the new processId and move to the next step.
      await UserState.updateOne(
        { userId: chatId },
        { creationMode: 'manual', step: 'description', processId: processId, currentStepIndex: 1, isProcessingStep: true },
        { upsert: true }
      );
      // Step 2: Ask for Description with an inline choice.
      await bot.sendMessage(chatId, 'How would you like to set the description for your process?', {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Create Description with AI', callback_data: `create_desc_ai_${processId}` }],
            [{ text: 'Type Description Manually', callback_data: `type_desc_${processId}` }]
          ]
        }
      });
    } catch (error) {
      console.error(`[DEBUG CREATE HEADER MENU] Error creating process: ${error.message}`);
      await bot.sendMessage(chatId, 'Failed to create process. Please try again later.');
    }
  });
}

/**
 * Helper function to handle the AI creation flow for process steps.
 *
 * @param {TelegramBot} bot - The Telegram bot instance.
 * @param {Number} chatId - The Telegram chat ID.
 * @param {String} processId - The ID of the process.
 */
async function handleAICreationFlow(bot, chatId, processId) {
  await bot.sendMessage(chatId, 'AI is generating steps for your process. This may take a few moments. Please wait...');
  const process = await Process.findById(processId);
  if (process) {
    try {
      await handleCreateProcessAI(processId, process.title, process.description);
      await bot.sendMessage(chatId, 'Process steps generated successfully using AI.');
    } catch (error) {
      console.error(`[DEBUG CREATE HEADER MENU] Error during AI step generation: ${error.message}`);
      await bot.sendMessage(chatId, 'There was an error generating steps using AI. Please try again later.');
    }
  } else {
    await bot.sendMessage(chatId, 'Failed to find the process. Please try again later.');
  }
}

/**
 * Handles the callback query and message flow for creating a process header.
 * Processes callbacks that start with "create_header_", "create_desc_ai_", "type_desc_", "draft_manual_", or "add_steps_ai_".
 *
 * @param {TelegramBot} bot - The Telegram bot instance.
 */
export function handleCreateHeaderProcessMenu(bot) {
  // Callback query listener for create header actions.
  bot.on('callback_query', async (callbackQuery) => {
    try {
      // Immediately acknowledge the callback.
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'Processing...' });
      
      const { data, message } = callbackQuery;
      const chatId = message.chat.id;
      // Only process callbacks with the relevant prefixes.
      if (
        !data.startsWith('create_header_') && 
        !data.startsWith('create_desc_ai_') && 
        !data.startsWith('type_desc_') &&
        !data.startsWith('draft_manual_') && 
        !data.startsWith('add_steps_ai_')
      ) return;
      
      console.log(`[DEBUG CREATE HEADER MENU] Callback query received: ${data} for chatId: ${chatId}`);
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
      } else if (data.startsWith('create_desc_ai_')) {
        // User opted to have AI generate the description.
        const processId = data.split('_')[3];
        console.log(`[DEBUG CREATE HEADER MENU] User selected AI description creation for processId: ${processId}`);
        await bot.answerCallbackQuery(callbackQuery.id, { text: 'Generating description with AI. Please wait...' });
        const process = await Process.findById(processId);
        if (process) {
          try {
            // Use the new module to generate a description based on the process title.
            const aiDescription = await handleCreateDescriptionAI(processId, process.title);
            await Process.findByIdAndUpdate(processId, { description: aiDescription });
            await bot.sendMessage(chatId, `AI-generated description:\n\n${aiDescription}`);
            // Continue to the next step: Ask for the image URL.
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
                    [{ text: 'Add Steps with AI', callback_data: `add_steps_ai_${processId}` }],
                    [{ text: 'Save as Draft', callback_data: `draft_manual_${processId}` }]
                  ]
                }
              });
            });
          } catch (error) {
            console.error(`[DEBUG CREATE HEADER MENU] Error generating description: ${error.message}`);
            await bot.sendMessage(chatId, 'There was an error generating the description with AI. Please try again or type it manually.');
          }
        } else {
          await bot.sendMessage(chatId, 'Process not found. Please try again.');
        }
      } else if (data.startsWith('type_desc_')) {
        // User opted to type the description manually.
        const processId = data.split('_')[2];
        console.log(`[DEBUG CREATE HEADER MENU] User selected manual description entry for processId: ${processId}`);
        await bot.answerCallbackQuery(callbackQuery.id, { text: 'Please type your process description:' });
        await bot.sendMessage(chatId, 'Please enter the description for your process:'); // Ensure the user is asked to enter the description
        bot.once('message', async (msgDesc) => {
          if (msgDesc.chat.id !== chatId || !msgDesc.text) return;
          const description = msgDesc.text.trim();
          console.log(`[DEBUG CREATE HEADER MENU] Description received: ${description} for processId: ${processId}`);
          const process = await Process.findById(processId);
          await Process.findByIdAndUpdate(processId, { description, stepSequenceNumber: process.steps.length + 1 });
          // Continue to the next step: Ask for image URL.
          await bot.sendMessage(chatId, 'Please enter the image URL for your process (optional):');
          bot.once('message', async (msgImage) => {
            if (msgImage.chat.id !== chatId) return;
            const imageUrl = msgImage.text ? msgImage.text.trim() : '';
            console.log(`[DEBUG CREATE HEADER MENU] Image URL received: ${imageUrl} for processId: ${processId}`);
            await Process.findByIdAndUpdate(processId, { imageUrl: imageUrl || undefined, isFinished: true, stepSequenceNumber: process.steps.length + 2 });
            await UserState.updateOne(
              { userId: chatId },
              { step: 'pending', isProcessingStep: false }
            );
            await bot.sendMessage(chatId, 'Process created successfully. What next?', {
              reply_markup: {
                inline_keyboard: [
                  [{ text: 'Add Steps Now', callback_data: `add_steps_manual_${processId}` }],
                  [{ text: 'Add Steps with AI', callback_data: `add_steps_ai_${processId}` }],
                  [{ text: 'Save as Draft', callback_data: `draft_manual_${processId}` }]
                ]
              }
            });
          });
        });
      } else if (data.startsWith('add_steps_ai_')) {
        const processId = data.split('_')[3];
        console.log(`[DEBUG CREATE HEADER MENU] User selected AI creation for processId: ${processId}`);
        await UserState.updateOne(
          { userId: chatId },
          { creationMode: 'ai', step: 'input', processId: processId, currentStepIndex: 0, isProcessingStep: true },
          { upsert: true }
        );
        await bot.answerCallbackQuery(callbackQuery.id, { text: 'Starting AI creation' });
        await handleAICreationFlow(bot, chatId, processId);
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
      await bot.sendMessage(message.chat.id, 'Oops, something went wrong. Please try again!');
    }
  });
}
