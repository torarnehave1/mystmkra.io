import Process from '../../models/process.js';
import UserState from '../../models/UserState.js';
import ProcessCategories from '../../models/ProcessCategories.js'; // Import ProcessCategories model

let currentStep = null; // Global variable to store the current step

// Function to handle editing a process step by step
export const handleEditProcess = async (bot, chatId, processId) => {
  try {
    console.log(`[DEBUG][HEP1] Starting handleEditProcess for processId: "${processId}" and chatId: "${chatId}"`);
    const process = await Process.findById(processId);
    if (!process) {
      console.error(`[ERROR][HEP2] Process not found for processId: "${processId}"`);
      await bot.sendMessage(chatId, 'The process could not be found. Please try again.');
      return;
    }

    let userState = await UserState.findOne({ userId: chatId });
    if (!userState) {
      console.log(`[DEBUG][HEP3] Creating a new user state for user ${chatId}`);
      userState = new UserState({ userId: chatId });
      await userState.save();
    } else {
      console.log(`[DEBUG][HEP4] Found existing user state for user ${chatId}`);
    }

    userState.processId = processId;
    userState.currentStepIndex = 0;
    userState.isEditingStep = true;
    await userState.save();
    console.log(`[DEBUG][HEP5] User state updated and saved for user ${chatId}`);

    currentStep = process.steps[0];
    await presentEditStep(bot, chatId, processId, currentStep, userState);
    console.log(`[DEBUG][HEP6] Presented edit step for processId: "${processId}" and chatId: "${chatId}"`);
  } catch (error) {
    console.error(`[ERROR][HEP7] Failed to retrieve process details: ${error.message}`);
    await bot.sendMessage(chatId, 'An error occurred. Please try again later.');
  }
};

const presentEditStep = async (bot, chatId, processId, currentStep, userState) => {
  const stepIndex = userState.currentStepIndex;
  console.log(`[DEBUG][PES1] Presenting step ${stepIndex + 1}: ${currentStep.prompt}`);

  const process = await Process.findById(processId);
  if (!process) {
    console.error(`[ERROR][PES2] Process not found for processId: "${processId}"`);
    await bot.sendMessage(chatId, 'The process could not be found. Please try again.');
    return;
  }

  let message = ` `;
  if (stepIndex === 0) {
    message += `<b>${process.title}</b>\n\n`;
    message += `${process.description}\n\n`;
   
   

    // Fetch category details
    if (process.processCategory) {
      const category = await ProcessCategories.findById(process.processCategory);
      if (category) {
        message += `<b>${category.name}</b>\n`;
        message += `<i>${category.description}</i>` || 'No description available';
      } else {
        message += `Category: None\n`;
      }
    } else {
      message += `Category: None\n`;
    }
  } else {
    message += `${currentStep.description}\n`;
  }

  // Truncate the message if it is too long
  const maxLength = 1024; // Telegram's maximum caption length
  if (message.length > maxLength) {
    message = message.substring(0, maxLength - 3) + '...';
  }

  if (process.imageUrl) {
    await bot.sendPhoto(chatId, process.imageUrl, { caption: message, parse_mode: "HTML" });
  } else {
    if (message.trim()) { // Ensure message is non-empty
      await bot.sendMessage(chatId, message, { parse_mode: "HTML" });
    }
  }

  await bot.sendMessage(chatId, `Editing Step ${stepIndex + 1}: <b>${currentStep.prompt}</b>\n\n <i>${currentStep.description}</i>\n`, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [
          { text: 'Previous Step', callback_data: `previous_step_${processId}_${stepIndex}` },
          { text: 'Next Step', callback_data: `next_step_${processId}_${stepIndex}` }
        ],
        [{ text: 'Edit Title', callback_data: `edit_title_${processId}` }],
        [{ text: 'Edit Description', callback_data: `edit_description_${processId}` }],
        [{ text: 'Edit Image URL', callback_data: `edit_image_url_${processId}` }],
        [{ text: 'Edit Prompt', callback_data: `edit_prompt_${processId}_${stepIndex}` }],
        [{ text: 'Edit Type', callback_data: `edit_type_${processId}_${stepIndex}` }],
        [{ text: 'Edit Step Description', callback_data: `edit_step_description_${processId}_${stepIndex}` }],
        [{ text: 'Edit Category', callback_data: `edit_category_${processId}` }], // Add the new button for editing category
        [
          { text: 'Add Step Before', callback_data: `add_step_before_${processId}_${stepIndex}` },
          { text: 'Add Step After', callback_data: `add_step_after_${processId}_${stepIndex}` }
        ],
        [{ text: 'Use AI to create process', callback_data: `use_ai_${processId}` }], // Add the new button
      ],
    },
  });
};

