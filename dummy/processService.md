import ProcessAnswers from '../models/ProcessAnswers.js';
import Process from '../models/process.js';
import UserState from '../models/UserState.js';
import ProcessCategories from '../models/ProcessCategories.js';
import { handleNextStep } from './viewprocess.js';

// Helper function to validate file type
function isValidFileType(file, allowedTypes) {
  const fileType = file.mime_type.split('/').pop();
  return allowedTypes.includes(fileType);
}

// Helper function for debug logging
function logDebug(message) {
  console.log(`[DEBUG] ${message}`);
}

/**
 * Save the user's answer and progress to the next step.
 */
export const saveAnswerAndNextStep = async ({ bot, chatId, processId, stepIndex, answer, isEditMode = true }) => {
  try {
    logDebug(`[processService][SANS-1] Saving answer for chatId: ${chatId}, processId: ${processId}, stepIndex: ${stepIndex}`);

    // Create or retrieve user state
    let userState = await UserState.findOne({ userId: chatId });
    if (!userState) {
      logDebug(`[processService][SANS-2] Creating a new user state for user ${chatId}`);
      userState = new UserState({ userId: chatId, currentStepIndex: 0 });
      await userState.save();
    }

    // Fetch the process and determine the current step
    const process = await Process.findById(processId);
    if (!process) {
      throw new Error(`Process not found with processId: ${processId}`);
    }

    const currentStep = process.steps[stepIndex];

    // Save the answer in UserState
    if (!userState.answers) {
      userState.answers = [];
    }
    if (currentStep.type !== 'info_process' && answer != null) {
      userState.answers.push({ stepIndex, answer });
    }
    await userState.save();

    // Save or update the answer in the ProcessAnswers collection
    let processAnswers = await ProcessAnswers.findOneAndUpdate(
      { userId: chatId, processId },
      { $setOnInsert: { createdAt: new Date() } },
      { upsert: true, new: true }
    );

    processAnswers.answers.forEach((ans) => {
      if (!ans.stepDescription) ans.stepDescription = currentStep.description;
      if (!ans.stepPrompt) ans.stepPrompt = currentStep.prompt;
    });

    const existingAnswerIndex = processAnswers.answers.findIndex((a) => a.stepIndex === stepIndex);
    if (existingAnswerIndex !== -1) {
      processAnswers.answers[existingAnswerIndex] = {
        stepIndex,
        stepDescription: currentStep.description,
        stepPrompt: currentStep.prompt,
        answer,
      };
    } else if (currentStep.type !== 'info_process') {
      processAnswers.answers.push({
        stepIndex,
        stepDescription: currentStep.description,
        stepPrompt: currentStep.prompt,
        answer,
      });
    }
    await processAnswers.save();
    logDebug(`[processService][SANS-4] Answer saved in ProcessAnswers for stepIndex: ${stepIndex}, answer: ${answer}`);

    // Increment to the next step
    userState.currentStepIndex += 1;
    await userState.save();
    logDebug(`[processService][SANS-3] Answer saved and step index incremented. Current stepIndex: ${userState.currentStepIndex}`);

    if (userState.currentStepIndex >= process.steps.length) {
      await bot.sendMessage(chatId, 'You have completed all steps in this process. Would you like to finish the process?', {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Finish Processes', callback_data: '/view' }],
          ],
        },
      });

      bot.once('callback_query', async (callbackQuery) => {
        if (callbackQuery.message.chat.id !== chatId) return;
        if (callbackQuery.data === '/view') {
          await bot.sendMessage(chatId, 'You have chosen to finish the process.');
          // Reset the user state
          userState.currentStepIndex = 0;
          await userState.save();
          await bot.sendMessage(chatId, 'The process has been completed. You can start a new process by using the /start command.');
          await bot.sendMessage(chatId, '/view');
        }
      });
      return;
    }

    // Present the next step
    const nextStep = process.steps[userState.currentStepIndex];
    await presentStep(bot, chatId, processId, nextStep, userState);
  } catch (error) {
    console.error(`[ERROR][processService][SANS-5] Failed to save answer and progress to the next step: ${error.message}`);
    await bot.sendMessage(chatId, 'An error occurred while saving your answer. Please try again.');
  }
};

