import UserState from '../models/UserState.js';
import Process from '../models/process.js';
import ProcessAnswers from '../models/ProcessAnswers.js';
import { extractProcessId } from '../services/helpers.js';
import { saveAnswerAndNextStep } from '../services/answerservice.js'; // Import saveAnswerAndNextStep function
import { generateDeepLink } from '../services/deeplink.js'; // Import generateDeepLink function
import config from '../config/config.js'; // Import config
import { getHelpFromOpenAI } from '../services/openaiService.js'; // Import getHelpFromOpenAI function
import { handleEditProcessCallback } from './editProcessService.js'; // Import handleEditProcessCallback function
import { getNextStep, getPreviousStep } from '../controllers/processController.js'; // Import new step navigation functions

const MAX_CAPTION_LENGTH = 1024; // Telegram API limit for caption length

const truncateCaption = (caption) => {
  if (caption.length > MAX_CAPTION_LENGTH) {
    return caption.substring(0, MAX_CAPTION_LENGTH - 3) + '...';
  }
  return caption;
};

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

    // Save the current process and step sequence number in the user state
    userState.processId = processId;
    userState.currentStepSequenceNumber = 1; // Start from the first step
    userState.answers = [];
    userState.isProcessingStep = false;
    await userState.save();

    // Generate and present the deep link
    const botUsername = config.botUsername; // Get bot username from config
    const deepLink = generateDeepLink(botUsername, processId);
    console.log(`[DEBUG] Generated deep link: ${deepLink}`);
    await bot.sendMessage(chatId, `Share this deep link with users: ${deepLink}`);

    // Start the process
    if (process.imageUrl) {
      const caption = `<b>${process.title}</b>\n\n<i>${process.description}</i>\n\n<b>Made in Mystmkra.io</b> - by AlivenessLAβ`;
      console.log(`[DEBUG VIEWPROCESS] Sending process image with caption: ${caption}`);
      await bot.sendPhoto(chatId, process.imageUrl, {
        caption: truncateCaption(caption),
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "Start", callback_data: `start_process_${processId}` }],
            [{ text: "End", callback_data: `end_process_${processId}` }],
          ],
        },
      });
    } else {
      const caption = `<b>${process.title}</b>\n\n<b>Made in Mystmkra.io</b> - by AlivenessLAβ`;
      console.log(`[DEBUG VIEWPROCESS] Sending process message with caption: ${caption}`);
      await bot.sendMessage(chatId, truncateCaption(caption), {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Start', callback_data: `start_process_${processId}` }],
            [{ text: 'End', callback_data: `end_process_${processId}` }],
          ],
        },
      });
    }

  } catch (error) {
    console.error(`[ERROR] Failed to retrieve process details: ${error.message}`);
    await bot.sendMessage(chatId, 'An error occurred. Please try again later.');
  }
};

// Function to handle moving to the next step
export const handleNextStep = async (bot, chatId, processId) => {
  try {
    const userState = await UserState.findOne({ userId: chatId });
    if (!userState) {
      throw new Error(`User state not found for userId: ${chatId}`);
    }

    const nextStep = await getNextStep(processId, userState.currentStepSequenceNumber);
    if (!nextStep) {
      await bot.sendMessage(chatId, 'You have completed all steps in this process.');
      return;
    }

    userState.currentStepSequenceNumber = nextStep.stepSequenceNumber;
    await userState.save();

    await presentStep(bot, chatId, processId, nextStep, userState);
  } catch (error) {
    console.error(`[ERROR] Failed to handle next step: ${error.message}`);
    await bot.sendMessage(chatId, 'An error occurred while presenting the next step. Please try again.');
  }
};

