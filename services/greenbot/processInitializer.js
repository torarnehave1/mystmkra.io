import dotenv from 'dotenv';
import UserState from '../../models/UserState.js';
import { handleCreateProcessManual } from '../greenbot/createProcessManual.js';
import handleCreateProcessAI from '../greenbot/createProcessAI.js';
import { handleEditProcess } from '../greenbot/editProcessService.js';
// Optionally, import handleViewProcess if available.

dotenv.config();

/**
 * Module: processInitializer.js
 * Function: initializeProcess
 *
 * Resets and initializes the UserState for a given process type.
 *
 * Supported process types:
 *  - 'create_process_manual'
 *  - 'create_process_ai'
 *  - 'edit_process'
 *  - 'view_process'
 *  - 'reset'
 *
 * For 'edit_process' and 'view_process', a processId must be provided.
 *
 * Usage:
 *   import { initializeProcess } from './processInitializer.js';
 *   await initializeProcess(bot, chatId, processType, processId);
 *
 * Parameters:
 *   bot         - The Telegram bot instance.
 *   chatId      - The Telegram chat ID (user identifier).
 *   processType - A string indicating the type of process initialization.
 *   processId   - (Optional) The process ID; required for editing or viewing an existing process.
 */
export async function initializeProcess(bot, chatId, processType, processId = null) {
  const debugPrefix = '[DEBUG processInitializer initializeProcess]';
  let userState;
  
  try {
    userState = await UserState.findOne({ userId: chatId });
    if (!userState) {
      // Create a new UserState if one doesn't exist.
      userState = new UserState({
        userId: chatId,
        processId: null,
        currentStepIndex: 0,
        answers: [],
        isProcessingStep: false,
      });
    } else {
      // Reset the existing UserState.
      userState.processId = null;
      userState.currentStepIndex = 0;
      userState.answers = [];
      userState.isProcessingStep = false;
    }
    await userState.save();
    console.log(`${debugPrefix} UserState initialized for user ${chatId} with process type "${processType}".`);
  } catch (error) {
    console.error(`${debugPrefix} ERROR: Failed to initialize UserState: ${error.message}`);
    await bot.sendMessage(chatId, "Error initializing process. Please try again later.");
    return;
  }
  
  // Handle different process types.
  switch (processType) {
    case 'create_process_manual':
      await handleCreateProcessManual(bot, chatId);
      break;
    case 'create_process_ai':
      await handleCreateProcessAI(bot, chatId);
      break;
    case 'edit_process':
      if (!processId) {
        console.error(`${debugPrefix} ERROR: processId is required for editing process.`);
        await bot.sendMessage(chatId, "Process ID required for editing.");
        return;
      }
      userState.processId = processId;
      await userState.save();
      await handleEditProcess(bot, chatId, processId);
      break;
    case 'view_process':
      if (!processId) {
        console.error(`${debugPrefix} ERROR: processId is required for viewing process.`);
        await bot.sendMessage(chatId, "Please select a process to view.");
        return;
      }
      userState.processId = processId;
      await userState.save();
      // Optionally, if you have a view process handler, call it here.
      break;
    case 'reset':
      // For reset, simply leave processId null and reset the state.
      userState.processId = null;
      await userState.save();
      console.log(`${debugPrefix} UserState reset for user ${chatId}.`);
      break;
    default:
      console.error(`${debugPrefix} ERROR: Unknown process type: ${processType}`);
      await bot.sendMessage(chatId, "Unknown process type.");
      break;
  }
}
// Usage:
// import { initializeProcess } from './processInitializer.js';
// await initializeProcess(bot, chatId, processType, processId);
//
// Parameters:
//   bot         - The Telegram bot instance.
//   chatId      - The Telegram chat ID (user identifier).
//   processType - A string indicating the type of process initialization.
//   processId   - (Optional) The process ID; required for editing or viewing an existing process.
//
// Supported process types:
//  - 'create_process_manual'
//  - 'create_process_ai'
//  - 'edit_process'
//  - 'view_process'
//  - 'reset'
//
// For 'edit_process' and 'view_process', a processId must be provided.
//
// Example usage:
// await initializeProcess(bot, chatId, 'create_process_manual');
// await initializeProcess(bot, chatId, 'create_process_ai');
// await initializeProcess(bot, chatId, 'edit_process', processId);
// await initializeProcess(bot, chatId, 'view_process', processId);
// await initializeProcess(bot, chatId, 'reset');
//
// Note: The 'view_process' type requires a view process handler to be implemented.
//
// For more information, refer to the GreenBot documentation.
//
// This code snippet is part of the GreenBot project.
// Learn more at
//
//