/**
 * Present the next step to the user.
 */
export const presentStep = async (bot, chatId, processId, currentStep, userState) => {
  try {
    const stepIndex = userState.currentStepIndex;
    const processAnswers = await ProcessAnswers.findOne({ userId: chatId, processId });
    const existingAnswer = processAnswers?.answers.find((a) => a.stepIndex === stepIndex)?.answer;

    let message = `Step ${stepIndex + 1}: ${currentStep.prompt}\n\n${currentStep.description}`;
    if (existingAnswer) {
      message += `\n\nYour previous answer: ${existingAnswer}`;
    }

    const inlineKeyboard = [
      [{ text: 'Previous Step', callback_data: `previous_review_step_${processId}` }],
      [{ text: 'Next Step', callback_data: `next_review_step_${processId}` }]
    ];

    if (currentStep.type === 'text_process') {
      await bot.sendMessage(chatId, message, { reply_markup: { inline_keyboard: inlineKeyboard } });
      bot.once('message', async (msg) => {
        if (msg.chat.id !== chatId) return;
        await saveAnswerAndNextStep({
          bot,
          chatId,
          processId,
          stepIndex,
          answer: msg.text,
        });
      });
    } else if (currentStep.type === 'yes_no_process') {
      await bot.sendMessage(chatId, message, {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Yes', callback_data: `yes_${processId}` }],
            [{ text: 'No', callback_data: `no_${processId}` }],
            ...inlineKeyboard,
          ],
        },
      });
      bot.once('callback_query', async (callbackQuery) => {
        if (callbackQuery.message.chat.id !== chatId) return;
        const response = callbackQuery.data.startsWith('yes') ? 'Yes' : 'No';
        await saveAnswerAndNextStep({
          bot,
          chatId,
          processId,
          stepIndex,
          answer: response,
        });
      });
    } else if (currentStep.type === 'file_process') {
      logDebug(`[PES01] Presenting file upload for processId: ${processId}`);
      await bot.sendMessage(chatId, message, { reply_markup: { inline_keyboard: inlineKeyboard } });
      bot.once('document', async (msg) => {
        if (msg.chat.id !== chatId) return;
        const allowedTypes = currentStep.validation.fileTypes;
        if (isValidFileType(msg.document, allowedTypes)) {
          logDebug(`[PES02] Received file with file_id: ${msg.document.file_id}`);
          try {
            logDebug(`[PES03] Attempting to fetch file with file_id: ${msg.document.file_id}`);
            const response = await fetch(`http://localhost:3001/green/download/`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fileId: msg.document.file_id }),
            });
            if (!response.ok) throw new Error(`Failed to fetch file: ${response.statusText}`);
            const data = await response.json();
            logDebug(`[PES04] Received data: ${JSON.stringify(data)}`);
            await saveAnswerAndNextStep({
              bot,
              chatId,
              processId,
              stepIndex,
              answer: data.fileName,
            });
          } catch (error) {
            console.error(`[ERROR] [PES05] Failed to fetch file: ${error.message}`);
            await bot.sendMessage(chatId, 'An error occurred while processing your file. Please try again.');
          }
        } else {
          await bot.sendMessage(chatId, `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`);
        }
      });
    } else if (currentStep.type === 'choice') {
      logDebug(`[DEBUG] Presenting choice options for processId: ${processId}`);
      const options = currentStep.options.map((option, index) => [{ text: option, callback_data: `choice_${index}` }]);
      await bot.sendMessage(chatId, message, { reply_markup: { inline_keyboard: [...options, ...inlineKeyboard] } });
      const selectedChoices = [];
      bot.once('callback_query', async (callbackQuery) => {
        if (callbackQuery.message.chat.id !== chatId) return;
        const choiceIndex = parseInt(callbackQuery.data.split('_')[1]);
        const selectedOption = currentStep.options[choiceIndex];
        if (!selectedChoices.includes(selectedOption)) {
          selectedChoices.push(selectedOption);
        } else {
          const idx = selectedChoices.indexOf(selectedOption);
          selectedChoices.splice(idx, 1);
        }
        await bot.sendMessage(chatId, `You selected: ${selectedChoices.join(', ')}`);
        await saveAnswerAndNextStep({
          bot,
          chatId,
          processId,
          stepIndex,
          answer: selectedChoices.join(', '),
        });
      });
    } else if (currentStep.type === 'final') {
      await bot.sendMessage(chatId, message, {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Confirm', callback_data: `confirm_${processId}` }],
            [{ text: 'Previous Step', callback_data: `previous_review_step_${processId}` }]
          ],
        },
      });
      bot.once('callback_query', async (callbackQuery) => {
        if (callbackQuery.message.chat.id !== chatId) return;
        if (callbackQuery.data === `confirm_${processId}`) {
          await bot.sendMessage(chatId, 'Your application has been confirmed. Thank you!');
          await handleNextStep(bot, chatId, processId);
        } else if (callbackQuery.data === `previous_review_step_${processId}`) {
          userState.currentStepIndex -= 1;
          await userState.save();
          const process = await Process.findById(processId);
          await presentStep(bot, chatId, processId, process.steps[userState.currentStepIndex], userState);
        }
      });
    } else if (currentStep.type === 'info_process') {
      await bot.sendMessage(chatId, message, { reply_markup: { inline_keyboard: inlineKeyboard } });
      // Do not automatically progress for info_process type
    } else {
      console.error(`[ERROR] Unknown step type: ${currentStep.type}`);
      await bot.sendMessage(chatId, `Unknown step type: ${currentStep.type}. Skipping step.`);
      userState.currentStepIndex += 1;
      await userState.save();
      await saveAnswerAndNextStep({ bot, chatId, processId, stepIndex, answer: null });
    }
  } catch (error) {
    console.error(`[ERROR] Failed to present step: ${error.message}`);
    await bot.sendMessage(chatId, 'An error occurred while presenting the step. Please try again.');
  }
};

