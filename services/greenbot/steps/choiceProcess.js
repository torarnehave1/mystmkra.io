// File: ../steps/choiceProcess.js

import dotenv from 'dotenv';
dotenv.config();

/**
 * Module: choiceProcess.js
 * Function: handleChoiceStep
 *
 * Presents a choice step to the user.
 * Displays the step prompt, description, and a set of option buttons derived from step.options.
 * Also includes navigation buttons ("Previous" and "Next").
 *
 * Parameters:
 *   bot      - The Telegram bot instance.
 *   chatId   - The Telegram chat ID.
 *   userState- The user's state (contains process info and current step index).
 *   step     - The current step object.
 */
export default async function handleChoiceStep(bot, chatId, userState, step) {
  const debugPrefix = '[DEBUG choiceProcess handleChoiceStep]';
  let caption = `<b>Step ${step.stepSequenceNumber} (Choice):</b> ${step.prompt}`;
  if (step.description) {
    caption += `\n\n<i>${step.description}</i>`;
  }

  // Build inline keyboard for choice options.
  const inlineKeyboard = { inline_keyboard: [] };
  
  // Assume step.options is an array of option strings.
  const optionButtons = (step.options || []).map((option, index) => [{
    text: option,
    callback_data: `choice_${index}` // You might enhance this to include process/step info.
  }]);
  
  if (optionButtons.length > 0) {
    inlineKeyboard.inline_keyboard.push(...optionButtons);
  }
  
  // Build navigation buttons row.
  const navRow = [];
  if (userState.currentStepIndex > 0) {
    navRow.push({ text: "Previous", callback_data: "previous_step" });
  }
  // "Next" is always available, even for choice steps.
  navRow.push({ text: "Next", callback_data: "next_step" });
  inlineKeyboard.inline_keyboard.push(navRow);
  
  console.log(`${debugPrefix} Sending choice step with caption: ${caption}`);
  await bot.sendMessage(chatId, caption, {
    parse_mode: "HTML",
    reply_markup: inlineKeyboard,
  });
}
