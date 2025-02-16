import UserState from '../models/UserState.js';
import Process from '../models/process.js';
import ProcessAnswers from '../models/ProcessAnswers.js';

const MODULE_CODE = 'RP001';

/**
 * Handle presenting the next step in review mode.
 * @param {Object} bot - Telegram bot instance.
 * @param {Number} chatId - Telegram chat ID of the user.
 * @param {String} processId - ID of the process the user is working on.
 */
export const handleNextReviewStep = async (bot, chatId, processId) => {
    const CALL_CODE = 'HNRS001';
    console.debug(`[DEBUG] [${MODULE_CODE}-${CALL_CODE}] handleNextReviewStep called with chatId: ${chatId}, processId: ${processId}`);
    try {
        const userState = await UserState.findOne({ userId: chatId });
        if (!userState) {
            throw new Error(`User state not found for userId: ${chatId}`);
        }

        const process = await Process.findById(processId);
        if (!process) {
            throw new Error(`Process not found with processId: ${processId}`);
        }

        const currentStep = process.steps[userState.currentStepIndex];
        if (!currentStep) {
            await bot.sendMessage(chatId, 'You have completed all steps in this process.');
            return;
        }

        await presentReviewStep(bot, chatId, processId, currentStep, userState);
    } catch (error) {
        console.error(`[ERROR] [${MODULE_CODE}-${CALL_CODE}] Failed to handle next review step: ${error.message}`);
        await bot.sendMessage(chatId, 'An error occurred while presenting the next step. Please try again.');
    }
};

/**
 * Present the current step in review mode.
 * @param {Object} bot - Telegram bot instance.
 * @param {Number} chatId - Telegram chat ID of the user.
 * @param {String} processId - ID of the process the user is working on.
 * @param {Object} currentStep - The step to present to the user.
 * @param {Object} userState - Current state of the user.
 */
const presentReviewStep = async (bot, chatId, processId, currentStep, userState) => {
    const CALL_CODE = 'PRS001';
    console.debug(`[DEBUG] [${MODULE_CODE}-${CALL_CODE}] presentReviewStep called with chatId: ${chatId}, processId: ${processId}, stepIndex: ${userState.currentStepIndex}`);
    const stepIndex = userState.currentStepIndex;

    const processAnswers = await ProcessAnswers.findOne({ userId: chatId, processId });
    const existingAnswer = processAnswers?.answers.find((a) => a.stepIndex === stepIndex)?.answer;

    let message = `Step ${stepIndex + 1}: ${currentStep.prompt}\n\n${currentStep.description}`;
    if (existingAnswer) {
        message += `\n\nYour previous answer: ${existingAnswer}`;
    }

    const inlineKeyboard = [
        [{ text: 'Previous Step', callback_data: `previous_review_step_${processId}` }],
        [{ text: 'Next Step', callback_data: `next_review_step_${processId}` }],
    ];

    await bot.sendMessage(chatId, message, { reply_markup: { inline_keyboard: inlineKeyboard } });


    bot.removeAllListeners('callback_query'); // Ensure no duplicate listeners
bot.once('callback_query', async (callbackQuery) => {

   
        if (callbackQuery.message.chat.id !== chatId) return; // Ignore callback from other chats
        if (callbackQuery.data === `next_review_step_${processId}`) {
            userState.currentStepIndex += 1;
            await userState.save();
            await handleNextReviewStep(bot, chatId, processId);
        } else if (callbackQuery.data === `previous_review_step_${processId}`) {
            userState.currentStepIndex -= 1;
            await userState.save();
            await handleNextReviewStep(bot, chatId, processId);
        }
    });
};