/**
 * Handle presenting the next step in review mode.
 */
export const handleNextReviewStep = async (bot, chatId, processId) => {
  const CALL_CODE = 'HNRS001';
  logDebug(`${CALL_CODE}] handleNextReviewStep called with chatId: ${chatId}, processId: ${processId}`);
  try {
    const userState = await UserState.findOne({ userId: chatId });
    if (!userState) throw new Error(`User state not found for userId: ${chatId}`);

    const process = await Process.findById(processId);
    if (!process) throw new Error(`Process not found with processId: ${processId}`);

    const currentStep = process.steps[userState.currentStepIndex];
    if (!currentStep) {
      await bot.sendMessage(chatId, 'You have completed all steps in this process.');
      return;
    }
    await presentReviewStep(bot, chatId, processId, currentStep, userState);
  } catch (error) {
    console.error(`[ERROR] ${CALL_CODE}] Failed to handle next review step: ${error.message}`);
    await bot.sendMessage(chatId, 'An error occurred while presenting the next step. Please try again.');
  }
};

/**
 * Present the current step in review mode.
 */
const presentReviewStep = async (bot, chatId, processId, currentStep, userState) => {
  const CALL_CODE = 'PRS001';
  const stepIndex = userState.currentStepIndex;
  logDebug(`${CALL_CODE}] presentReviewStep called with chatId: ${chatId}, processId: ${processId}, stepIndex: ${stepIndex}`);
  const processAnswers = await ProcessAnswers.findOne({ userId: chatId, processId });
  const existingAnswer = processAnswers?.answers.find((a) => a.stepIndex === stepIndex)?.answer;

  let message = `Step ${stepIndex + 1}: ${currentStep.prompt}\n\n${currentStep.description}`;
  if (existingAnswer) {
    message += `\n\nYour previous answer: ${existingAnswer}`;
  }

  // Append the current step index to the callback data to ensure uniqueness
  const inlineKeyboard = [
    [{ text: 'Previous Step', callback_data: `previous_review_step_${processId}_${stepIndex}` }],
    [{ text: 'Next Step', callback_data: `next_review_step_${processId}_${stepIndex}` }]
  ];

  // Send the review step message with the explicit inline_keyboard property
  const sentMsg = await bot.sendMessage(chatId, message, { reply_markup: { inline_keyboard: inlineKeyboard } });

  // Use a dedicated callback handler (registered via bot.on) and verify message id before processing
  let callbackHandled = false;
  const callbackHandler = async (callbackQuery) => {
    if (callbackQuery.message.chat.id !== chatId) return;
    // Only process if the callback belongs to the message we just sent
    if (callbackQuery.message.message_id !== sentMsg.message_id) return;
    if (callbackHandled) return;
    callbackHandled = true;
    await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: sentMsg.message_id });
    
    const data = callbackQuery.data;
    // Expect callback data format: <action>_review_step_<processId>_<stepIndex>
    const parts = data.split('_');
    const callbackAction = parts[0]; // "next" or "previous"
    const callbackStepIndex = parseInt(parts[parts.length - 1], 10);
    
    // Only proceed if the callback's step index matches the current step index.
    if (callbackStepIndex !== stepIndex) {
      logDebug(`Callback step index (${callbackStepIndex}) does not match current step index (${stepIndex}). Ignoring.`);
      return;
    }
    
    if (callbackAction === 'next') {
      logDebug(`next_review_step callback triggered for process ${processId} by user ${chatId}`);
      userState.currentStepIndex += 1;
      await userState.save();
      await handleNextReviewStep(bot, chatId, processId);
    } else if (callbackAction === 'previous') {
      userState.currentStepIndex -= 1;
      await userState.save();
      const process = await Process.findById(processId);
      await presentReviewStep(bot, chatId, processId, process.steps[userState.currentStepIndex], userState);
    }
    bot.removeListener('callback_query', callbackHandler);
  };

  bot.on('callback_query', callbackHandler);
};

