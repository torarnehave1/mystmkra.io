import Process from '../../../models/process.js';
import { handleAddStep } from '../addStepService.js';

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

/**
 * Handles callback queries for the "Edit Steps" button.
 * If the process has no steps, it immediately starts the step creation flow.
 * Otherwise, it displays the current steps and offers options to add or edit steps.
 *
 * @param {TelegramBot} bot - The Telegram bot instance.
 */
export function handleEditStepsCallback(bot) {
  bot.on('callback_query', async (callbackQuery) => {
    const { data, message } = callbackQuery;
    const chatId = message.chat.id;
    
    // Check if this callback is for editing steps.
    if (data.startsWith("edit_steps_")) {
      // Extract the process ID.
      const processId = data.replace("edit_steps_", "");
      console.log(`[DEBUG EDIT MENU] Edit Steps callback received for process: ${processId}`);
      
      // Answer the callback query to provide user feedback.
      await bot.answerCallbackQuery(callbackQuery.id, { text: `Processing steps for process: ${processId}` });
      
      try {
        const process = await Process.findById(processId);
        if (!process) {
          await bot.sendMessage(chatId, "Process not found.");
          return;
        }
        
        if (!process.steps || process.steps.length === 0) {
          // No steps exist—launch the step creation flow directly.
          await bot.sendMessage(chatId, "This process has no steps yet. Let's add a new step.");
          await handleAddStep(bot, chatId, processId);
        } else {
          // Steps exist—display them and provide options.
          let response = "Current steps:\n";
          process.steps.forEach((step, index) => {
            response += `${index + 1}. ${step.prompt}\n`;
          });
          response += "\nWould you like to add a new step or edit existing ones?";
          await bot.sendMessage(chatId, response, {
            reply_markup: {
              inline_keyboard: [
                [{ text: 'Add New Step', callback_data: `add_steps_manual_${processId}` }],
                [{ text: 'Edit Existing Steps', callback_data: `edit_existing_steps_${processId}` }]
              ]
            }
          });
        }
      } catch (error) {
        console.error(`[DEBUG EDIT MENU] Error processing steps for processId ${processId}: ${error.message}`);
        await bot.sendMessage(chatId, 'An error occurred while processing the steps. Please try again later.');
      }
    }
    // Check if this callback is for editing existing steps.
    else if (data.startsWith("edit_existing_steps_")) {
      const processId = data.replace("edit_existing_steps_", "");
      console.log(`[DEBUG EDIT MENU] Edit Existing Steps callback received for process: ${processId}`);
      
      try {
        const process = await Process.findById(processId);
        if (!process) {
          await bot.sendMessage(chatId, "Process not found.");
          return;
        }
        
        let response = "Select a step to edit:\n";
        const replyMarkup = {
          inline_keyboard: process.steps.map((step, index) => ([ 
            { text: `Step ${index + 1}: ${step.prompt}`, callback_data: `edit_step_${processId}_${index}` }
          ]))
        };
        await bot.sendMessage(chatId, response, { reply_markup: replyMarkup });
      } catch (error) {
        console.error(`[DEBUG EDIT MENU] Error fetching steps for processId ${processId}: ${error.message}`);
        await bot.sendMessage(chatId, 'An error occurred while fetching the steps. Please try again later.');
      }
    }
    // Check if this callback is for a specific step edit.
    else if (data.startsWith("edit_step_")) {
      const parts = data.split("_");
      const processId = parts[2];
      const stepIndex = parseInt(parts[3], 10);
      console.log(`[DEBUG EDIT MENU] Edit Step callback received for process: ${processId}, step index: ${stepIndex}`);
      
      try {
        const process = await Process.findById(processId);
        if (!process || !process.steps || !process.steps[stepIndex]) {
          await bot.sendMessage(chatId, "Step not found.");
          return;
        }
        
        const step = process.steps[stepIndex];
        await bot.sendMessage(chatId, `Editing Step ${stepIndex + 1}: ${step.prompt}\nPlease enter the new title:`);
        
        bot.once('message', async (msgTitle) => {
          if (msgTitle.chat.id !== chatId || !msgTitle.text) return;
          const newTitle = msgTitle.text.trim();
          console.log(`[DEBUG EDIT MENU] New title received: ${newTitle} for step index: ${stepIndex}`);
          
          await bot.sendMessage(chatId, 'Please enter the new description:');
          bot.once('message', async (msgDesc) => {
            if (msgDesc.chat.id !== chatId || !msgDesc.text) return;
            const newDescription = msgDesc.text.trim();
            console.log(`[DEBUG EDIT MENU] New description received: ${newDescription} for step index: ${stepIndex}`);
            
            process.steps[stepIndex].prompt = newTitle;
            process.steps[stepIndex].description = newDescription;
            await process.save();
            
            await bot.sendMessage(chatId, 'Step updated successfully.');
          });
        });
      } catch (error) {
        console.error(`[DEBUG EDIT MENU] Error editing step for processId ${processId}: ${error.message}`);
        await bot.sendMessage(chatId, 'An error occurred while editing the step. Please try again later.');
      }
    }
  });
}
