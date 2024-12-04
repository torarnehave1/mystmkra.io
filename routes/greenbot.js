import express from 'express';
import TelegramBot from 'node-telegram-bot-api';
import config from '../config/config.js';
import UserState from '../models/UserState.js';
import Process from '../models/Process.js';
import translationsData from '../translations/process_translations.json' assert { type: 'json' };

// [SECTION 1: Initialization]
// This section initializes the Express router and Telegram bot
const router = express.Router();
const bot = new TelegramBot(config.botToken, { polling: true });

const translations = translationsData[0].translations;

// [SECTION 2: Helper Functions]
// This section contains helper functions for translations and ID extraction

// Helper: Get translation
const getTranslation = (language, key, placeholders = {}) => {
  const translation = translations[language]?.[key] || key;
  return translation.replace(/\{(\w+)\}/g, (_, placeholder) => placeholders[placeholder] || `{${placeholder}}`);
};

// Function to extract processId
function extractProcessId(data) {
  const parts = data.split('_');
  console.log(`[DEBUG] extractProcessId: data="${data}", parts="${parts}"`);
  return parts.slice(2).join('_');
}

// Function to extract step type and processId
function extractStepTypeAndProcessId(data) {
  const parts = data.split('_');
  console.log(`[DEBUG] extractStepTypeAndProcessId: data="${data}", parts="${parts}"`);
  const type = parts.slice(2, -2).join('_'); // Extract step type
  const processId = parts.slice(-2).join('_'); // Extract processId
  return { type, processId };
}

// Function to validate processId
function isValidProcessId(processId) {
  return typeof processId === 'string' && processId.match(/^process_\d+$/);
}

// [SECTION 3: Bot Commands]
// This section contains the bot commands and their handlers

// Step 1: Start Command and Language Selection
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  console.log(`[DEBUG] /start triggered by user ${chatId}`);

  try {
    let userState = await UserState.findOne({ userId: chatId });

    if (!userState) {
      console.log(`[DEBUG] Creating a new user state for user ${chatId}`);
      userState = new UserState({ userId: chatId });
      await userState.save();
    }

    // Reset process-related state
    userState.processId = null;
    userState.currentStepIndex = 0;
    await userState.save();

    // Send welcome message with language selection
    await bot.sendMessage(chatId, 'Welcome! Please select your language:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'English', callback_data: 'lang_EN' }],
          [{ text: 'Norwegian', callback_data: 'lang_NO' }],
        ],
      },
    });
  } catch (error) {
    console.error(`[ERROR] Failed to execute /start command: ${error.message}`);
    await bot.sendMessage(chatId, 'An error occurred. Please try again later.');
  }
});

