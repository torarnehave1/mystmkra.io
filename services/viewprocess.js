import UserState from '../models/UserState.js';
import Process from '../models/process.js';
import ProcessAnswers from '../models/ProcessAnswers.js';
import { extractProcessId } from '../services/helpers.js'; // Corrected path

// Function to handle viewing a process
export const handleViewProcess = async (bot, chatId, processId) => {
  console.log(`[DEBUG] Viewing process with processId: "${processId}" for chatId: ${chatId}`);

  try {
    const process = await Process.findById(processId); // Use findById to get the process
    if (!process) {
      console.error(`[ERROR] Process not found for processId: "${processId}"`);
      await bot.sendMessage(chatId, 'The process could not be found. Please try again.');
      return;
    }

    // Save the current process and step index in the user state
    const userState = await UserState.findOne({ userId: chatId });
    userState.processId = processId;
    userState.currentStepIndex = 0;
    await userState.save();

    // Start the process
    await bot.sendMessage(chatId, `Starting process: ${process.title}`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Start', callback_data: `start_process_${processId}` }],
          [{ text: 'End', callback_data: `end_process_${processId}` }],
        ],
      },
    });
  } catch (error) {
    console.error(`[ERROR] Failed to retrieve process details: ${error.message}`);
    await bot.sendMessage(chatId, 'An error occurred. Please try again later.');
  }
};

// Function to handle moving to the next step
export const handleNextStep = async (bot, chatId, processId) => {
  try {
    const userState = await UserState.findOne({ userId: chatId });
    if (userState.isProcessingStep) {
      console.log(`[DEBUG] User ${chatId} is already processing a step. Ignoring duplicate handleNextStep call.`);
      return;
    }
    userState.isProcessingStep = true;
    await userState.save();

    const process = await Process.findOne({ _id: processId, createdBy: chatId });

    if (!process || !process.steps) {
      console.error(`[ERROR] Process or steps not found for processId: "${processId}"`);
      await bot.sendMessage(chatId, 'An error occurred. Please try again later.');
      userState.isProcessingStep = false;
      await userState.save();
      return;
    }

    const currentStepIndex = userState.currentStepIndex;
    if (currentStepIndex >= process.steps.length) {
      await bot.sendMessage(chatId, 'You have completed all steps in this process. Thank you!', {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Submit Process', callback_data: `submit_process_${processId}` }],
          ],
        },
      });

      // Save answers to ProcessAnswers collection
      const processAnswers = new ProcessAnswers({
        userId: chatId,
        processId: processId,
        answers: userState.answers,
      });
      await processAnswers.save();
      userState.isProcessingStep = false;
      await userState.save();
      return;
    }

    const currentStep = process.steps[currentStepIndex];
    console.log(`[DEBUG] Presenting step ${currentStepIndex + 1} of type "${currentStep.type}" for processId: "${processId}" to chatId: ${chatId}`);
    await presentStep(bot, chatId, processId, currentStep, userState);
  } catch (error) {
    console.error(`[ERROR] Failed to handle next step: ${error.message}`);
    await bot.sendMessage(chatId, 'An error occurred. Please try again later.');
    const userState = await UserState.findOne({ userId: chatId });
    userState.isProcessingStep = false;
    await userState.save();
  }
};

const presentStep = async (bot, chatId, processId, currentStep, userState) => {
  if (currentStep.type === 'text_process') {
    await bot.sendMessage(chatId, `Step ${userState.currentStepIndex + 1}: ${currentStep.prompt}`);
    bot.once('message', async (msg) => {
      if (!userState.answers) {
        userState.answers = [];
      }
      userState.answers.push({ stepIndex: userState.currentStepIndex, answer: msg.text });
      userState.currentStepIndex += 1;
      userState.isProcessingStep = false;
      await userState.save();
      await bot.sendMessage(chatId, 'Response recorded. Moving to the next step...');
      handleNextStep(bot, chatId, processId);
    });
  } else if (currentStep.type === 'yes_no_process') {
    await bot.sendMessage(chatId, `Step ${userState.currentStepIndex + 1}: ${currentStep.prompt}`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Yes', callback_data: `yes_${processId}` }],
          [{ text: 'No', callback_data: `no_${processId}` }],
        ],
      },
    });
    userState.isProcessingStep = false;
    await userState.save();

    
  } else if (currentStep.type === 'file_process') {
    await bot.sendMessage(chatId, `Step ${userState.currentStepIndex + 1}: ${currentStep.prompt}`);
    bot.once('document', async (msg) => {
      if (!userState.answers) {
        userState.answers = [];
      }
      userState.answers.push({ stepIndex: userState.currentStepIndex, answer: msg.document.file_id });
      userState.currentStepIndex += 1;
      userState.isProcessingStep = false;
      await userState.save();
      await bot.sendMessage(chatId, 'File received. Moving to the next step...');
      handleNextStep(bot, chatId, processId);
    });
  }
};