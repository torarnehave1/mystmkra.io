import Process from '../models/process.js';
import config from '../config/config.js';

export const handleFinishProcess = async (bot, chatId, processId) => {
  console.log(`[DEBUG] Finishing process with processId: "${processId}" for chatId: ${chatId}`);

  try {
    // Fetch the process by ID
    const process = await Process.findById(processId);
    if (!process) {
      console.error(`[ERROR] Process not found for processId: "${processId}"`);
      await bot.sendMessage(chatId, 'The process could not be found. Please try again.');
      return;
    }

    // Mark the process as finished
    process.isFinished = true;
    await process.save();
    console.log(`[DEBUG] Process with processId: "${processId}" marked as finished`);

    // Notify the user
    await bot.sendMessage(chatId, `Process "${process.title}" has been successfully marked as finished. Thank you!`);

    // Generate and send deep link
    const botUsername = config.botUsername; // Assuming botUsername is in the config
    const deepLink = `https://t.me/${botUsername}?start=view_process_${process._id}`;
    await bot.sendMessage(chatId, `You can also use this link to view your processes: ${deepLink}`);
  } catch (error) {
    console.error(`[ERROR] Failed to finish process: ${error.message}`);
    await bot.sendMessage(chatId, 'An error occurred while finishing the process. Please try again later.');
  }
};