// Handle callback queries
bot.on('callback_query', async (callbackQuery) => {
  const { data, message } = callbackQuery;
  const chatId = message.chat.id;

  // Handle language selection
  if (data.startsWith('lang_')) {
    const language = data.split('_')[1];
    console.log(`[DEBUG] Language selected: ${language} for user ${chatId}`);

    try {
      const userState = await UserState.findOne({ userId: chatId });
      userState.systemLanguage = language;
      await userState.save();

      // Send process creation options
      await bot.sendMessage(chatId, `Language set to ${language === 'EN' ? 'English' : 'Norwegian'}. What would you like to do next?`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Create Process Manually', callback_data: 'create_process_manual' }],
            [{ text: 'Use AI to Create Process', callback_data: 'create_process_ai' }],
          ],
        },
      });
    } catch (error) {
      console.error(`[ERROR] Failed to handle language selection: ${error.message}`);
      await bot.sendMessage(chatId, 'An error occurred. Please try again later.');
    }
    return;
  }

  // Step 2: Process Creation
  if (data === 'create_process_manual') {
    console.log(`[DEBUG] User ${chatId} selected manual process creation`);
    await bot.sendMessage(chatId, 'Please provide a title for your process:');

    bot.once('message', async (msg) => {
      const processTitle = msg.text;
      console.log(`[DEBUG] Received process title: "${processTitle}" from user ${chatId}`);

      const newProcess = new Process({
        processId: `process_${Date.now()}`,
        title: processTitle,
        description: '',
        steps: [],
        createdBy: chatId,
      });

      try {
        await newProcess.save();
        console.log(`[DEBUG] Process saved with processId: "${newProcess.processId}"`);
      } catch (error) {
        console.error(`[ERROR] Failed to save process: ${error.message}`);
        await bot.sendMessage(chatId, 'An error occurred while saving the process. Please try again later.');
        return;
      }

      const userState = await UserState.findOne({ userId: chatId });
      userState.processId = newProcess.processId;
      await userState.save();

      await bot.sendMessage(chatId, `Process "${processTitle}" has been created. What would you like to do next?`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Add Step', callback_data: `add_step_${newProcess.processId}` }],
            [{ text: 'Finish Process', callback_data: `finish_process_${newProcess.processId}` }],
          ],
        },
      });
    });
    return;
  }

  // Step 3: Add Step to Process
  if (data.startsWith('add_step_')) {
    const processId = extractProcessId(data);
    console.log(`[DEBUG] Adding step to processId: "${processId}" for chatId: ${chatId}`);

    if (!isValidProcessId(processId)) {
      console.error(`[ERROR] Invalid processId extracted: "${processId}"`);
      await bot.sendMessage(chatId, 'An error occurred. Please try again.');
      return;
    }

    await bot.sendMessage(chatId, 'Please select the step type:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Text Input', callback_data: `step_type_text_${processId}` }],
          [{ text: 'Yes/No', callback_data: `step_type_yes_no_${processId}` }],
          [{ text: 'File Upload', callback_data: `step_type_file_${processId}` }],
          [{ text: 'Generate Questions', callback_data: `step_type_generate_questions_${processId}` }],
        ],
      },
    });
    return;
  }

  // Step 4: Handle Step Type Selection
  if (data.startsWith('step_type_')) {
    const { type, processId } = extractStepTypeAndProcessId(data);
    console.log(`[DEBUG] Step type "${type}" selected for processId: "${processId}" by chatId: ${chatId}`);

    if (!isValidProcessId(processId)) {
      console.error(`[ERROR] Invalid processId extracted: "${processId}"`);
      await bot.sendMessage(chatId, 'An error occurred. Please try again.');
      return;
    }

    await bot.sendMessage(chatId, `Please provide the prompt for this ${type} step:`);

    bot.once('message', async (msg) => {
      const stepPrompt = msg.text;
      console.log(`[DEBUG] Received step prompt: "${stepPrompt}" for step type: "${type}"`);

      const process = await Process.findOne({ processId });
      if (!process) {
        console.error(`[ERROR] Process not found for processId: "${processId}"`);
        await bot.sendMessage(chatId, 'The process could not be found. Please try again.');
        return;
      }

      const newStep = {
        stepId: `step_${Date.now()}`,
        type,
        prompt: stepPrompt,
      };

      process.steps.push(newStep);
      await process.save();
      console.log(`[DEBUG] Added step to processId: "${processId}"`);

      await bot.sendMessage(chatId, `Step has been added to the process "${process.title}". What would you like to do next?`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Add Another Step', callback_data: `add_step_${processId}` }],
            [{ text: 'Finish Process', callback_data: `finish_process_${processId}` }],
          ],
        },
      });
      return;
    });
  }

  // Step 5: Finish Process
  if (data.startsWith('finish_process_')) {
    const processId = extractProcessId(data);
    console.log(`[DEBUG] Finishing process with processId: "${processId}" for chatId: ${chatId}`);

    if (!isValidProcessId(processId)) {
      console.error(`[ERROR] Invalid processId extracted: "${processId}"`);
      await bot.sendMessage(chatId, 'An error occurred. Please try again.');
      return;
    }

    try {
      const process = await Process.findOne({ processId });
      if (!process) {
        console.error(`[ERROR] Process not found for processId: "${processId}"`);
        await bot.sendMessage(chatId, 'The process could not be found. Please try again.');
        return;
      }

      // Mark the process as finished
      process.isFinished = true;
      await process.save();
      console.log(`[DEBUG] Process with processId: "${processId}" has been marked as finished`);

      await bot.sendMessage(chatId, `Process "${process.title}" has been finished. Thank you!`);
    } catch (error) {
      console.error(`[ERROR] Failed to finish process: ${error.message}`);
      await bot.sendMessage(chatId, 'An error occurred. Please try again later.');
    }
  }
});

// [SECTION 4: View Finished Process]
// This section contains the code to view a finished process

// Command to view finished processes
bot.onText(/\/view/, async (msg) => {
  const chatId = msg.chat.id;
  console.log(`[DEBUG] /view_finished triggered by user ${chatId}`);

  try {
    const finishedProcesses = await Process.find({ isFinished: true, createdBy: chatId });

    if (finishedProcesses.length === 0) {
      await bot.sendMessage(chatId, 'You have no finished processes.');
      return;
    }

    const processButtons = finishedProcesses.map(process => [{ text: process.title, callback_data: `view_process_${process.processId}` }]);

    await bot.sendMessage(chatId, 'Select a finished process to view:', {
      reply_markup: {
        inline_keyboard: processButtons,
      },
    });
  } catch (error) {
    console.error(`[ERROR] Failed to retrieve finished processes: ${error.message}`);
    await bot.sendMessage(chatId, 'An error occurred. Please try again later.');
  }
});