// Function to handle moving to the previous step
export const handlePreviousStep = async (bot, chatId, processId) => {
  try {
    const userState = await UserState.findOne({ userId: chatId });
    if (!userState) {
      throw new Error(`User state not found for userId: ${chatId}`);
    }

    const previousStep = await getPreviousStep(processId, userState.currentStepSequenceNumber);
    if (!previousStep) {
      await bot.sendMessage(chatId, 'You are at the first step of this process.');
      return;
    }

    userState.currentStepSequenceNumber = previousStep.stepSequenceNumber;
    await userState.save();

    await presentStep(bot, chatId, processId, previousStep, userState);
  } catch (error) {
    console.error(`[ERROR] Failed to handle previous step: ${error.message}`);
    await bot.sendMessage(chatId, 'An error occurred while presenting the previous step. Please try again.');
  }
};

const presentStep = async (bot, chatId, processId, currentStep, userState) => {
  const stepSequenceNumber = userState.currentStepSequenceNumber;

  if (currentStep.type === 'text_process') {
    await bot.sendMessage(chatId, `Step ${stepSequenceNumber}: <b>${currentStep.prompt}</b>\n\n<i>${currentStep.description}</i>`, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Get Help to Answer this question with mystmkra.io', callback_data: `get_help_${processId}` }],
        ],
      },
    });

    const callbackQueryHandler = async (callbackQuery) => {
      if (callbackQuery.data === `get_help_${processId}`) {
        await bot.sendMessage(chatId, 'Please wait for the AI to respond...');
        bot.removeListener('callback_query', callbackQueryHandler); // Remove listener to avoid duplicates
        bot.once('message', async (msg) => {
          if (msg.chat.id !== chatId) return; // Ignore messages from other chats
          const userDetails = msg.text;
          console.log(`[DEBUG] User details received: "${userDetails}" for processId: ${processId}`);

          try {
            const aiResponse = await getHelpFromOpenAI(currentStep.prompt, currentStep.description, userDetails);
            await bot.sendMessage(chatId, `AI Response:\n${aiResponse}`, {
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: [
                  [{ text: 'Approve', callback_data: `approve_${processId}_${stepSequenceNumber}` }],
                  [{ text: 'Reject', callback_data: `reject_${processId}_${stepSequenceNumber}` }],
                ],
              },
            });

            const approvalCallbackHandler = async (approvalCallback) => {
              if (approvalCallback.data === `approve_${processId}_${stepSequenceNumber}`) {
                await saveAnswerAndNextStep({
                  bot,
                  chatId,
                  processId,
                  userState,
                  stepSequenceNumber,
                  answer: aiResponse,
                });
                await handleNextStep(bot, chatId, processId);
              } else if (approvalCallback.data === `reject_${processId}_${stepSequenceNumber}`) {
                await bot.sendMessage(chatId, 'Please provide your own answer:');
                bot.removeListener('callback_query', approvalCallbackHandler); // Remove listener to avoid duplicates
                bot.once('message', async (userMsg) => {
                  if (userMsg.chat.id !== chatId) return; // Ignore messages from other chats
                  await saveAnswerAndNextStep({
                    bot,
                    chatId,
                    processId,
                    userState,
                    stepSequenceNumber,
                    answer: userMsg.text,
                  });
                  await handleNextStep(bot, chatId, processId);
                });
              }
            };

            bot.once('callback_query', approvalCallbackHandler);
          } catch (error) {
            await bot.sendMessage(chatId, 'Failed to get help from AI. Please try again later.');
          }
        });
      }
    };

    bot.once('callback_query', callbackQueryHandler);

    bot.once('message', async (msg) => {
      if (msg.chat.id !== chatId) return; // Ignore messages from other chats
      if (msg.text.startsWith('/')) {
        console.log(`[DEBUG] Command received: "${msg.text}" - not saving as answer.`);
        return; // Ignore commands
      }
      console.log(`[DEBUG] Text input received: "${msg.text}" for processId: ${processId}`);

      await saveAnswerAndNextStep({
        bot,
        chatId,
        processId,
        userState,
        stepSequenceNumber,
        answer: msg.text,
      });
      await handleNextStep(bot, chatId, processId);
    });
  } else if (currentStep.type === 'yes_no_process') {
    await bot.sendMessage(chatId, `Step ${stepSequenceNumber}: ${currentStep.prompt}`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Yes', callback_data: `yes_${processId}` }],
          [{ text: 'No', callback_data: `no_${processId}` }],
        ],
      },
    });

    const callbackQueryHandler = async (callbackQuery) => {
      if (callbackQuery.message.chat.id !== chatId) return; // Ignore callback from other chats
      const response = callbackQuery.data.startsWith('yes') ? 'Yes' : 'No';
      console.log(`[DEBUG] Yes/No response received: "${response}" for processId: "${processId}"`);

      await saveAnswerAndNextStep({
        bot,
        chatId,
        processId,
        userState,
        stepSequenceNumber,
        answer: response,
      });
      await handleNextStep(bot, chatId, processId);
    };

    bot.once('callback_query', callbackQueryHandler);
  } else if (currentStep.type === 'file_process') {
    await bot.sendMessage(chatId, `Step ${stepSequenceNumber}: ${currentStep.prompt}`);
    bot.once('document', async (msg) => {
      if (msg.chat.id !== chatId) return; // Ignore documents from other chats
      console.log(`[DEBUG] File received: "${msg.document.file_id}" for processId: ${processId}`);

      await saveAnswerAndNextStep({
        bot,
        chatId,
        processId,
        userState,
        stepSequenceNumber,
        answer: msg.document.file_id,
      });
      await handleNextStep(bot, chatId, processId);
    });
  } else if (currentStep.type === 'choice') {
    console.log(`[DEBUG] Presenting choice options for processId: ${processId}`);
    const options = currentStep.options.map((option, index) => [{ text: option, callback_data: `choice_${index}` }]);
    await bot.sendMessage(chatId, `Step ${stepSequenceNumber}: ${currentStep.prompt}\n\n${currentStep.description}`, {
      reply_markup: {
        inline_keyboard: options,
      },
    });

    const callbackQueryHandler = async (callbackQuery) => {
      if (callbackQuery.message.chat.id !== chatId) return; // Ignore callbacks from other chats
      const choiceIndex = parseInt(callbackQuery.data.split('_')[1]);
      const selectedOption = currentStep.options[choiceIndex];

      console.log(`[DEBUG] Choice selected: "${selectedOption}" for processId: ${processId}`);

      await saveAnswerAndNextStep({
        bot,
        chatId,
        processId,
        userState,
        stepSequenceNumber,
        answer: selectedOption,
      });
      await handleNextStep(bot, chatId, processId);
    };

    bot.once('callback_query', callbackQueryHandler);
  } else if (currentStep.type === 'final') {
    await bot.sendMessage(chatId, `Step ${stepSequenceNumber}: ${currentStep.prompt}\n\n${currentStep.description}`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Confirm', callback_data: `confirm_${processId}` }],
        ],
      },
    });

    const callbackQueryHandler = async (callbackQuery) => {
      if (callbackQuery.message.chat.id !== chatId) return; // Ignore callbacks from other chats
      if (callbackQuery.data === `confirm_${processId}`) {
        await bot.sendMessage(chatId, 'Your application has been confirmed. Thank you!');
        await handleNextStep(bot, chatId, processId);
      }
    };

    bot.once('callback_query', callbackQueryHandler);
  } else if (currentStep.type === 'info_process') {
    console.log(`[DEBUG][viewprocess][bot1] Presenting information step for processId: ${processId}`);
    await bot.sendMessage(chatId, `Information: ${currentStep.description}`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Previous Step', callback_data: `previous_review_step_${processId}` }],
          [{ text: 'Next Step', callback_data: `next_review_step_${processId}` }]
        ],
      },
    });
    userState.currentStepSequenceNumber += 1;
    await userState.save();
    await saveAnswerAndNextStep({
      bot,
      chatId,
      processId,
      stepSequenceNumber,
      answer: chatId, // Save the chatId as the answer
    });
  } else {
    console.warn(`Unknown step type: ${currentStep.type}. Skipping step.`);
    await handleNextStep(bot, chatId, processId);
  }
};
