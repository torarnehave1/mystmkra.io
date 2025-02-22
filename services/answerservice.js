import ProcessAnswers from '../models/ProcessAnswers.js';
import Process from '../models/process.js';
import UserState from '../models/UserState.js';
import { handleNextStep } from './viewprocess.js'; // Import handleNextStep function
import { response } from 'express';
import ProcessCategories from '../models/ProcessCategories.js'; // Import handleNextReviewStep and handlePreviousEditStep functions
import { handleNextReviewStep } from './reviewProcessService.js'; // Import handleNextReviewStep function

// Helper function to validate file type
function isValidFileType(file, allowedTypes) {
  const fileType = file.mime_type.split('/').pop();
  return allowedTypes.includes(fileType);
}

/**
 * Save the user's answer and progress to the next step.
 * @param {Object} params - Parameters for saving the answer.
 * @param {Object} params.bot - Telegram bot instance.
 * @param {Number} params.chatId - Telegram chat ID of the user.
 * @param {String} params.processId - ID of the process the user is working on.
 * @param {Number} params.stepIndex - Index of the step being answered.
 * @param {String} params.answer - User's answer for the step.
 * @param {Boolean} params.isEditMode - Flag to indicate if the user is in edit mode.
 */
export const saveAnswerAndNextStep = async ({ bot, chatId, processId, stepIndex, answer, isEditMode = true }) => {
  try {
    console.log(`[DEBUG][answerservice][SANS-1] Saving answer for chatId: ${chatId}, processId: ${processId}, stepIndex: ${stepIndex}`);

    // Create or retrieve user state
    let userState = await UserState.findOne({ userId: chatId });
    if (!userState) {
      console.log(`[DEBUG][answerservice][SANS-2] Creating a new user state for user ${chatId}`);
      userState = new UserState({ userId: chatId });
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
    if (currentStep.type !== 'info_process' && (answer !== null && answer !== undefined)) { // Ensure answer is not empty for non-info_process steps
      userState.answers.push({ stepIndex, answer });
    }
    await userState.save();

    // Save or update the answer in the ProcessAnswers collection
    let processAnswers = await ProcessAnswers.findOneAndUpdate(
      { userId: chatId, processId },
      { $setOnInsert: { createdAt: new Date() } }, // Ensure no duplicate documents
      { upsert: true, new: true }
    );

    // Ensure all answers have stepDescription and stepPrompt
    processAnswers.answers.forEach((answer) => {
      if (!answer.stepDescription) {
        answer.stepDescription = currentStep.description;
      }
      if (!answer.stepPrompt) {
        answer.stepPrompt = currentStep.prompt;
      }
    });

    // Add or update the answer
    const existingAnswerIndex = processAnswers.answers.findIndex((a) => a.stepIndex === stepIndex);
    if (existingAnswerIndex !== -1) {
      processAnswers.answers[existingAnswerIndex].answer = answer; // Update existing answer
      processAnswers.answers[existingAnswerIndex].stepDescription = currentStep.description; // Update step description
      processAnswers.answers[existingAnswerIndex].stepPrompt = currentStep.prompt; // Update step prompt
    } else {
      if (currentStep.type !== 'info_process') { // Only add answer for non-info_process steps
        processAnswers.answers.push({
          stepIndex,
          stepDescription: currentStep.description,
          stepPrompt: currentStep.prompt,
          answer,
        }); // Add new answer
      }
    }

    await processAnswers.save();
    console.log(`[DEBUG][answerservice][SANS-4] Answer saved in ProcessAnswers for stepIndex: ${stepIndex}, answer: ${answer}`);

    // Increment to the next step
    userState.currentStepIndex += 1;
    await userState.save();
    console.log(`[DEBUG][answerservice][SANS-3] Answer saved and step index incremented. Current stepIndex: ${userState.currentStepIndex}`);

    if (userState.currentStepIndex >= process.steps.length) {
      // Notify the user that the process is complete
      await bot.sendMessage(chatId, 'You have completed all steps in this process. Would you like to finish the process?', {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Finish Processes', callback_data: '/view' }],
          ],
        },
      });

      bot.once('callback_query', async (callbackQuery) => {
        if (callbackQuery.message.chat.id !== chatId) return; // Ignore callback from other chats
        if (callbackQuery.data === '/view') {
          await bot.sendMessage(chatId, 'You have chosen to finish the process.');
          // Call the /view command or handle it accordingly
          // For example, you can call a function to handle the /view command
          // await handleViewCommand(bot, chatId);

          // Reset the user state
          userState.currentStepIndex = 0;
          await userState.save();

          // Notify the user that the process is complete
          await bot.sendMessage(chatId, 'The process has been completed. You can start a new process by using the /start command.');

          //send the /view command
          await bot.sendMessage(chatId, '/view');
        }
      });
      return;
    }

    // Present the next step using the functionality in answerservice
    const nextStep = process.steps[userState.currentStepIndex];
    await presentStep(bot, chatId, processId, nextStep, userState);

  } catch (error) {
    console.error(`[ERROR][answerservice][SANS-5] Failed to save answer and progress to the next step: ${error.message}`);
    await bot.sendMessage(chatId, 'An error occurred while saving your answer. Please try again.');
  }
};

