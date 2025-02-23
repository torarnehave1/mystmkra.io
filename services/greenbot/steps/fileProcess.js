// File: ../steps/fileProcess.js

import dotenv from 'dotenv';
import fetch from 'node-fetch'; // Ensure you have node-fetch installed (or use global fetch in newer Node versions)
import config from '../../../config/config.js'; // Adjust the path as necessary
import { saveAnswer } from '../answerService.js';
import { convertPdfToMarkdown } from '../helpers/pdftomarkdown.js';

dotenv.config();

function isValidFileType(file, allowedTypes) {
  const fileName = file.file_name || '';
  const extension = fileName.split('.').pop().toLowerCase();
  return allowedTypes.includes(extension);
}

export default async function handleFileProcessStep(bot, chatId, userState, step) {
  const debugPrefix = '[DEBUG fileProcess handleFileProcessStep]';
  
  let message = `<b>Step ${step.stepSequenceNumber} (File Upload):</b> ${step.prompt}`;
  if (step.description) {
    message += `\n\n<i>${step.description}</i>`;
  }
  
  // Build inline keyboard for navigation.
  const inlineKeyboard = { inline_keyboard: [] };
  const navRow = [];
  if (userState.currentStepIndex > 0) {
    navRow.push({ text: "Previous", callback_data: "previous_step" });
  }
  navRow.push({ text: "Next", callback_data: "next_step" });
  inlineKeyboard.inline_keyboard.push(navRow);
  
  console.log(`${debugPrefix} Presenting file upload for processId: ${userState.processId}`);
  await bot.sendMessage(chatId, message, { parse_mode: 'HTML', reply_markup: inlineKeyboard });
  
  // Listen for a document upload.
  bot.once('document', async (msg) => {
    if (msg.chat.id !== chatId) return; // Ignore documents from other chats
    
    const allowedTypes = step.validation.fileTypes || [];
    if (isValidFileType(msg.document, allowedTypes)) {
      console.log(`${debugPrefix} Received file with file_id: ${msg.document.file_id}`);
      
      // Remove trailing slash from BASE_URL to prevent double slash.
      const baseUrl = config.BASE_URL.replace(/\/$/, '');
      const downloadUrl = `${baseUrl}/green/download`;
      console.log(`${debugPrefix} Using download URL: ${downloadUrl}`);
      
      try {
        const response = await fetch(downloadUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileId: msg.document.file_id }),
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch file: ${response.statusText}`);
        }
        const data = await response.json();
        console.log(`${debugPrefix} Received data from download endpoint: ${JSON.stringify(data)}`);
        
        // Convert the downloaded PDF to Markdown
        const markdownFilePath = await convertPdfToMarkdown(data.filePath);
        
        // Save the answer (data.fileName) and update progress via answerService.
        await saveAnswer({
          bot,
          chatId,
          processId: userState.processId,
          stepIndex: userState.currentStepIndex,
          answer: data.fileName,
          stepType: step.type,
          stepPrompt: step.prompt,
          stepDescription: step.description,
        });
        
        // Send a new message with a "Confirm Upload" button.
        const confirmKeyboard = {
          inline_keyboard: [
            [{ text: "Confirm Upload", callback_data: "confirm_upload" }]
          ]
        };
        await bot.sendMessage(chatId, 'File uploaded successfully. Please confirm upload.', {
          reply_markup: confirmKeyboard
        });
        
        // Listen for the confirm upload callback.
        bot.once('callback_query', async (callbackQuery) => {
          // Ensure the callback is from the same chat.
          if (callbackQuery.message.chat.id !== chatId) return;
          if (callbackQuery.data === 'confirm_upload') {
            await bot.answerCallbackQuery(callbackQuery.id, { text: 'Upload confirmed' });
            console.log(`${debugPrefix} Upload confirmed by user.`);
            // Optionally, you can also send a confirmation message:
            await bot.sendMessage(chatId, 'Your file upload has been confirmed.');
          }
        });
        
      } catch (error) {
        console.error(`${debugPrefix} ERROR: Failed to fetch file: ${error.message}`);
        console.error(`${debugPrefix} ERROR Details: ${error.stack}`);
        await bot.sendMessage(chatId, 'An error occurred while processing your file. Please try again.');
        return;
      }
    } else {
      await bot.sendMessage(chatId, `Invalid file type. Allowed types are: ${allowedTypes.join(', ')}`);
    }
  });
}
