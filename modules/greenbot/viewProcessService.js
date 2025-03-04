
/**
 * @file services/greenbot/viewProcessService.js
 * @module viewProcessService
 * @description
 * This module contains functions for presenting a list of processes to the user.
 */


import Process from '../greenbot/models/process.js';

export async function presentProcessList(bot, chatId) {
  const debugPrefix = '[DEBUG viewProcessService presentProcessList]';
  try {
    const processes = await Process.find({ userId: chatId });
    if (processes.length === 0) {
      // await bot.sendMessage(chatId, "No processes found.");
      return;
    }

    const processList = processes.map((process, index) => ({
      text: `Process ${index + 1}: ${process.name}`,
      callback_data: `view_process_${process._id}`
    }));

    const inlineKeyboard = {
      inline_keyboard: processList.map(process => [process])
    };

    await bot.sendMessage(chatId, "Select a process to view:", {
      reply_markup: inlineKeyboard
    });
  } catch (error) {
    console.error(`${debugPrefix} ERROR: Failed to fetch processes: ${error.message}`);
    await bot.sendMessage(chatId, "Error fetching processes.");
  }
}