// Handle viewing a finished process
bot.on('callback_query', async (callbackQuery) => {
  const { data, message } = callbackQuery;
  const chatId = message.chat.id;

  if (data.startsWith('view_process_')) {
    const processId = extractProcessId(data);
    console.log(`[DEBUG] Viewing process with processId: "${processId}" for chatId: ${chatId}`);

    try {
      const process = await Process.findOne({ processId, createdBy: chatId });
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
  }

  // Handle starting the process
  if (data.startsWith('start_process_')) {
    const processId = extractProcessId(data);
    console.log(`[DEBUG] Starting process with processId: "${processId}" for chatId: ${chatId}`);

    try {
      const userState = await UserState.findOne({ userId: chatId });
      const process = await Process.findOne({ processId, createdBy: chatId });

      if (!process) {
        console.error(`[ERROR] Process not found for processId: "${processId}"`);
        await bot.sendMessage(chatId, 'The process could not be found. Please try again.');
        return;
      }

      const currentStepIndex = userState.currentStepIndex;
      if (currentStepIndex >= process.steps.length) {
        await bot.sendMessage(chatId, 'You have completed all steps in this process.', {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Submit Process', callback_data: `submit_process_${processId}` }],
            ],
          },
        });
        return;
      }

      const currentStep = process.steps[currentStepIndex];
      if (currentStep.type === 'text') {
        await bot.sendMessage(chatId, `Step ${currentStepIndex + 1}: ${currentStep.prompt}`);
        bot.once('message', async (msg) => {
          userState.currentStepIndex += 1;
          await userState.save();
          await bot.sendMessage(chatId, 'Response recorded. Moving to the next step...');
          handleNextStep(chatId, processId);
        });
      } else if (currentStep.type === 'yes_no') {
        await bot.sendMessage(chatId, `Step ${currentStepIndex + 1}: ${currentStep.prompt}`, {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Yes', callback_data: `yes_${processId}` }],
              [{ text: 'No', callback_data: `no_${processId}` }],
            ],
          },
        });
      }
    } catch (error) {
      console.error(`[ERROR] Failed to start process: ${error.message}`);
      await bot.sendMessage(chatId, 'An error occurred. Please try again later.');
    }
  }

  // Handle yes/no responses
  if (data.startsWith('yes_') || data.startsWith('no_')) {
    const processId = extractProcessId(data);
    console.log(`[DEBUG] Received yes/no response for processId: "${processId}" for chatId: ${chatId}`);

    try {
      const userState = await UserState.findOne({ userId: chatId });
      userState.currentStepIndex += 1;
      await userState.save();
      await bot.sendMessage(chatId, 'Response recorded. Moving to the next step...');
      handleNextStep(chatId, processId);
    } catch (error) {
      console.error(`[ERROR] Failed to record yes/no response: ${error.message}`);
      await bot.sendMessage(chatId, 'An error occurred. Please try again later.');
    }
  }

  // Handle submitting the process
  if (data.startsWith('submit_process_')) {
    const processId = extractProcessId(data);
    console.log(`[DEBUG] Submitting process with processId: "${processId}" for chatId: ${chatId}`);

    try {
      const process = await Process.findOne({ processId, createdBy: chatId });
      if (!process) {
        console.error(`[ERROR] Process not found for processId: "${processId}"`);
        await bot.sendMessage(chatId, 'The process could not be found. Please try again.');
        return;
      }

      await bot.sendMessage(chatId, `Process "${process.title}" has been submitted. Thank you!`);
    } catch (error) {
      console.error(`[ERROR] Failed to submit process: ${error.message}`);
      await bot.sendMessage(chatId, 'An error occurred. Please try again later.');
    }
  }
});

// Function to handle moving to the next step
async function handleNextStep(chatId, processId) {
  try {
    const userState = await UserState.findOne({ userId: chatId });
    const process = await Process.findOne({ processId, createdBy: chatId });

    const currentStepIndex = userState.currentStepIndex;
    if (currentStepIndex >= process.steps.length) {
      await bot.sendMessage(chatId, 'You have completed all steps in this process.', {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Submit Process', callback_data: `submit_process_${processId}` }],
          ],
        },
      });
      return;
    }

    const currentStep = process.steps[currentStepIndex];
    if (currentStep.type === 'text') {
      await bot.sendMessage(chatId, `Step ${currentStepIndex + 1}: ${currentStep.prompt}`);
      bot.once('message', async (msg) => {
        userState.currentStepIndex += 1;
        await userState.save();
        await bot.sendMessage(chatId, 'Response recorded. Moving to the next step...');
        handleNextStep(chatId, processId);
      });
    } else if (currentStep.type === 'yes_no') {
      await bot.sendMessage(chatId, `Step ${currentStepIndex + 1}: ${currentStep.prompt}`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Yes', callback_data: `yes_${processId}` }],
            [{ text: 'No', callback_data: `no_${processId}` }],
          ],
        },
      });
    }
  } catch (error) {
    console.error(`[ERROR] Failed to handle next step: ${error.message}`);
    await bot.sendMessage(chatId, 'An error occurred. Please try again later.');
  }
}

// [SECTION 5: Status Endpoint]
// This section contains the status endpoint for health checks
router.get('/status', (req, res) => {
  res.json({ status: 'Running' });
});

export default router;