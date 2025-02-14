import Process from '../models/process.js';
import UserState from '../models/UserState.js';

let currentStep = null; // Global variable to store the current step

// Function to handle editing a process step by step
export const handleEditProcess = async (bot, chatId, processId) => {
    try {
        console.log(`[DEBUG] Starting handleEditProcess for processId: "${processId}" and chatId: "${chatId}"`);
        const process = await Process.findById(processId);
        if (!process) {
            console.error(`[ERROR] Process not found for processId: "${processId}"`);
            await bot.sendMessage(chatId, 'The process could not be found. Please try again.');
            return;
        }

        let userState = await UserState.findOne({ userId: chatId });
        if (!userState) {
            console.log(`[DEBUG] Creating a new user state for user ${chatId}`);
            userState = new UserState({ userId: chatId });
            await userState.save();
        } else {
            console.log(`[DEBUG] Found existing user state for user ${chatId}`);
        }

        userState.processId = processId;
        userState.currentStepIndex = 0;
        userState.isEditingStep = true;
        await userState.save();
        console.log(`[DEBUG] User state updated and saved for user ${chatId}`);

        currentStep = process.steps[0];
        await presentEditStep(bot, chatId, processId, currentStep, userState);
        console.log(`[DEBUG] Presented edit step for processId: "${processId}" and chatId: "${chatId}"`);
    } catch (error) {
        console.error(`[ERROR] Failed to retrieve process details: ${error.message}`);
        await bot.sendMessage(chatId, 'An error occurred. Please try again later.');
    }
};

const presentEditStep = async (bot, chatId, processId, currentStep, userState) => {
  const stepIndex = userState.currentStepIndex;
  console.log(`[DEBUG] Presenting step ${stepIndex + 1}: ${currentStep.prompt}`);

  const process = await Process.findById(processId);
  if (!process) {
    console.error(`[ERROR] Process not found for processId: "${processId}"`);
    await bot.sendMessage(chatId, 'The process could not be found. Please try again.');
    return;
  }

  let message = `Editing Step ${stepIndex + 1}: ${currentStep.prompt}\n\n`;
  message += `Title: ${process.title}\n`;
  message += `Description: ${process.description}\n`;

  if (process.imageUrl) {
    await bot.sendPhoto(chatId, process.imageUrl, { caption: message, parse_mode: "HTML" });
  } else {
    await bot.sendMessage(chatId, message, { parse_mode: "HTML" });
  }

  await bot.sendMessage(chatId, `Editing Step ${stepIndex + 1}: <b>${currentStep.prompt}</b>`, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Edit Title', callback_data: `edit_title_${processId}` }],
        [{ text: 'Edit Description', callback_data: `edit_description_${processId}` }],
        [{ text: 'Edit Image URL', callback_data: `edit_image_url_${processId}` }],
        [{ text: 'Edit Prompt', callback_data: `edit_prompt_${processId}_${stepIndex}` }],
        [{ text: 'Edit Type', callback_data: `edit_type_${processId}_${stepIndex}` }],
        [
          { text: 'Previous Step', callback_data: `previous_step_${processId}` },
          { text: 'Next Step', callback_data: `next_step_${processId}` }
        ],
        [
          { text: 'Add Step Before', callback_data: `add_step_before_${processId}_${stepIndex}` },
          { text: 'Add Step After', callback_data: `add_step_after_${processId}_${stepIndex}` }
        ],
      ],
    },
  });
};

export const handleEditTitle = async (bot, chatId, processId) => {
  try {
    console.log(`[DEBUG] Starting handleEditTitle for processId: "${processId}" and chatId: "${chatId}"`);
    const process = await Process.findById(processId);
    if (!process) {
        console.error(`[ERROR] Process not found for processId: "${processId}"`);
        await bot.sendMessage(chatId, 'The process could not be found. Please try again.');
        return;
    }
    await bot.sendMessage(chatId, `${process.title}`);
    bot.once('message', async (msg) => {
      if (msg.chat.id !== chatId) return;
      const newTitle = msg.text;

      const process = await Process.findById(processId);
      if (!process) {
        console.error(`[ERROR] Process not found for processId: "${processId}"`);
        await bot.sendMessage(chatId, 'The process could not be found. Please try again.');
        return;
      }

      process.title = newTitle;
      await process.save();
      console.log(`[DEBUG] Process title updated for processId: "${processId}"`);

      await bot.sendMessage(chatId, `Title updated to: ${newTitle}`);
      await handleEditProcess(bot, chatId, processId);
    });
  } catch (error) {
    console.error(`[ERROR] Failed to update title: ${error.message}`);
    await bot.sendMessage(chatId, 'An error occurred. Please try again later.');
  }
};

