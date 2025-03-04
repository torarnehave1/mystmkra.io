import Process from '../models/process.js';

/**
 * @file services/greenbot/helpers/processArchPublish.js
 * @module processArchPublish
 
 * @requires Process
 * @description This module contains helper functions for archiving and publishing processes.
 * It exports two functions: archiveProcess and publishProcess.
 * These functions update the isFinished property of a process to false or true, respectively.
 * The updated process is then sent to the user.
 * The functions also handle any errors that occur during the process update.
 * @see {@link module:connectProcess}
 * @see {@link module:inputValidator}
 * @see {@link module:ViewProcessHeader}
 * @see {@link module:answerService}
 * @see {@link module:processService}
 * /
 
/**
 * This function archives a process by setting its isFinished property to false.
 * The updated process is then sent to the user.
 * @param {object} bot - The Telegram bot instance.
 * @param {number} chatId - The chat ID.
 * @param {string} processId - The process ID.
 * @returns {Promise<void>} - A Promise that resolves when the process is archived.
 */


export async function archiveProcess(bot, chatId, processId) {
  try {
    const updatedProcess = await Process.findByIdAndUpdate(processId, { isFinished: false }, { new: true });
    console.log(`[DEBUG HELPER] Process archived successfully: ${updatedProcess}`);
    await bot.sendMessage(chatId, `Process archived successfully.`);
  } catch (error) {
    console.error(`[DEBUG HELPER] Error archiving process: ${error.message}`);
    await bot.sendMessage(chatId, `Failed to archive process: ${error.message}`);
  }
}

export async function publishProcess(bot, chatId, processId) {
  try {
    const updatedProcess = await Process.findByIdAndUpdate(processId, { isFinished: true }, { new: true });
    console.log(`[DEBUG HELPER] Process published successfully: ${updatedProcess}`);
    await bot.sendMessage(chatId, `Process published successfully.`);
  } catch (error) {
    console.error(`[DEBUG HELPER] Error publishing process: ${error.message}`);
    await bot.sendMessage(chatId, `Failed to publish process: ${error.message}`);
  }
}
