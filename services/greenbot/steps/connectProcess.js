import { saveAnswer } from '../answerService.js';
import { viewProcessHeader } from '../ViewProcessHeader.js';
import { handleNextStep } from '../processNavigator.js'; // Import handleNextStep

export default async function handleConnectProcessStep(bot, chatId, userState, step) {
  const debugPrefix = '[DEBUG connectProcess handleConnectProcessStep]';
  const processId = step.description;

  if (!processId) {
    console.error(`${debugPrefix} ERROR: No process ID found in step description.`);
    await bot.sendMessage(chatId, "No process ID found in the step description.");
    return;
  }

  const caption = `<b>Step ${step.stepSequenceNumber}:</b> ${step.prompt}\n\nDo you want to view the process ID set in the description?`;
  const inlineKeyboard = {
    inline_keyboard: [
      [{ text: "Yes", callback_data: `view_process_id_${processId}` }],
      [{ text: "No", callback_data: "next_step" }]
    ]
  };

  console.log(`${debugPrefix} Asking user if they want to view the process ID.`);
  await bot.sendMessage(chatId, caption, {
    parse_mode: "HTML",
    reply_markup: inlineKeyboard,
  });

  const callbackHandler = async (callbackQuery) => {
    if (callbackQuery.message.chat.id !== chatId) return; // Ensure the callback is from the intended chat
    if (callbackQuery.data === `view_process_id_${processId}`) {
      await viewProcessHeader(bot, chatId, processId); // Use viewProcessHeader to display the process
    }
    await saveAnswer({
      bot,
      chatId,
      processId: userState.processId,
      stepIndex: userState.currentStepIndex,
      answer: callbackQuery.data === `view_process_id_${processId}` ? processId : 'Skipped',
      stepType: step.type,
      stepPrompt: step.prompt,
      stepDescription: step.description,
    });
    //await bot.sendMessage(chatId, "Moving to the next step...");
    if (callbackQuery.data === "next_step") {
     // await handleNextStep(bot, chatId, userState); // Go to the next step in the current process
    }
    bot.removeListener('callback_query', callbackHandler); // Remove the listener after handling the callback
  };

  bot.on('callback_query', callbackHandler);
}
