import { saveAnswer } from '../answerService.js';

/**
 * @file services/greenbot/steps/soundProcess.js
 * @module soundProcess
 * 
 * Handles a sound process step.
 * 
 * This function sends an audio file using the Telegram bot's sendAudio method.
 * It uses:
 *   - step.description as the URL/path to the audio file,
 *   - step.title as the audio's title,
 *   - step.prompt as the performer (or additional info).
 * 
 * It then builds a navigation inline keyboard (Previous/Next) similar to textProcess.
 * Finally, it saves the audio URL as the user's answer, unless in view mode.
 *
 * @param {TelegramBot} bot - The Telegram bot instance.
 * @param {Number} chatId - The chat ID to send the audio to.
 * @param {Object} userState - The user state object (containing processId and currentStepIndex).
 * @param {Object} step - The current process step object.
 */
export default async function handleSoundProcessStep(bot, chatId, userState, step) {
  const debugPrefix = '[DEBUG soundProcess handleSoundProcessStep]';
  // Use the step's description as the audio file URL/path.
  const audioUrl = step.description;
  // Use title and prompt fields as provided, with fallbacks if needed.
  const title = step.title || "Sound";
  const performer = step.prompt || "Sound Process";

  // Build an inline keyboard for navigation (similar to textProcess).
  const inlineKeyboard = { inline_keyboard: [] };
  const navRow = [];
  if (userState.currentStepIndex > 0) {
    navRow.push({ text: "Previous", callback_data: "previous_step" });
  }
  navRow.push({ text: "Next", callback_data: "next_step" });
  inlineKeyboard.inline_keyboard.push(navRow);

  console.log(`${debugPrefix} Sending sound process audio to chat ${chatId}`);

  try {
    // Send the audio file using sendAudio. This method accepts either a URL or a local file path.
    await bot.sendAudio(chatId, audioUrl, {
      title: title,
      performer: performer,
      reply_markup: inlineKeyboard
    });
  } catch (error) {
    console.error(`${debugPrefix} ERROR sending sound audio: ${error.message}`);
    await bot.sendMessage(chatId, "An error occurred while sending the audio. Please try again.");
  }
}
