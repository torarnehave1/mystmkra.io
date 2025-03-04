import Process from '../models/process.js'; // Import the Process model
import { archiveProcess, publishProcess } from '../helpers/processArchPublish.js';
import handleCreateProcessAI from '../createProcessAI.js'; // Import the function to handle the creation of steps

/**
 * @file services/greenbot/menus/editHeaderMenu.js
 * @module editHeaderMenu
 * @param {Number} chatId - The Telegram chat ID.
 * @param {String} processId - The ID of the process to edit.
 * @param {TelegramBot} bot - The Telegram bot instance.
 * 
 */

/**
 * Trims the caption to fit within the allowed length for Telegram.
 *
 * @param {String} caption - The caption to trim.
 * @param {Number} maxLength - The maximum allowed length.
 * @returns {String} The trimmed caption.
 */
function trimCaption(caption, maxLength) {
  if (caption.length > maxLength) {
    return caption.substring(0, maxLength - 3) + '...';
  }
  return caption;
}

/**
 * Displays the header edit interface for a given process.
 * Shows the current header details (with an "(EDIT MODE)" indicator)
 * along with inline buttons for editing the title, description, replacing the image,
 * publishing, archiving, or exiting edit mode.
 *
 * @param {Number} chatId - The Telegram chat ID.
 * @param {String} processId - The ID of the process to edit.
 * @param {TelegramBot} bot - The Telegram bot instance.
 */
export async function displayHeaderEditInterface(chatId, processId, bot) {
  try {
    const process = await Process.findById(processId);
    if (!process) {
      await bot.sendMessage(chatId, "Process not found.");
      return;
    }
    const inlineKeyboard = {
      inline_keyboard: [
        [{ text: "Edit Title", callback_data: `edit_header_title_${processId}` }],
        [{ text: "Edit Description", callback_data: `edit_header_description_${processId}` }],
        [{ text: "Replace Image", callback_data: `edit_header_image_${processId}` }],
        [{ text: "Publish Process", callback_data: `edit_header_publish_${processId}` }],
        [{ text: "Archive Process", callback_data: `edit_header_archive_${processId}` }],
        [{ text: "Create Step by AI", callback_data: `edit_header_create_step_${processId}` }], // Add the new button
        [{ text: "Exit Edit", callback_data: `edit_header_exit_${processId}` }]
      ]
    };

    let caption;
    if (process.imageUrl) {
      caption = `<b>${process.title} (EDIT MODE)</b>\n\n<i>${process.description || ''}</i>\n\nImage: ${process.imageUrl}\n\n [${processId}]`;
      caption = trimCaption(caption, 1024); // Trim caption to fit within Telegram's limit
      console.log(`[DEBUG HEADER EDIT] Sending process image with caption: ${caption}`);
      await bot.sendPhoto(chatId, process.imageUrl, {
        caption: caption,
        parse_mode: "HTML",
        reply_markup: inlineKeyboard,
      });
    } else {
      caption = `<b>${process.title} (EDIT MODE)</b>\n\n<i>${process.description || ''}</i>\n\n [${processId}]`;
      caption = trimCaption(caption, 1024); // Trim caption to fit within Telegram's limit
      console.log(`[DEBUG HEADER EDIT] Sending process message with caption: ${caption}`);
      await bot.sendMessage(chatId, caption, {
        parse_mode: 'HTML',
        reply_markup: inlineKeyboard,
      });
    }
  } catch (error) {
    console.error(`[DEBUG HEADER EDIT] Error displaying header edit interface: ${error.message}`);
    console.error(`[DEBUG HEADER EDIT] Stack trace: ${error.stack}`);
    await bot.sendMessage(chatId, "Failed to display header edit interface.");
  }
}

/**
 * Extracts the action and process ID from the callback data.
 *
 * Expected format: "edit_header_<action>_<processId>"
 * where <action> is title, description, image, publish, archive, create_step, or exit,
 * and <processId> is a 24-character hexadecimal string.
 *
 * @param {String} data - The callback data string.
 * @returns {{ action: string, processId: string }|null} The extracted action and process ID, or null if not found.
 */
function extractActionAndProcessId(data) {
  console.log(`[DEBUG EXTRACT] Extracting action and process ID from data: ${data}`);
  const parts = data.split("_");
  if (parts.length >= 4 && parts[0] === "edit" && parts[1] === "header") {
    const action = parts.slice(2, parts.length - 1).join("_");
    const processId = parts[parts.length - 1];
    console.log(`[DEBUG EXTRACT] Extracted action: ${action}, processId: ${processId}`);
    return { action, processId };
  }
  console.error(`[DEBUG EXTRACT] Invalid data format: ${data}`);
  return null;
}

/**
 * Handles the callback queries for editing the process header.
 *
 * If the callback data starts with "edit_header_menu_", it means the user clicked
 * the "Edit Header" button in the edit menu, so the header edit interface is displayed.
 *
 * For the "publish" and "archive" actions, the process is updated immediately.
 * For other non-exit actions, it prompts for new input, updates the process,
 * and then re-displays the header edit interface.
 *
 * @param {TelegramBot} bot - The Telegram bot instance.
 */
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

