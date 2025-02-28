import Process from '../../../models/process.js';
import { handleAddStep } from '../addStepService.js';
import { editProcessStep } from '../edit/editStep.js';

// Flag to prevent duplicate listener registration
let isEditStepsCallbackRegistered = false;

export async function sendEditMenu(bot, chatId) {
  try {
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

export function removeEditStepsCallback(bot) {
  bot.removeListener('callback_query', handleEditStepsCallback);
}

async function handleEditStepMessage(bot, msgTitle, chatId, process, stepIndex) {
  if (msgTitle.chat.id !== chatId || !msgTitle.text) return;
  const newTitle = msgTitle.text.trim();
  console.log(`[DEBUG EDIT MENU] New title received: ${newTitle} for step index: ${stepIndex}`);
  
  await bot.sendMessage(chatId, 'Please enter the new description:');
  bot.once('message', async (msgDesc) => {
    if (msgDesc.chat.id !== chatId || !msgDesc.text) return;
    const newDescription = msgDesc.text.trim();
    console.log(`[DEBUG EDIT MENU] New description received: ${newDescription} for step index: ${stepIndex}`);
    
    try {
      await editProcessStep(process._id, process.steps[stepIndex]._id.toString(), {
        prompt: newTitle,
        description: newDescription
      });
      await bot.sendMessage(chatId, 'Step updated successfully.');
    } catch (error) {
      console.error(`[DEBUG EDIT MENU] Error updating step: ${error.message}`);
      await bot.sendMessage(chatId, 'Failed to update step.');
    }
  });
}

export function removeEditStepCallback(bot) {
  bot.removeListener('message', handleEditStepMessage);
}

export function handleEditStepsCallback(bot) {
  if (isEditStepsCallbackRegistered) {
    console.log('[DEBUG EDIT MENU] Edit steps callback already registered, skipping.');
    return;
  }

  bot.on('callback_query', async (callbackQuery) => {
    const { data, message, id: callbackId } = callbackQuery;
    const chatId = message.chat.id;
    console.log(`[DEBUG EDIT MENU] Callback ID: ${callbackId}, Data: ${data}`);
    
    if (data.startsWith("edit_steps_")) {
      const processId = data.replace("edit_steps_", "");
      await bot.answerCallbackQuery(callbackId, { text: `Processing steps for process: ${processId}` });
      try {
        const process = await Process.findById(processId);
        if (!process) {
          await bot.sendMessage(chatId, "Process not found.");
          return;
        }
        if (!process.steps || process.steps.length === 0) {
          await bot.sendMessage(chatId, "This process has no steps yet. Let's add a new step.");
          await handleAddStep(bot, chatId, processId);
        } else {
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
        await bot.sendMessage(chatId, 'An error occurred while processing the steps.');
      }
    } else if (data.startsWith("edit_existing_steps_")) {
      const processId = data.replace("edit_existing_steps_", "");
      await bot.answerCallbackQuery(callbackId, { text: "Fetching steps" });
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
        await bot.sendMessage(chatId, 'An error occurred while fetching the steps.');
      }
    } else if (data.startsWith("edit_step_")) {
      const parts = data.split("_");
      const processId = parts[2];
      const stepIndex = parseInt(parts[3], 10);
      await bot.answerCallbackQuery(callbackId, { text: "Editing step" });
      try {
        const process = await Process.findById(processId);
        if (!process || !process.steps || !process.steps[stepIndex]) {
          await bot.sendMessage(chatId, "Step not found.");
          return;
        }
        const step = process.steps[stepIndex];
        await bot.sendMessage(chatId, `Editing Step ${stepIndex + 1}: ${step.prompt}\nPlease enter the new title:`);
        removeEditStepCallback(bot);
        bot.once('message', (msgTitle) => handleEditStepMessage(bot, msgTitle, chatId, process, stepIndex));
      } catch (error) {
        console.error(`[DEBUG EDIT MENU] Error editing step for processId ${processId}: ${error.message}`);
        await bot.sendMessage(chatId, 'An error occurred while editing the step.');
      }
    }
  });

  isEditStepsCallbackRegistered = true;
  console.log('[DEBUG EDIT MENU] Edit steps callback registered.');
}