export const handleEditTitle = async (bot, chatId, processId) => {
  try {
    console.log(`[DEBUG][HET1] Starting handleEditTitle for processId: "${processId}" and chatId: "${chatId}"`);
    const process = await Process.findById(processId);
    if (!process) {
        console.error(`[ERROR][HET2] Process not found for processId: "${processId}"`);
        await bot.sendMessage(chatId, 'The process could not be found. Please try again.');
        return;
    }
    await bot.sendMessage(chatId, `${process.title}`);
    bot.once('message', async (msg) => {
      if (msg.chat.id !== chatId) return;
      const newTitle = msg.text;

      const process = await Process.findById(processId);
      if (!process) {
        console.error(`[ERROR][HET3] Process not found for processId: "${processId}"`);
        await bot.sendMessage(chatId, 'The process could not be found. Please try again.');
        return;
      }

      process.title = newTitle;
      await process.save();
      console.log(`[DEBUG][HET4] Process title updated for processId: "${processId}"`);

      await bot.sendMessage(chatId, `Title updated to: ${newTitle}`);
      await handleEditProcess(bot, chatId, processId);
    });
  } catch (error) {
    console.error(`[ERROR][HET5] Failed to update title: ${error.message}`);
    await bot.sendMessage(chatId, 'An error occurred. Please try again later.');
  }
};

export const handleEditDescription = async (bot, chatId, processId) => {
  try {
    console.log(`[DEBUG][HED1] Starting handleEditDescription for processId: "${processId}" and chatId: "${chatId}"`);
    const process = await Process.findById(processId);
    if (!process) {
      console.error(`[ERROR][HED2] Process not found for processId: "${processId}"`);
      await bot.sendMessage(chatId, 'The process could not be found. Please try again.');
      return;
    }

    // Send the current description to the user
    await bot.sendMessage(chatId, `Current Description: ${process.description}`);

    bot.once('message', async (msg) => {
      if (msg.chat.id !== chatId) return;
      const newDescription = msg.text;

      process.description = newDescription;
      await process.save();
      console.log(`[DEBUG][HED3] Process description updated for processId: "${processId}"`);

      await bot.sendMessage(chatId, `Description updated to: ${newDescription}`);
      await handleEditProcess(bot, chatId, processId);
    });
  } catch (error) {
    console.error(`[ERROR][HED4] Failed to update description: ${error.message}`);
    await bot.sendMessage(chatId, 'An error occurred. Please try again later.');
  }
};

export const handleEditPrompt = async (bot, chatId, processId, stepIndex) => {
  try {
    console.log(`[DEBUG][HEPR1] Starting handleEditPrompt for processId: "${processId}", stepIndex: "${stepIndex}" and chatId: "${chatId}"`);
    await bot.sendMessage(chatId, `XYZ${currentStep.prompt}`);
    bot.once('message', async (msg) => {
      if (msg.chat.id !== chatId) return;
      const newPrompt = msg.text;

      const process = await Process.findById(processId);
      if (!process) {
        console.error(`[ERROR][HEPR2] Process not found for processId: "${processId}"`);
        await bot.sendMessage(chatId, 'The process could not be found. Please try again.');
        return;
      }

      process.steps[stepIndex].prompt = newPrompt;
      await process.save();
      console.log(`[DEBUG][HEPR3] Process prompt updated for processId: "${processId}", stepIndex: "${stepIndex}"`);

      await bot.sendMessage(chatId, `Prompt updated to: ${newPrompt}`);
      await handleEditProcess(bot, chatId, processId);
    });
  } catch (error) {
    console.error(`[ERROR][HEPR4] Failed to update prompt: ${error.message}`);
    await bot.sendMessage(chatId, 'An error occurred. Please try again later.');
  }
};

