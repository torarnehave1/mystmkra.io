import Process from '../../../models/process.js';
import { initializeProcess } from '../processInitializer.js';
import config from '../../../config/config.js';
import { archiveProcess } from '../helpers/processArchPublish.js';

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
    const botUsername = config.botUsername;
    const processButtons = uniqueProcesses.map((process) => [
      {
        text: `${process.title}\n${process.description}`,
        url: `https://t.me/${botUsername}?start=view_process_${process._id}`,
      },
      {
        text: "Archive",
        callback_data: `archive_process_${process._id}`
      }
    ]);
    await bot.sendMessage(chatId, 'Select a finished process to view or archive:', {
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
    // Implement the logic to handle viewing the process
    await bot.answerCallbackQuery(callbackQuery.id, { text: "Viewing process" });
    // Add your logic here to display the process details
  } else if (data.startsWith('archive_process_')) {
    const processId = data.replace('archive_process_', '');
    console.log(`[DEBUG VIEW MENU] Archiving process ${processId}`);
    await archiveProcess(bot, chatId, processId);
    await bot.answerCallbackQuery(callbackQuery.id, { text: "Process archived" });
    // Refresh the view menu to show the updated list
    await displayViewMenu(bot, chatId);
  }
}
