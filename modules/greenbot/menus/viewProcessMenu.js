import Process from '../models/process.js';
import { initializeProcess } from '../processInitializer.js';
import { archiveProcess } from '../helpers/processArchPublish.js';
import { viewProcessHeader } from '../ViewProcessHeader.js';

/**
 * @file services/greenbot/menus/viewProcessMenu.js
 * @module viewProcessMenu
 * @param {object} bot - The Telegram bot instance.
 * @param {number} chatId - The chat ID.
 * @returns {Promise<void>} - A Promise that resolves when the view menu is displayed.
 * @description This module handles the display of the view process menu.
 */

 


export async function displayViewMenu(bot, chatId) {
  console.log(`[DEBUG VIEW MENU] Displaying view menu for user ${chatId}`);

  try {
    const finishedProcesses = await Process.find({ isFinished: true });
    if (!finishedProcesses.length) {
      await bot.sendMessage(chatId, 'You have no finished processes.');
      return;
    }
    const uniqueProcesses = [
      ...new Map(finishedProcesses.map((p) => [p._id.toString(), p])).values(),
    ];
    const processButtons = uniqueProcesses.map((process) => [
      {
        text: `${process.title}\n${process.description}`,
        callback_data: `view_process_${process._id}`,
      },
      {
        text: "Archive",
        callback_data: `archive_process_${process._id}`
      },
      {
        text: "Delete",
        callback_data: `delete_process_${process._id}`
      }
    ]);
    await bot.sendMessage(chatId, 'Select a finished process to view, archive, or delete:', {
      reply_markup: { inline_keyboard: processButtons },
    });
    
    // Reset the UserState for viewing.
    await initializeProcess(bot, chatId, 'view_process');
  } catch (error) {
    console.error(`[ERROR] Failed to retrieve finished processes: ${error.message}`);
    await bot.sendMessage(chatId, 'An error occurred. Please try again later.');
  }
}

export async function handleViewMenuCallbacks(bot, callbackQuery) {
  const { data, message } = callbackQuery;
  const chatId = message.chat.id;

  if (data.startsWith('view_process_')) {
    const processId = data.replace('view_process_', '');
    console.log(`[DEBUG VIEW MENU] Viewing process ${processId}`);
    await bot.answerCallbackQuery(callbackQuery.id, { text: "Viewing process" });
    await viewProcessHeader(bot, chatId, processId);
  } else if (data.startsWith('archive_process_')) {
    const processId = data.replace('archive_process_', '');
    console.log(`[DEBUG VIEW MENU] Archiving process ${processId}`);
    await archiveProcess(bot, chatId, processId);
    await bot.answerCallbackQuery(callbackQuery.id, { text: "Process archived" });
    // Refresh the view menu to show the updated list
    await displayViewMenu(bot, chatId);
  } else if (data.startsWith('delete_process_')) {
    const processId = data.replace('delete_process_', '');
    console.log(`[DEBUG VIEW MENU] Deleting process ${processId}`);
    await deleteProcess(bot, chatId, processId);
    await bot.answerCallbackQuery(callbackQuery.id, { text: "Process deleted" });
    // Refresh the view menu to show the updated list
    await displayViewMenu(bot, chatId);
  }
}

async function deleteProcess(bot, chatId, processId) {
  try {
    await Process.findByIdAndDelete(processId);
    console.log(`[DEBUG DELETE PROCESS] Process ${processId} deleted successfully`);
    await bot.sendMessage(chatId, 'Process deleted successfully.');
  } catch (error) {
    console.error(`[ERROR] Failed to delete process: ${error.message}`);
    await bot.sendMessage(chatId, 'An error occurred while deleting the process. Please try again later.');
  }
}
