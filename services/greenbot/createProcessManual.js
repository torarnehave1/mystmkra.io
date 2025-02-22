import UserState from '../../models/UserState.js';
import Process from '../../models/process.js';

export const handleCreateProcessManual = async (bot, chatId) => {
  console.log(`[DEBUG] User ${chatId} selected manual process creation`);
  await bot.sendMessage(chatId, 'Please provide a title for your process:');

  bot.once('message', async (msg) => {
    const processTitle = msg.text;
    console.log(`[DEBUG] Received process title: "${processTitle}" from user ${chatId}`);

    const newProcess = new Process({
      title: processTitle,
      description: '',
      steps: [],
      createdBy: chatId,
    });

    try {
      await newProcess.save(); // The process is saved to the database here
      console.log(`[DEBUG] Process saved with processId: "${newProcess._id}"`);
    } catch (error) {
      console.error(`[ERROR] Failed to save process: ${error.message}`);
      await bot.sendMessage(chatId, 'An error occurred while saving the process. Please try again later.');
      return;
    }

    const userState = await UserState.findOne({ userId: chatId });
    userState.processId = newProcess._id; // The processId is saved in the user state here
    await userState.save();

    await bot.sendMessage(chatId, `Process "${processTitle}" has been created. What would you like to do next?`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Add Step', callback_data: `add_step_${newProcess._id}` }],
          [{ text: 'Finish Process', callback_data: `finish_process_${newProcess._id}` }],
        ],
      },
    });
  });
};
