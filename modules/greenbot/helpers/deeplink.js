/**
 * @file services/greenbot/helpers/deeplink.js
 * @module deeplink

 * Generate a Telegram deep link for a specific process.
 * @param {String} botUsername - The bot's username (e.g., greenchickenbot).
 * @param {String} processId - The ID of the process to link to.
 * @returns {String} - The generated deep link.
 */
export const generateDeepLink = (botUsername, processId) => {
  if (!botUsername || !processId) {
    throw new Error('Both botUsername and processId are required to generate a deep link.');
  }

  const deepLink = `https://t.me/${botUsername}?start=view_process_${processId}`;
  console.log(`[DEBUG DEEPLINK] Generated deep link: ${deepLink}`);
  return deepLink;
};