/**
 * Handles a call to action process step.
 * 
 * This function sends a message with an image, title, description, and an inline button.
 * The button can be clicked to navigate to a specified URL.
 *
 * @file /c:/Users/torar/MyApps/mystmkra.io/services/greenbot/steps/callToActionProcess.js
 * 
 * @param {TelegramBot} bot - The Telegram bot instance.
 * @param {Number} chatId - The chat ID to send the message to.
 * @param {Object} userState - The user state object (containing processId and currentStepIndex).
 * @param {Object} step - The current process step object.
 */
export default async function handleCallToActionProcessStep(bot, chatId, userState, step) {
  const debugPrefix = '[DEBUG callToActionProcess handleCallToActionProcessStep]';
  const { title, description, url, imageUrl } = step;

  // Build the message with image, title, description, and inline button.
  const caption = `<b>${title}</b>\n\n${description}`;
  const inlineKeyboard = {
    inline_keyboard: [
      [{ text: "Yes", url: url }],
      [{ text: "No", callback_data: "next_step" }]
    ]
  };

  console.log(`${debugPrefix} Sending call to action process message to chat ${chatId}`);

  try {
    // Send the message with the image, title, description, and inline button.
    await bot.sendPhoto(chatId, imageUrl, {
      caption: caption,
      parse_mode: "HTML",
      reply_markup: inlineKeyboard
    });
  } catch (error) {
    console.error(`${debugPrefix} ERROR sending call to action message: ${error.message}`);
    await bot.sendMessage(chatId, "An error occurred while sending the call to action. Please try again.");
  }
}