export const handleEditDescription = async (bot, chatId, processId) => {
  try {
    console.log(`[DEBUG] Starting handleEditDescription for processId: "${processId}" and chatId: "${chatId}"`);
    const process = await Process.findById(processId);
    if (!process) {
      console.error(`[ERROR] Process not found for processId: "${processId}"`);
      await bot.sendMessage(chatId, 'The process could not be found. Please try again.');
      return;
    }

    await bot.sendMessage(chatId, `${process.description}`);

    bot.once('message', async (msg) => {
      if (msg.chat.id !== chatId) return;
      const newDescription = msg.text;

      process.description = newDescription;
      await process.save();
      console.log(`[DEBUG] Process description updated for processId: "${processId}"`);

      await bot.sendMessage(chatId, `Description updated to: ${newDescription}`);
      await handleEditProcess(bot, chatId, processId);
    });
  } catch (error) {
    console.error(`[ERROR] Failed to update description: ${error.message}`);
    await bot.sendMessage(chatId, 'An error occurred. Please try again later.');
  }
};

export const handleEditPrompt = async (bot, chatId, processId, stepIndex) => {
    try {
        console.log(`[DEBUG] Starting handleEditPrompt for processId: "${processId}", stepIndex: "${stepIndex}" and chatId: "${chatId}"`);
        await bot.sendMessage(chatId, `${currentStep.prompt}`);
        bot.once('message', async (msg) => {
            if (msg.chat.id !== chatId) return;
            const newPrompt = msg.text;

            const process = await Process.findById(processId);
            if (!process) {
                console.error(`[ERROR] Process not found for processId: "${processId}"`);
                await bot.sendMessage(chatId, 'The process could not be found. Please try again.');
                return;
            }

            process.steps[stepIndex].prompt = newPrompt;
            await process.save();
            console.log(`[DEBUG] Process prompt updated for processId: "${processId}", stepIndex: "${stepIndex}"`);

            await bot.sendMessage(chatId, `Prompt updated to: ${newPrompt}`);
            await handleEditProcess(bot, chatId, processId);
        });
    } catch (error) {
        console.error(`[ERROR] Failed to update prompt: ${error.message}`);
        await bot.sendMessage(chatId, 'An error occurred. Please try again later.');
    }
};

export const handleEditType = async (bot, chatId, processId, stepIndex) => {
  await bot.sendMessage(chatId, 'Please enter the new type:');
  bot.once('message', async (msg) => {
    if (msg.chat.id !== chatId) return;
    const newType = msg.text;

    const process = await Process.findById(processId);
    process.steps[stepIndex].type = newType;
    await process.save();

    await bot.sendMessage(chatId, `Type updated to: ${newType}`);
    await handleEditProcess(bot, chatId, processId);
  });
};

export const handleNextEditStep = async (bot, chatId, processId) => {
  try {
    const userState = await UserState.findOne({ userId: chatId });
    const process = await Process.findById(processId);

    if (!process || !process.steps) {
      console.error(`[ERROR] Process or steps not found for processId: "${processId}"`);
      await bot.sendMessage(chatId, 'An error occurred. Please try again later.');
      return;
    }

    userState.currentStepIndex += 1;
    if (userState.currentStepIndex >= process.steps.length) {
      await bot.sendMessage(chatId, 'You have edited all steps in this process.');
      userState.isEditingStep = false;
      await userState.save();
      return;
    }

    currentStep = process.steps[userState.currentStepIndex];
    await userState.save(); // Save the updated step index
    await presentEditStep(bot, chatId, processId, currentStep, userState);
  } catch (error) {
    console.error(`[ERROR] Failed to handle next edit step: ${error.message}`);
    await bot.sendMessage(chatId, 'An error occurred. Please try again later.');
  }
};

export const handlePreviousEditStep = async (bot, chatId, processId) => {
  try {
    const userState = await UserState.findOne({ userId: chatId });
    const process = await Process.findById(processId);

    if (!process || !process.steps) {
      console.error(`[ERROR] Process or steps not found for processId: "${processId}"`);
      await bot.sendMessage(chatId, 'An error occurred. Please try again later.');
      return;
    }

    userState.currentStepIndex -= 1;
    if (userState.currentStepIndex < 0) {
      await bot.sendMessage(chatId, 'You are already at the first step.');
      userState.currentStepIndex = 0;
      await userState.save();
      return;
    }

    currentStep = process.steps[userState.currentStepIndex];
    await userState.save(); // Save the updated step index
    await presentEditStep(bot, chatId, processId, currentStep, userState);
  } catch (error) {
    console.error(`[ERROR] Failed to handle previous edit step: ${error.message}`);
    await bot.sendMessage(chatId, 'An error occurred. Please try again later.');
  }
};