/**
 * Present the category selection step to the user.
 */
export const presentCategorySelection = async (bot, chatId) => {
  try {
    const categories = await ProcessCategories.find();
    if (!categories.length) {
      await bot.sendMessage(chatId, 'No categories available. Please contact the administrator.');
      return;
    }

    const categoryButtons = categories.map((category) => [
      { text: category.name, callback_data: `select_category_${category._id}` },
    ]);

    await bot.sendMessage(chatId, 'Please select a category for the process:', {
      reply_markup: { inline_keyboard: categoryButtons },
    });

    bot.once('callback_query', async (callbackQuery) => {
      if (callbackQuery.message.chat.id !== chatId) return;
      const categoryId = callbackQuery.data.split('_')[2];
      const selectedCategory = await ProcessCategories.findById(categoryId);
      if (!selectedCategory) {
        await bot.sendMessage(chatId, 'Selected category not found. Please try again.');
        return;
      }

      const process = await Process.findOne({ category: categoryId });
      if (!process) {
        await bot.sendMessage(chatId, 'No process found for the selected category. Please try again.');
        return;
      }

      let userState = await UserState.findOne({ userId: chatId });
      if (!userState) {
        userState = new UserState({ userId: chatId, currentStepIndex: 0 });
      } else {
        userState.currentStepIndex = 0;
      }
      await userState.save();

      const firstStep = process.steps[0];
      await presentStep(bot, chatId, process._id, firstStep, userState);
    });
  } catch (error) {
    console.error(`[ERROR] Failed to present category selection: ${error.message}`);
    await bot.sendMessage(chatId, 'An error occurred while presenting the categories. Please try again later.');
  }
};
