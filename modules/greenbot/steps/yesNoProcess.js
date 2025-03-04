/*
* @file services/greenbot/steps/yesNoProcess.js
* @module yesNoProcess
* @description This module handles the steps for the yes/no process.
* @param {object} bot - The Telegram bot instance.
* @param {number} chatId - The chat ID.
* @param {object} userState - The user's state (contains process info and current step index).
* @param {object} step - The current step object.
* @returns {Promise<void>} - A Promise that resolves when the step is handled.
*/


import { saveAnswer } from '../answerService.js';

export default async function handleYesNoProcessStep(bot, chatId, userState, step) {
  const debugPrefix = '[DEBUG yesNoProcess handleYesNoProcessStep]';
  let message = `<b>Step ${step.stepSequenceNumber} (Yes/No):</b> ${step.prompt}`;
  if (step.description) {
    message += `\n\n<i>${step.description}</i>`;
  }

  // Build inline keyboard with Yes/No buttons and navigation.
  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: "Yes", callback_data: "yes_no_yes" },
        { text: "No", callback_data: "yes_no_no" }
      ],
      [
        ...(userState.currentStepIndex > 0 ? [{ text: "Previous", callback_data: "previous_step" }] : []),
        { text: "Next", callback_data: "next_step" }
      ]
    ]
  };

  console.log(`${debugPrefix} Sending yes/no process prompt to chat ${chatId}`);
  await bot.sendMessage(chatId, message, { parse_mode: "HTML", reply_markup: inlineKeyboard });

  // Listen for the user's selection via callback query.
  bot.once('callback_query', async (callbackQuery) => {
    // Ensure the callback is coming from the intended chat.
    if (callbackQuery.message.chat.id !== chatId) return;
    const data = callbackQuery.data;

    // Only process our yes/no responses.
    if (data === 'yes_no_yes' || data === 'yes_no_no') {
      const answer = data === 'yes_no_yes' ? 'Yes' : 'No';
      console.log(`${debugPrefix} Received answer: ${answer}`);
      try {
        await saveAnswer({
          bot,
          chatId,
          processId: userState.processId,
          stepIndex: userState.currentStepIndex,
          answer,
          stepType: step.type,
          stepPrompt: step.prompt,
          stepDescription: step.description,
        });
        await bot.answerCallbackQuery(callbackQuery.id, { text: 'Answer recorded' });
        console.log(`${debugPrefix} Yes/No answer saved successfully.`);
      } catch (error) {
        console.error(`${debugPrefix} ERROR saving yes/no answer: ${error.message}`);
        await bot.answerCallbackQuery(callbackQuery.id, { text: 'Error saving answer' });
        await bot.sendMessage(chatId, 'An error occurred while saving your answer. Please try again.');
      }
    }
  });
}