export const handleEditType = async (bot, chatId, processId, stepIndex) => {
  try {
    console.log(`[DEBUG][HETP1] Starting handleEditType for processId: "${processId}", stepIndex: "${stepIndex}" and chatId: "${chatId}"`);
    await bot.sendMessage(chatId, 'Please enter the new type:');
    bot.once('message', async (msg) => {
      if (msg.chat.id !== chatId) return;
      const newType = msg.text;

      const process = await Process.findById(processId);
      if (!process) {
        console.error(`[ERROR][HETP2] Process not found for processId: "${processId}"`);
        await bot.sendMessage(chatId, 'The process could not be found. Please try again.');
        return;
      }

      process.steps[stepIndex].type = newType;
      await process.save();
      console.log(`[DEBUG][HETP3] Process type updated for processId: "${processId}", stepIndex: "${stepIndex}"`);

      await bot.sendMessage(chatId, `Type updated to: ${newType}`);
      await handleEditProcess(bot, chatId, processId);
    });
  } catch (error) {
    console.error(`[ERROR][HETP4] Failed to update type: ${error.message}`);
    await bot.sendMessage(chatId, 'An error occurred. Please try again later.');
  }
};

export const handleNextEditStep = async (bot, chatId, processId) => {
  try {
    console.log(`[DEBUG][HNES1] Starting handleNextEditStep for processId: "${processId}" and chatId: "${chatId}"`);
    const userState = await UserState.findOne({ userId: chatId });
    const process = await Process.findById(processId);

    if (!process || !process.steps) {
      console.error(`[ERROR][HNES2] Process or steps not found for processId: "${processId}"`);
      await bot.sendMessage(chatId, 'An error occurred. Please try again later.');
      return;
    }

    userState.currentStepIndex += 1;
    if (userState.currentStepIndex >= process.steps.length) {
      await bot.sendMessage(chatId, 'You have edited all steps in this process.');
      userState.isEditingStep = false;
      await userState.save();
      console.log(`[DEBUG][HNES3] All steps edited for processId: "${processId}" and chatId: "${chatId}"`);
      return;
    }

    const currentStep = process.steps[userState.currentStepIndex];
    await userState.save(); // Save the updated step index
    console.log(`[DEBUG][HNES4] Moving to next step for processId: "${processId}" and chatId: "${chatId}"`);
    await presentEditStep(bot, chatId, processId, currentStep, userState);
  } catch (error) {
    console.error(`[ERROR][HNES5] Failed to handle next edit step: ${error.message}`);
    await bot.sendMessage(chatId, 'An error occurred. Please try again later.');
  }
};

export const handlePreviousEditStep = async (bot, chatId, processId) => {
  try {
    console.log(`[DEBUG][HPES1] Starting handlePreviousEditStep for processId: "${processId}" and chatId: "${chatId}"`);
    const userState = await UserState.findOne({ userId: chatId });
    const process = await Process.findById(processId);

    if (!process || !process.steps) {
      console.error(`[ERROR][HPES2] Process or steps not found for processId: "${processId}"`);
      await bot.sendMessage(chatId, 'An error occurred. Please try again later.');
      return;
    }

    userState.currentStepIndex -= 1;
    if (userState.currentStepIndex < 0) {
      console.log(`[DEBUG][HPES3] Already at the first step for processId: "${processId}" and chatId: "${chatId}"`);
      await bot.sendMessage(chatId, 'You are already at the first step.');
      userState.currentStepIndex = 0;
      await userState.save();
      return;
    }

    currentStep = process.steps[userState.currentStepIndex];
    await userState.save(); // Save the updated step index
    console.log(`[DEBUG][HPES4] Moving to previous step for processId: "${processId}" and chatId: "${chatId}"`);
    await presentEditStep(bot, chatId, processId, currentStep, userState);
  } catch (error) {
    console.error(`[ERROR][HPES5] Failed to handle previous edit step: ${error.message}`);
    await bot.sendMessage(chatId, 'An error occurred. Please try again later.');
  }
};

