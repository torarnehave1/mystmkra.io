/*
* @file services/greenbot/steps/textProcess.js
* @module textProcess
* @description This module handles the steps for the text process.
* @param {object} bot - The Telegram bot instance.
* @param {number} chatId - The chat ID.
* @param {object} userState - The user's state (contains process info and current step index).
* @param {object} step - The current step object.
* @returns {Promise<void>} - A Promise that resolves when the step is handled.
*/


import { saveAnswer } from '../answerService.js';

export default async function handleTextProcessStep(bot, chatId, userState, step) {
  const debugPrefix = '[DEBUG textProcess handleTextProcessStep]';
  let message = `<b>Step ${step.stepSequenceNumber} (Text):</b> ${step.prompt}`;
  if (step.description) {
    message += `\n\n<i>${step.description}</i>`;
  }

  // Build inline keyboard for navigation.
  const inlineKeyboard = { inline_keyboard: [] };
  const navRow = [];
  if (userState.currentStepIndex > 0) {
    navRow.push({ text: "Previous", callback_data: "previous_step" });
  }
  // "Next" button allows the user to skip if not required, or can be used after submission.
  navRow.push({ text: "Next", callback_data: "next_step" });
  inlineKeyboard.inline_keyboard.push(navRow);

  console.log(`${debugPrefix} Sending text process prompt to chat ${chatId}`);
  await bot.sendMessage(chatId, message, { parse_mode: "HTML", reply_markup: inlineKeyboard });

  // Listen for the user's text response. Using 'bot.once' ensures we capture the next message.
  bot.once('message', async (msg) => {
    // Ensure we process only messages from the correct chat and ignore commands.
    if (msg.chat.id !== chatId || !msg.text || msg.text.startsWith('/')) return;

    console.log(`${debugPrefix} Received text response: ${msg.text}`);

    // Validate if the step is required.
    if (step.validation.required && (!msg.text || msg.text.trim() === "")) {
      await bot.sendMessage(chatId, "This field is required. Please provide valid input.");
      // Optionally, you might want to re-invoke the text process step handler here.
      return;
    }

    // Save the answer using your answer service.
    try {
      await saveAnswer({
        bot,
        chatId,
        processId: userState.processId,
        stepIndex: userState.currentStepIndex,
        answer: msg.text,
        stepType: step.type,
        stepPrompt: step.prompt,
        stepDescription: step.description,
      });
      console.log(`${debugPrefix} Text answer saved successfully.`);
    } catch (error) {
      console.error(`${debugPrefix} ERROR saving text answer: ${error.message}`);
      await bot.sendMessage(chatId, "An error occurred while saving your answer. Please try again.");
    }
  });
}
