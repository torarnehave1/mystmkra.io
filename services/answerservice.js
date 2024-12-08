import ProcessAnswers from '../models/ProcessAnswers.js';
import Process from '../models/process.js';
import UserState from '../models/UserState.js';

/**
 * Save the user's answer and progress to the next step.
 * @param {Object} params - Parameters for saving the answer.
 * @param {Object} params.bot - Telegram bot instance.
 * @param {Number} params.chatId - Telegram chat ID of the user.
 * @param {String} params.processId - ID of the process the user is working on.
 * @param {Number} params.stepIndex - Index of the step being answered.
 * @param {String} params.answer - User's answer for the step.
 */
export const saveAnswerAndNextStep = async ({ bot, chatId, processId, stepIndex, answer }) => {
  try {
    console.log(`[DEBUG] Saving answer for chatId: ${chatId}, processId: ${processId}, stepIndex: ${stepIndex}`);

    // Create or retrieve user state
    let userState = await UserState.findOne({ userId: chatId });
    if (!userState) {
      console.log(`[DEBUG] Creating a new user state for user ${chatId}`);
      userState = new UserState({ userId: chatId });
      await userState.save();
    }

    // Save the answer in UserState
    if (!userState.answers) {
      userState.answers = [];
    }
    userState.answers.push({ stepIndex, answer });
    await userState.save();

    // Save the updated UserState
    userState.currentStepIndex += 1; // Increment to the next step
    await userState.save();
    console.log(`[DEBUG] Answer saved and step index incremented. Current stepIndex: ${userState.currentStepIndex}`);

    // Save or update the answer in the ProcessAnswers collection
    let processAnswers = await ProcessAnswers.findOneAndUpdate(
      { userId: chatId, processId },
      { $setOnInsert: { createdAt: new Date() } }, // Ensure no duplicate documents
      { upsert: true, new: true }
    );

    // Add or update the answer
    const existingAnswerIndex = processAnswers.answers.findIndex((a) => a.stepIndex === stepIndex);
    if (existingAnswerIndex !== -1) {
      processAnswers.answers[existingAnswerIndex].answer = answer; // Update existing answer
    } else {
      processAnswers.answers.push({ stepIndex, answer }); // Add new answer
    }

    await processAnswers.save();
    console.log(`[DEBUG] Answer saved in ProcessAnswers for stepIndex: ${stepIndex}, answer: ${answer}`);

    // Fetch the process and determine the next step
    const process = await Process.findById(processId);
    if (!process) {
      throw new Error(`Process not found with processId: ${processId}`);
    }

    if (userState.currentStepIndex >= process.steps.length) {
      // Notify the user that the process is complete
      await bot.sendMessage(chatId, 'You have completed all steps in this process. Thank you!');
      return;
    }

    // Present the next step
    const nextStep = process.steps[userState.currentStepIndex];
    await presentStep(bot, chatId, processId, nextStep, userState);
  } catch (error) {
    console.error(`[ERROR] Failed to save answer and progress to the next step: ${error.message}`);
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

    if (currentStep.type === 'text_process') {
      await bot.sendMessage(chatId, `Step ${stepIndex + 1}: ${currentStep.prompt}`);
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
      await bot.sendMessage(chatId, `Step ${stepIndex + 1}: ${currentStep.prompt}`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Yes', callback_data: `yes_${processId}` }],
            [{ text: 'No', callback_data: `no_${processId}` }],
          ],
        },
      });

      bot.once('callback_query', async (callbackQuery) => {
        if (callbackQuery.message.chat.id !== chatId) return; // Ignore callback from other chats
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
      await bot.sendMessage(chatId, `Step ${stepIndex + 1}: ${currentStep.prompt}`);
      bot.once('document', async (msg) => {
        if (msg.chat.id !== chatId) return; // Ignore documents from other chats
        await saveAnswerAndNextStep({
          bot,
          chatId,
          processId,
          stepIndex,
          answer: msg.document.file_id,
        });
      });
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
