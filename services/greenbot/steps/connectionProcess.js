export default async function handleConnectionStep(bot, chatId, userState, step) {
  const debugPrefix = '[DEBUG connectionProcess handleConnectionStep]';
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
}