export const handleEditProcessTitle = async (bot, chatId, processId) => {
  try {
    console.log(`[DEBUG][HEPT1] Starting handleEditProcessTitle for processId: "${processId}" and chatId: "${chatId}"`);
    if (!processId) {
      console.error(`[ERROR][HEPT2] Process ID is null for chatId: "${chatId}"`);
      await bot.sendMessage(chatId, 'The process could not be found. Please try again.');
      return;
    }
    await bot.sendMessage(chatId, 'Please enter the new title:');
    bot.once('message', async (msg) => {
      if (msg.chat.id !== chatId) return;
      const newTitle = msg.text;

      const process = await Process.findById(processId);
      if (!process) {
        console.error(`[ERROR][HEPT3] Process not found for processId: "${processId}"`);
        await bot.sendMessage(chatId, 'The process could not be found. Please try again.');
        return;
      }

      process.title = newTitle;
      await process.save();
      console.log(`[DEBUG][HEPT4] Process title updated for processId: "${processId}"`);

      await bot.sendMessage(chatId, `Title updated to: ${newTitle}`);
      await handleEditProcess(bot, chatId, processId);
    });
  } catch (error) {
    console.error(`[ERROR][HEPT5] Failed to update title: ${error.message}`);
    await bot.sendMessage(chatId, 'An error occurred. Please try again later.');
  }
};

