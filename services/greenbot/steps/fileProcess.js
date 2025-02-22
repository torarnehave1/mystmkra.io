// File: ../steps/fileProcess.js

import dotenv from 'dotenv';
import fetch from 'node-fetch'; // Ensure you have node-fetch installed (or use global fetch in newer Node versions)
import config from '../../../config/config.js'; // Adjust the path as necessary
import { saveAnswer } from '../answerService.js';

dotenv.config();

/**
 * Inline function to validate file type.
 * It extracts the file extension from msg.document.file_name and checks
 * it against the allowedTypes array defined in the step's validation.
 *
 * @param {Object} file - The document object from Telegram.
 * @param {Array} allowedTypes - Array of allowed file type extensions (e.g., ['doc', 'docx', 'pdf']).
 * @returns {Boolean} - Returns true if the file's extension is allowed.
 */
function isValidFileType(file, allowedTypes) {
  const fileName = file.file_name || '';
  const extension = fileName.split('.').pop().toLowerCase();
  return allowedTypes.includes(extension);
}

/**
 * Module: fileProcess.js
 * Function: handleFileProcessStep
 *
 * Presents a file upload step to the user. It sends a prompt, waits for a document,
 * validates the file type using an inline function, dynamically constructs the download URL
 * using the configuration (ensuring no double slashes), fetches file details from the endpoint,
 * and then saves the answer and advances the process.
 *
 * Parameters:
 *   bot       - The Telegram bot instance.
 *   chatId    - The Telegram chat ID.
 *   userState - The current user's state (includes processId and currentStepIndex).
 *   step      - The current step object (includes prompt, description, validation, etc.).
 */
export default async function handleFileProcessStep(bot, chatId, userState, step) {
  const debugPrefix = '[DEBUG fileProcess handleFileProcessStep]';
  
  // Construct the prompt message.
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
  
  // Send the file upload prompt.
  //Send the message in parse mode HTML




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
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ fileId: msg.document.file_id }),
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch file: ${response.statusText}`);
        }
        const data = await response.json();
        console.log(`${debugPrefix} Received data from download endpoint: ${JSON.stringify(data)}`);
        
        // Save the answer (data.fileName) and update progress via answerService.
//Sende the file url to the user
        await bot.sendMessage(chatId, `File uploaded successfully: ${data.fileName}`);

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
