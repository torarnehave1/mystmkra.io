/**
 * Module: viewProcessHeader.js
 * Function: viewProcessHeader
 *
 * This module exports a function that presents the process header for a given process.
 * It accepts a process ID, retrieves the process document from MongoDB, and sends the appropriate
 * Telegram message (photo or text) along with inline buttons ("Start" and "Exit").
 *
 * The "Exit" button is now configured to send a `/reset` callback command, which should trigger
 * the reset functionality in your bot.
 *
 * Usage:
 *   import { viewProcessHeader } from './viewProcessHeader.js';
 *   // then call:
 *   await viewProcessHeader(bot, chatId, processId);
 */

import dotenv from 'dotenv';
import Process from '../../models/process.js';
import {generateDeepLink} from './deeplink.js';
import config from '../../config/config.js';


// Load environment variables from .env file
dotenv.config();

export async function viewProcessHeader(bot, chatId, processId) {
  const debugPrefix = '[DEBUG viewProcessHeader viewProcessHeader]';
  const botUsername = config.botUsername;
  const url = generateDeepLink(botUsername, processId);
  console.log(`${debugPrefix} Generated deep link: ${url}`);

  console.log(`${debugPrefix} Displaying process header for processId: ${processId}`);

  if (!processId) {
    console.error(`${debugPrefix} ERROR: processId is undefined or empty.`);
    return;
  }

  // Retrieve the process document from MongoDB using the provided processId.
  let process;
  try {
    process = await Process.findById(processId);
  } catch (error) {
    console.error(`${debugPrefix} ERROR: Failed to fetch process: ${error.message}`);
    await bot.sendMessage(chatId, "An error occurred while fetching the process.");
    return;
  }

  if (!process || !process._id) {
    console.error(`${debugPrefix} ERROR: Process not found for processId: ${processId}`);
    await bot.sendMessage(chatId, "Process not found. Please try again later.");
    return;
  }

  console.log(`${debugPrefix} Process retrieved successfully with ID: ${process._id.toString()}`);

  // Helper function to truncate caption text if it exceeds Telegram's limits.
  function truncateCaption(caption) {
    const maxLen = 1024;
    return caption.length > maxLen ? caption.substring(0, maxLen) + '...' : caption;
  }

  // Prepare inline keyboard buttons for the message.
  const inlineKeyboard = {
    inline_keyboard: [
      [{ text: "Start", callback_data: `start_process_${processId}` }],
      // The "Exit" button now sends a "/reset" command.
      [{ text: "Exit", callback_data: `/reset` }],
    ],
  };

  // Check if process has an imageUrl and send the appropriate message.
  if (process.imageUrl) {
    const caption = `<b>${process.title}</b>\n\n<i>${process.description}</i>\n\n<b>Made in Mystmkra.io</b> - by AlivenessLAβ\n\n [${processId}]`;
    console.log(`${debugPrefix} Sending process image with caption: ${caption}`);
    await bot.sendPhoto(chatId, process.imageUrl, {
      caption: truncateCaption(caption),
      parse_mode: "HTML",
      reply_markup: inlineKeyboard,
    });
  } else {
    const caption = `<b>${process.title}</b>\n\n<b>Made in Mystmkra.io</b> - by AlivenessLAβ\n\n [${processId}]`;
    console.log(`${debugPrefix} Sending process message with caption: ${caption}`);
    await bot.sendMessage(chatId, truncateCaption(caption), {
      parse_mode: 'HTML',
      reply_markup: inlineKeyboard,
    });
  }
}