export const handleAddStepBefore = async (bot, chatId, processId, stepIndex) => {
  try {
    console.log(`[DEBUG][HASB1] Starting handleAddStepBefore for processId: "${processId}", stepIndex: "${stepIndex}" and chatId: "${chatId}"`);
    await bot.sendMessage(chatId, 'Please enter the details for the new step:');
    bot.once('message', async (msg) => {
      if (msg.chat.id !== chatId) return;
      const newStepDetails = msg.text;

      const process = await Process.findById(processId);
      if (!process) {
        console.error(`[ERROR][HASB2] Process not found for processId: "${processId}"`);
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
      console.log(`[DEBUG][HASB3] New step added before stepIndex: "${stepIndex}" for processId: "${processId}"`);
      console.log(`[DEBUG][HASB4] New step details: ${JSON.stringify(newStep)}`);

      await bot.sendMessage(chatId, 'New step added successfully.');
      await handleEditProcess(bot, chatId, processId);
    });
  } catch (error) {
    console.error(`[ERROR][HASB5] Failed to add step before: ${error.message}`);
    await bot.sendMessage(chatId, 'An error occurred. Please try again later.');
  }
};

export const handleAddStepAfter = async (bot, chatId, processId, stepIndex) => {
  try {
    console.log(`[DEBUG][HASA1] Starting handleAddStepAfter for processId: "${processId}", stepIndex: "${stepIndex}" and chatId: "${chatId}"`);
    await bot.sendMessage(chatId, 'Please enter the details for the new step:');
    bot.once('message', async (msg) => {
      if (msg.chat.id !== chatId) return;
      const newStepDetails = msg.text;

      const process = await Process.findById(processId);
      if (!process) {
        console.error(`[ERROR][HASA2] Process not found for processId: "${processId}"`);
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
      console.log(`[DEBUG][HASA3] New step added after stepIndex: "${stepIndex}" for processId: "${processId}"`);
      console.log(`[DEBUG][HASA4] New step details: ${JSON.stringify(newStep)}`);

      await bot.sendMessage(chatId, 'New step added successfully.');
      await handleEditProcess(bot, chatId, processId);
    });
  } catch (error) {
    console.error(`[ERROR][HASA5] Failed to add step after: ${error.message}`);
    await bot.sendMessage(chatId, 'An error occurred. Please try again later.');
  }
};

export const handleEditImageUrl = async (bot, chatId, processId) => {
  try {
    console.log(`[DEBUG][HEIU1] Starting handleEditImageUrl for processId: "${processId}" and chatId: "${chatId}"`);
    await bot.sendMessage(chatId, 'Please enter the new image URL:');
    bot.once('message', async (msg) => {
      if (msg.chat.id !== chatId) return;
      const newImageUrl = msg.text;

      const process = await Process.findById(processId);
      if (!process) {
        console.error(`[ERROR][HEIU2] Process not found for processId: "${processId}"`);
        await bot.sendMessage(chatId, 'The process could not be found. Please try again.');
        return;
      }

      process.imageUrl = newImageUrl;
      await process.save();
      console.log(`[DEBUG][HEIU3] Process image URL updated for processId: "${processId}"`);

      await bot.sendMessage(chatId, `Image URL updated to: ${newImageUrl}`);
      await handleEditProcess(bot, chatId, processId);
    });
  } catch (error) {
    console.error(`[ERROR][HEIU4] Failed to update image URL: ${error.message}`);
    await bot.sendMessage(chatId, 'An error occurred. Please try again later.');
  }
};

async function clearPendingUpdates(bot) {
  try {
    const updates = await bot.getUpdates({ offset: -1, limit: 1 });
    if (updates.length > 0) {
      const latestUpdateId = updates[0].update_id;
      await bot.getUpdates({ offset: latestUpdateId + 1 });
    }
  } catch (error) {
    console.error('[DEBUG] Error clearing pending updates:', error.message);
  }
}

// New handler for AI generation of steps
export const handleUseAIToCreateProcess = async (bot, chatId, processId) => {
  try {
    console.log(`[DEBUG][HUAI1] Starting handleUseAIToCreateProcess for processId: "${processId}" and chatId: "${chatId}"`);
    const process = await Process.findById(processId);
    if (!process) {
      console.error(`[ERROR][HUAI2] Process not found for processId: "${processId}"`);
      await bot.sendMessage(chatId, 'The process could not be found. Please try again.');
      return;
    }

    const updatedProcess = await generateStepsForProcess(processId, process.title, process.description);
    console.log(`[DEBUG][HUAI3] Process steps generated by AI for processId: "${processId}"`);

    await clearPendingUpdates(bot);
    await bot.sendMessage(chatId, 'Steps have been successfully generated by AI.');
    await handleEditProcess(bot, chatId, processId);
  } catch (error) {
    console.error(`[ERROR][HUAI4] Failed to generate steps using AI: ${error.message}`);
    await bot.sendMessage(chatId, 'An error occurred while generating steps using AI. Please try again later.');
  }
};

export const handleEditStepDescription = async (bot, chatId, processId, stepIndex) => {
  try {
    console.log(`[DEBUG][HESD1] Starting handleEditStepDescription for processId: "${processId}", stepIndex: "${stepIndex}" and chatId: "${chatId}"`);
    const process = await Process.findById(processId);
    if (!process) {
      console.error(`[ERROR][HESD2] Process not found for processId: "${processId}"`);
      await bot.sendMessage(chatId, 'The process could not be found. Please try again.');
      return;
    }

    const currentStep = process.steps[stepIndex];
    await bot.sendMessage(chatId, `Current Step Description: ${currentStep.description}`);

    bot.once('message', async (msg) => {
      if (msg.chat.id !== chatId) return;
      const newDescription = msg.text;

      process.steps[stepIndex].description = newDescription;
      await process.save();
      console.log(`[DEBUG][HESD3] Step description updated for processId: "${processId}", stepIndex: "${stepIndex}"`);

      await bot.sendMessage(chatId, `Step description updated to: ${newDescription}`);
      await handleEditProcess(bot, chatId, processId);
    });
  } catch (error) {
    console.error(`[ERROR][HESD4] Failed to update step description: ${error.message}`);
    await bot.sendMessage(chatId, 'An error occurred. Please try again later.');
  }
};

export const handleEditCategory = async (bot, chatId, processId) => {
  try {
    console.log(`[DEBUG][HEC1] Starting handleEditCategory for processId: "${processId}" and chatId: "${chatId}"`);
    const process = await Process.findById(processId);
    if (!process) {
      console.error(`[ERROR][HEC2] Process not found for processId: "${processId}"`);
      await bot.sendMessage(chatId, 'The process could not be found. Please try again.');
      return;
    }

    const categories = await ProcessCategories.find();
    if (!categories.length) {
      console.error(`[ERROR][HEC3] No categories found`);
      await bot.sendMessage(chatId, 'No categories available. Please try again later.');
      return;
    }

    const categoryButtons = categories.map((category) => [
      { text: category.name, callback_data: `select_cat_${category._id}_${processId}` },
    ]);

    await bot.sendMessage(chatId, 'Please select a new category:', {
      reply_markup: { inline_keyboard: categoryButtons },
    });
  } catch (error) {
    console.error(`[ERROR][HEC4] Failed to fetch categories: ${error.message}`);
    await bot.sendMessage(chatId, 'An error occurred. Please try again later.');
  }
};

// Function to handle the callback query for editing a process
export const handleEditProcessCallback = async (bot, callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const processId = callbackQuery.data.split('_')[2];

  console.log(`[DEBUG] edit_process callback triggered for process ${processId} by user ${chatId}`);
  await handleEditProcess(bot, chatId, processId);
};