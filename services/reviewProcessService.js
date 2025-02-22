import UserState from '../models/UserState.js';
import Process from '../models/process.js';
import ProcessAnswers from '../models/ProcessAnswers.js';
import { presentStep } from './answerservice.js'; // Import presentStep from answerservice

const MODULE_CODE = 'RP001';

/**
 * Handle presenting the next step in review mode.
 * @param {Object} bot - Telegram bot instance.
 * @param {Number} chatId - Telegram chat ID of the user.
 * @param {String} processId - ID of the process the user is working on.
 */
export const handleNextReviewStep = async (bot, chatId, processId) => {
    const CALL_CODE = 'HNRS001BAK';
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

    if (currentStep.type === 'final') {
        await bot.sendMessage(chatId, message, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Confirm', callback_data: `confirm_${processId}` }],
                    [{ text: 'Previous Step', callback_data: `previous_review_step_${processId}` }]
                ],
            },
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

        bot.removeAllListeners('callback_query'); // Ensure no duplicate listeners
        bot.on('callback_query', callbackQueryHandler);
    } else if (currentStep.type === 'file_process') {
        console.log(`[DEBUG] [PES01] Presenting file upload for processId: ${processId}`);

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

        bot.removeAllListeners('callback_query'); // Ensure no duplicate listeners
        bot.on('callback_query', callbackQueryHandler);
    } else {
        await bot.sendMessage(chatId, message, { parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } });
    }

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
        } else if (callbackQuery.data === `confirm_${processId}`) {
            await bot.sendMessage(chatId, 'You have confirmed the final step.');
        }
    });

    // Check for all different step types and use the functionality in answerservice
    // if (['text_process', 'yes_no_process', 'file_process', 'choice', 'generate_questions_process', 'final', 'info_process'].includes(currentStep.type)) {
    //    await presentStep(bot, chatId, processId, currentStep, userState);
    // }
};

const isValidFileType = (document, allowedTypes) => {
    const fileType = document.mime_type.split('/')[1];
    return allowedTypes.includes(fileType);
};
