/*
*@file services/greenbot/steps/infoProcess.js
*@module infoProcess
*@description This module handles the steps for the info process.
*@param {object} bot - The Telegram bot instance.
*@param {number} chatId - The chat ID.
*@param {object} userState - The user's state (contains process info and current step index).
*@param {object} step - The current step object.
*@returns {Promise<void>} - A Promise that resolves when the step is handled.
*/



export default async function handleInfoProcessStep(bot, chatId, userState, step) {
  const debugPrefix = '[DEBUG handleInfoProcessStep]';
  let caption = `<b>Step ${step.stepSequenceNumber}:</b> ${step.prompt}`;
  if (step.description) {
    caption += `\n\n<i>${step.description}</i>`;
  }
  const inlineKeyboard = { inline_keyboard: [] };
  const navRow = [];
  if (userState.currentStepIndex > 0) {
    navRow.push({ text: "Previous", callback_data: "previous_step" });
  }
  navRow.push({ text: "Next", callback_data: "next_step" });
  inlineKeyboard.inline_keyboard.push(navRow);
  console.log(`${debugPrefix} Sending step with caption: ${caption}`);
  await bot.sendMessage(chatId, caption, {
    parse_mode: "HTML",
    reply_markup: inlineKeyboard,
  });
}