export const handleEditProcessTitle = async (bot, chatId, processId) => {
  try {
    console.log(`[DEBUG] Starting handleEditProcessTitle for processId: "${processId}" and chatId: "${chatId}"`);
    if (!processId) {
      console.error(`[ERROR] Process ID is null for chatId: "${chatId}"`);
      await bot.sendMessage(chatId, 'The process could not be found. Please try again.');
      return;
    }
    await bot.sendMessage(chatId, 'Please enter the new title:');
    bot.once('message', async (msg) => {
      if (msg.chat.id !== chatId) return;
      const newTitle = msg.text;

      const process = await Process.findById(processId);
      if (!process) {
        console.error(`[ERROR] Process not found for processId: "${processId}"`);
        await bot.sendMessage(chatId, 'The process could not be found. Please try again.');
        return;
      }

      process.title = newTitle;
      await process.save();
      console.log(`[DEBUG] Process title updated for processId: "${processId}"`);

      await bot.sendMessage(chatId, `Title updated to: ${newTitle}`);
      await handleEditProcess(bot, chatId, processId);
    });
  } catch (error) {
    console.error(`[ERROR] Failed to update title: ${error.message}`);
    await bot.sendMessage(chatId, 'An error occurred. Please try again later.');
  }
};

export const handleAddStepBefore = async (bot, chatId, processId, stepIndex) => {
  try {
    console.log(`[DEBUG] Starting handleAddStepBefore for processId: "${processId}", stepIndex: "${stepIndex}" and chatId: "${chatId}"`);
    await bot.sendMessage(chatId, 'Please enter the details for the new step:');
    bot.once('message', async (msg) => {
      if (msg.chat.id !== chatId) return;
      const newStepDetails = msg.text;

      const process = await Process.findById(processId);
      if (!process) {
        console.error(`[ERROR] Process not found for processId: "${processId}"`);
        await bot.sendMessage(chatId, 'The process could not be found. Please try again.');
        return;
      }

      const newStep = {
        stepId: `step_${Date.now()}`,
        type: 'text_process',
        prompt: newStepDetails,
        options: [],
        validation: { required: false, fileTypes: [] },
        metadata: { numQuestions: 3 },
      };

      process.steps.splice(stepIndex, 0, newStep);
      await process.save();
      console.log(`[DEBUG] New step added before stepIndex: "${stepIndex}" for processId: "${processId}"`);
      console.log(`[DEBUG] New step details: ${JSON.stringify(newStep)}`);

      await bot.sendMessage(chatId, 'New step added successfully.');
      await handleEditProcess(bot, chatId, processId);
    });
  } catch (error) {
    console.error(`[ERROR] Failed to add step before: ${error.message}`);
    await bot.sendMessage(chatId, 'An error occurred. Please try again later.');
  }
};

export const handleAddStepAfter = async (bot, chatId, processId, stepIndex) => {
  try {
    console.log(`[DEBUG] Starting handleAddStepAfter for processId: "${processId}", stepIndex: "${stepIndex}" and chatId: "${chatId}"`);
    await bot.sendMessage(chatId, 'Please enter the details for the new step:');
    bot.once('message', async (msg) => {
      if (msg.chat.id !== chatId) return;
      const newStepDetails = msg.text;

      const process = await Process.findById(processId);
      if (!process) {
        console.error(`[ERROR] Process not found for processId: "${processId}"`);
        await bot.sendMessage(chatId, 'The process could not be found. Please try again.');
        return;
      }

      const newStep = {
        stepId: `step_${Date.now()}`,
        type: 'text_process',
        prompt: newStepDetails,
        options: [],
        validation: { required: false, fileTypes: [] },
        metadata: { numQuestions: 3 },
      };

      process.steps.splice(stepIndex + 1, 0, newStep);
      await process.save();
      console.log(`[DEBUG] New step added after stepIndex: "${stepIndex}" for processId: "${processId}"`);
      console.log(`[DEBUG] New step details: ${JSON.stringify(newStep)}`);

      await bot.sendMessage(chatId, 'New step added successfully.');
      await handleEditProcess(bot, chatId, processId);
    });
  } catch (error) {
    console.error(`[ERROR] Failed to add step after: ${error.message}`);
    await bot.sendMessage(chatId, 'An error occurred. Please try again later.');
  }
};

export const handleEditImageUrl = async (bot, chatId, processId) => {
  try {
    console.log(`[DEBUG] Starting handleEditImageUrl for processId: "${processId}" and chatId: "${chatId}"`);
    await bot.sendMessage(chatId, 'Please enter the new image URL:');
    bot.once('message', async (msg) => {
      if (msg.chat.id !== chatId) return;
      const newImageUrl = msg.text;

      const process = await Process.findById(processId);
      if (!process) {
        console.error(`[ERROR] Process not found for processId: "${processId}"`);
        await bot.sendMessage(chatId, 'The process could not be found. Please try again.');
        return;
      }

      process.imageUrl = newImageUrl;
      await process.save();
      console.log(`[DEBUG] Process image URL updated for processId: "${processId}"`);

      await bot.sendMessage(chatId, `Image URL updated to: ${newImageUrl}`);
      await handleEditProcess(bot, chatId, processId);
    });
  } catch (error) {
    console.error(`[ERROR] Failed to update image URL: ${error.message}`);
    await bot.sendMessage(chatId, 'An error occurred. Please try again later.');
  }
};