export function handleHeaderEditCallbacks(bot) {
  bot.on('callback_query', async (callbackQuery) => {
    const { data, message, id: callbackQueryId } = callbackQuery;
    const chatId = message.chat.id;
    
    // Only process callbacks that start with "edit_header_"
    if (!data.startsWith('edit_header_')) {
      return; // Ignore other callback data (like create_header_manual)
    }
    
    console.log(`[DEBUG CALLBACK] Callback data received: ${data}`);
    
    // Check for edit menu header callback.
    if (data.startsWith('edit_header_menu_')) {
      const processId = data.substring('edit_header_menu_'.length);
      console.log(`[DEBUG CALLBACK] Received edit menu header callback for process: ${processId}`);
      await displayHeaderEditInterface(chatId, processId, bot);
      await bot.answerCallbackQuery(callbackQueryId, { text: "Header edit interface opened." });
      return;
    }
    
    // Extract action and processId from the callback data.
    const extracted = extractActionAndProcessId(data);
    if (!extracted) {
      console.error(`[DEBUG CALLBACK] Failed to extract action and process ID from data: ${data}`);
      await bot.answerCallbackQuery(callbackQueryId, { text: "Error: Invalid callback data." });
      return;
    }
    
    const { action, processId } = extracted;
    
    if (action === "exit") {
      await bot.answerCallbackQuery(callbackQueryId, { text: "Exiting header edit mode" });
      await bot.sendMessage(chatId, "Exited header edit mode.");
      return;
    }
    
    // Handle publish and archive immediately.
    if (action === "publish") {
      console.log(`[DEBUG CALLBACK] Handling publish action for process: ${processId}`);
      await publishProcess(bot, chatId, processId);
      await bot.answerCallbackQuery(callbackQueryId, { text: "Process published successfully." });
      await displayHeaderEditInterface(chatId, processId, bot);
      return;
    } else if (action === "archive") {
      console.log(`[DEBUG CALLBACK] Handling archive action for process: ${processId}`);
      await archiveProcess(bot, chatId, processId);
      await bot.answerCallbackQuery(callbackQueryId, { text: "Process archived successfully." });
      await displayHeaderEditInterface(chatId, processId, bot);
      return;
    }

    // Handle create step by AI.
    if (action === "create_step") {
      console.log(`[DEBUG CALLBACK] Handling create step by AI action for process: ${processId}`);
      try {
        const process = await Process.findById(processId);
        if (!process) {
          await bot.sendMessage(chatId, "Process not found.");
          return;
        }
        await handleCreateProcessAI(processId, process.title, process.description);
        await clearPendingUpdates(bot);
        await bot.answerCallbackQuery(callbackQueryId, { text: "Steps created successfully by AI." });
        await displayHeaderEditInterface(chatId, processId, bot);
      } catch (error) {
        console.error(`[DEBUG CALLBACK] Error creating steps by AI: ${error.message}`);
        await bot.sendMessage(chatId, `Failed to create steps by AI: ${error.message}`);
      }
      return;
    }
    
    // For editing title, description, or image, prompt for new input.
    await bot.answerCallbackQuery(callbackQueryId, { text: `Editing ${action}` });
    await bot.sendMessage(chatId, `Please send the new ${action} for process ${processId}:`);
    
    bot.once('message', async (msg) => {
      if (msg.chat.id !== chatId || !msg.text || msg.text.startsWith('/')) return;
      const newValue = msg.text.trim();
      let updateField = {};
      if (action === "title") {
        updateField.title = newValue;
      } else if (action === "description") {
        updateField.description = newValue;
      } else if (action === "image") {
        updateField.imageUrl = newValue;
      }
      try {
        const updatedProcess = await Process.findByIdAndUpdate(processId, updateField, { new: true });
        await bot.sendMessage(
          chatId,
          `Header updated successfully. New ${action}: ${action === "image" ? updatedProcess.imageUrl : updatedProcess[action]}`
        );
        await displayHeaderEditInterface(chatId, processId, bot);
      } catch (error) {
        console.error(`[DEBUG CALLBACK] Error updating header: ${error.message}`);
        await bot.sendMessage(chatId, `Failed to update header: ${error.message}`);
      }
    });
  });
}

/*
Excalidraw:
1. Edit Title
2. Edit Description
3. Replace Image
4. Publish Process
5. Archive Process
6. Exit Edit

Usage:
import { displayHeaderEditInterface, handleHeaderEditCallbacks } from './editHeaderMenu.js';
await displayHeaderEditInterface(chatId, processId, bot);
handleHeaderEditCallbacks(bot);

// The `displayHeaderEditInterface` function displays an edit interface for the header of a process,
// retrieving the process from the database and providing an inline keyboard for editing.
// The `handleHeaderEditCallbacks` function listens for button presses on this interface.
// If the callback data starts with "edit_header_menu_", it means the user selected "Edit Header" from the edit menu,
// so the header edit interface is displayed.
// For the "publish" and "archive" actions, the process is updated immediately without additional input.
// For other callbacks (like editing title, description, or image), the bot prompts for new input,
// updates the process, and refreshes the header edit interface.
// The "Exit Edit" button simply exits the edit mode.
*/
