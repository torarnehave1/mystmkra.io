import Process from '../../../models/process.js';

/**
 * Sends the edit menu to the user.
 * The menu displays a list of processes with inline buttons for:
 * - Viewing the process
 * - Editing the header
 * - Editing the steps
 * - Reordering steps
 *
 * @param {TelegramBot} bot - The Telegram bot instance.
 * @param {Number} chatId - The chat ID to send the menu to.
 */
export async function sendEditMenu(bot, chatId) {
  try {
    // Query all processes (or filter as needed)
    const processes = await Process.find({});
    if (!processes || processes.length === 0) {
      await bot.sendMessage(chatId, "No processes found to edit.");
      return;
    }
    const replyMarkup = {
      inline_keyboard: processes.map(proc => ([
        { text: `Process: ${proc.title}`, callback_data: `view_process_${proc._id}` },
        { text: "Edit Header", callback_data: `edit_header_menu_${proc._id}` },
        { text: "Edit Steps", callback_data: `edit_steps_${proc._id}` },
        { text: "Reorder Steps", callback_data: `reorder_steps_${proc._id}` }
      ]))
    };
    await bot.sendMessage(chatId, "Select a process to edit:", { reply_markup: replyMarkup });
  } catch (error) {
    console.error(`[DEBUG editMenu] Error fetching processes for editing: ${error.message}`);
    await bot.sendMessage(chatId, "Error fetching processes for editing.");
  }
}
// Excalidraw:
// 1. Process: {proc.title}
// 2. Edit Header
// 3. Edit Steps    
// 4. Reorder Steps
//

// Usage:
// import { sendEditMenu } from './editMenu.js';
// await sendEditMenu(bot, chatId);
//
// The `sendEditMenu` function sends an inline keyboard menu to the user with options to edit processes.
// The menu includes buttons for viewing the process, editing the header, editing the steps, and reordering steps.
// The menu is populated with processes retrieved from the database.
// If no processes are found, the function sends a message indicating that no processes are available for editing.
// The function logs an error message if an error occurs while fetching processes.
// The function sends the menu to the chat ID provided as an argument.
// The function is exported for use in other modules.
// The function is asynchronous to allow for awaiting asynchronous operations.
// The function takes a Telegram bot instance and a chat ID as arguments.
// The function queries all processes from the database.
// The function constructs an inline keyboard menu with buttons for each process.
// The function constructs a reply markup object with the inline keyboard buttons.