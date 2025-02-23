import Process from '../../../models/process.js';

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
