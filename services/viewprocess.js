import UserState from '../models/UserState.js';
import Process from '../models/process.js';
import ProcessAnswers from '../models/ProcessAnswers.js';
import { extractProcessId } from '../services/helpers.js';
import { saveAnswerAndNextStep } from '../services/answerservice.js'; // Import saveAnswerAndNextStep function
import { generateDeepLink } from '../services/deeplink.js'; // Import generateDeepLink function
import config from '../config/config.js'; // Import config

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

    // Create or retrieve user state
    let userState = await UserState.findOne({ userId: chatId });
    if (!userState) {
      console.log(`[DEBUG] Creating a new user state for user ${chatId}`);
      userState = new UserState({ userId: chatId });
      await userState.save();
    }

    // Save the current process and step index in the user state
    userState.processId = processId;
    userState.currentStepIndex = 0;
    userState.answers = [];
    userState.isProcessingStep = false;
    await userState.save();

    // Generate and present the deep link
    const botUsername = config.bot2Username; // Get bot username from config
    const deepLink = generateDeepLink(botUsername, processId);
    await bot.sendMessage(chatId, `Share this deep link with users: ${deepLink}`);

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
  const stepIndex = userState.currentStepIndex;

  if (currentStep.type === 'text_process') {
    await bot.sendMessage(chatId, `Step ${stepIndex + 1}: ${currentStep.prompt}`);
    bot.once('message', async (msg) => {
      if (msg.chat.id !== chatId) return; // Ignore messages from other chats
      console.log(`[DEBUG] Text input received: "${msg.text}" for processId: ${processId}`);

      await saveAnswerAndNextStep({
        bot,
        chatId,
        processId,
        userState,
        stepIndex,
        answer: msg.text,
      });
      await handleNextStep(bot, chatId, processId);
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
      console.log(`[DEBUG] Yes/No response received: "${response}" for processId: "${processId}"`);

      await saveAnswerAndNextStep({
        bot,
        chatId,
        processId,
        userState,
        stepIndex,
        answer: response,
      });
      await handleNextStep(bot, chatId, processId);
    });
  } else if (currentStep.type === 'file_process') {
    await bot.sendMessage(chatId, `Step ${stepIndex + 1}: ${currentStep.prompt}`);
    bot.once('document', async (msg) => {
      if (msg.chat.id !== chatId) return; // Ignore documents from other chats
      console.log(`[DEBUG] File received: "${msg.document.file_id}" for processId: ${processId}`);

      await saveAnswerAndNextStep({
        bot,
        chatId,
        processId,
        userState,
        stepIndex,
        answer: msg.document.file_id,
      });
      await handleNextStep(bot, chatId, processId);
    });
  }
};