/**
 * Present the next step to the user.
 * @param {Object} bot - Telegram bot instance.
 * @param {Number} chatId - Telegram chat ID of the user.
 * @param {String} processId - ID of the process the user is working on.
 * @param {Object} currentStep - The step to present to the user.
 * @param {Object} userState - Current state of the user.
 */
export const presentStep = async (bot, chatId, processId, currentStep, userState) => {
  try {
    const stepIndex = userState.currentStepIndex;

    // Retrieve the existing answer for the current step if available
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
        if (msg.chat.id !== chatId) return; // Ignore messages from other chats
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

      const callbackQueryHandler = async (callbackQuery) => {
        if (callbackQuery.message.chat.id !== chatId) return; // Ignore callback from other chats
        const response = callbackQuery.data.startsWith('yes') ? 'Yes' : 'No';
        await saveAnswerAndNextStep({
          bot,
          chatId,
          processId,
          stepIndex,
          answer: response,
        });
      };

      bot.once('callback_query', callbackQueryHandler);
    } else if (currentStep.type === 'file_process') {
      console.log(`[DEBUG] [PES01]Presenting file upload for processId: ${processId}`);

      await bot.sendMessage(chatId, message, { reply_markup: { inline_keyboard: inlineKeyboard } });
      bot.once('document', async (msg) => {
        if (msg.chat.id !== chatId) return; // Ignore documents from other chats
        const allowedTypes = currentStep.validation.fileTypes;
        if (isValidFileType(msg.document, allowedTypes)) {
          console.log(`[DEBUG] [PES02] Received file with file_id: ${msg.document.file_id}`);

          // Fetch the post endpoint /green/download with the file_id
          try {
            console.log(`[DEBUG] [PES03] Attempting to fetch file with file_id: ${msg.document.file_id}`);
            const response = await fetch(`http://localhost:3001/green/download/`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ fileId: msg.document.file_id }),
            });
            if (!response.ok) {
              throw new Error(`Failed to fetch file: ${response.statusText}`);
            }
            const data = await response.json();
            console.log(`[DEBUG] [PES04] Received data from the post endpoint: ${JSON.stringify(data)}`);

            await saveAnswerAndNextStep({
              bot,
              chatId,
              processId,
              stepIndex,
              answer: data.fileName,
            });
          } catch (error) {
            console.error(`[ERROR] [PES05] Failed to fetch file: ${error.message}`);
            console.error(`[ERROR] [PES06] Error details: ${error.stack}`);
            await bot.sendMessage(chatId, 'An error occurred while processing your file. Please try again.');
            return;
          }
        } else {
          await bot.sendMessage(chatId, `Invalid file type. Allowed types are: ${allowedTypes.join(', ')}`);
        }
      });
    } else if (currentStep.type === 'choice') {
      console.log(`[DEBUG] Presenting choice options for processId: ${processId}`);
      const options = currentStep.options.map((option, index) => [{ text: option, callback_data: `choice_${index}` }]);
      await bot.sendMessage(chatId, message, {
        reply_markup: {
          inline_keyboard: [...options, ...inlineKeyboard],
        },
      });

      const selectedChoices = [];

      const callbackQueryHandler = async (callbackQuery) => {
        if (callbackQuery.message.chat.id !== chatId) return; // Ignore callbacks from other chats
        const choiceIndex = parseInt(callbackQuery.data.split('_')[1]);
        const selectedOption = currentStep.options[choiceIndex];

        if (!selectedChoices.includes(selectedOption)) {
          selectedChoices.push(selectedOption);
        } else {
          const index = selectedChoices.indexOf(selectedOption);
          selectedChoices.splice(index, 1);
        }

        await bot.sendMessage(chatId, `You selected: ${selectedChoices.join(', ')}`);

        await saveAnswerAndNextStep({
          bot,
          chatId,
          processId,
          stepIndex,
          answer: selectedChoices.join(', '), // Save as a comma-separated string
        });
      };

      bot.once('callback_query', callbackQueryHandler);
    } else if (currentStep.type === 'final') {
      await bot.sendMessage(chatId, message, {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Confirm', callback_data: `confirm_${processId}` }],
            [{ text: 'Previous Step', callback_data: `previous_review_step_${processId}` }]
          ],
        },
      });

      const callbackQueryHandler = async (callbackQuery) => {
        if (callbackQuery.message.chat.id !== chatId) return; // Ignore callbacks from other chats
        if (callbackQuery.data === `confirm_${processId}`) {
          await bot.sendMessage(chatId, 'Your application has been confirmed. Thank you!');
          await handleNextStep(bot, chatId, processId);
        } else if (callbackQuery.data === `previous_review_step_${processId}`) {
          userState.currentStepIndex -= 1;
          await userState.save();
          await presentStep(bot, chatId, processId, process.steps[userState.currentStepIndex], userState);
        }
      };

      bot.once('callback_query', callbackQueryHandler);
    } else if (currentStep.type === 'info_process') {
      await bot.sendMessage(chatId, message, {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Previous Step', callback_data: `previous_review_step_${processId}` }],
            [{ text: 'Next Step', callback_data: `next_review_step_${processId}` }]
          ],
        },
      });
      // Do not automatically save and go to the next step
    } else {
      console.error(`[ERROR] Unknown step type: ${currentStep.type}`);
      await bot.sendMessage(chatId, `Unknown step type: ${currentStep.type}. Skipping step.`);
      userState.currentStepIndex += 1;
      await userState.save();
      await saveAnswerAndNextStep({
        bot,
        chatId,
        processId,
        stepIndex,
        answer: null,
      });
    }
  } catch (error) {
    console.error(`[ERROR] Failed to present step: ${error.message}`);
    await bot.sendMessage(chatId, 'An error occurred while presenting the step. Please try again.');
  }
};

/**
 * Present the category selection step to the user.
 * @param {Object} bot - Telegram bot instance.
 * @param {Number} chatId - Telegram chat ID of the user.
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
      if (callbackQuery.message.chat.id !== chatId) return; // Ignore callback from other chats
      const categoryId = callbackQuery.data.split('_')[2];
      const selectedCategory = await ProcessCategories.findById(categoryId);
      if (!selectedCategory) {
        await bot.sendMessage(chatId, 'Selected category not found. Please try again.');
        return;
      }

      // Start the answering process
      const process = await Process.findOne({ category: categoryId });
      if (!process) {
        await bot.sendMessage(chatId, 'No process found for the selected category. Please try again.');
        return;
      }

      // Initialize user state
      let userState = await UserState.findOne({ userId: chatId });
      if (!userState) {
        userState = new UserState({ userId: chatId, currentStepIndex: 0 });
        await userState.save();
      } else {
        userState.currentStepIndex = 0;
        await userState.save();
      }

      // Present the first step
      const firstStep = process.steps[0];
      await presentStep(bot, chatId, process._id, firstStep, userState);
    });
  } catch (error) {
    console.error(`[ERROR] Failed to present category selection: ${error.message}`);
    await bot.sendMessage(chatId, 'An error occurred while presenting the categories. Please try again later.');
  }
};
