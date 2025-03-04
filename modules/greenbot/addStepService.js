import Process from '../greenbot/models/process.js';

/**
 * Handles adding a new step to the process.
 * It prompts the user to select a step type, then collects the step prompt and description,
 * creates a new step object, appends it to the process, and saves the document.
 *
 * @param {TelegramBot} bot - The Telegram bot instance.
 * @param {Number} chatId - The Telegram chat ID.
 * @param {String} processId - The ID of the process to update.
 * @param {String} position - The position to add the step ('before' or 'after' or 'end').
 * @param {Number} stepIndex - The index of the step to add before or after (optional).
 */
export const handleAddStep = async (bot, chatId, processId, position = 'end', stepIndex = null) => {
  console.log(`[DEBUG] Adding step to processId: "${processId}" for chatId: ${chatId} at position: ${position} stepIndex: ${stepIndex}`);

  // Fetch the process to check existing steps.
  const process = await Process.findById(processId);
  if (!process) {
    console.error(`[ERROR] Process not found for processId: "${processId}"`);
    await bot.sendMessage(chatId, 'The process could not be found. Please try again.');
    return;
  }

  // Step 1: Ask user to select the step type via an inline keyboard.
  await bot.sendMessage(chatId, 'Please select the step type:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Text Input', callback_data: `step_type_text_process_${processId}` }],
        [{ text: 'Yes/No', callback_data: `step_type_yes_no_process_${processId}` }],
        [{ text: 'File Upload', callback_data: `step_type_file_process_${processId}` }],
        [{ text: 'Choice', callback_data: `step_type_choice_${processId}` }],
        [{ text: 'Generate Questions', callback_data: `step_type_generate_questions_process_${processId}` }],
        [{ text: 'Final Step', callback_data: `step_type_final_${processId}` }],
        [{ text: 'Email', callback_data: `step_type_email_process_${processId}` }],
        [{ text: 'Info', callback_data: `step_type_info_process_${processId}` }],
        [{ text: 'Sound', callback_data: `step_type_sound_${processId}` }],
        [{ text: 'Call to Action', callback_data: `step_type_call_to_action_${processId}` }], // Add 'Call to Action' to the inline
        [{ text: 'Connect', callback_data: `step_type_connect_${processId}` }] // Add 'Connect' to the inline keyboard
      ]
    }
  });

  // Listen for the step type selection.
  bot.once('callback_query', async (callbackQuery) => {
    const { data, message } = callbackQuery;
    const callbackChatId = message.chat.id;
    if (callbackChatId !== chatId) return;

    console.log(`[DEBUG] Raw callback data for step type: "${data}"`);

    // Expected format: "step_type_<type>_<processId>"
    const parts = data.split('_'); // e.g., ["step", "type", "text", "process", "<processId>"]
    if (parts.length < 4) {
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'Invalid step type selection.' });
      return;
    }
    // Join parts from index 2 to second last to support step types like "generate_questions_process"
    const stepType = parts.slice(2, parts.length - 1).join('_');
    console.log(`[DEBUG] Extracted step type: "${stepType}"`);

    const allowedStepTypes = [
      'text_process',
      'yes_no_process',
      'file_process',
      'choice',
      'generate_questions_process',
      'final',
      'email_process',
      'info_process',
      'sound', // Add 'sound' to the allowed step types
      'call_to_action', // Add 'call_to_action' to the allowed step types
      'connect' // Add 'connect' to the allowed step types
    ];
    if (!allowedStepTypes.includes(stepType)) {
      console.error(`[ERROR] Invalid step type: "${stepType}"`);
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'Invalid step type selected.' });
      return;
    }
    await bot.answerCallbackQuery(callbackQuery.id, { text: `Step type "${stepType}" selected.` });

    // Step 2: Ask for the step prompt.
    await bot.sendMessage(chatId, `You selected "${stepType}". Please enter the prompt for this step:`);
    bot.once('message', async (msgPrompt) => {
      if (msgPrompt.chat.id !== chatId || !msgPrompt.text) return;
      const stepPrompt = msgPrompt.text.trim();
      console.log(`[DEBUG] Received step prompt: "${stepPrompt}" for type: "${stepType}"`);

      // Step 3: Ask for the step description.
      await bot.sendMessage(chatId, 'Please provide a description for this step:');
      bot.once('message', async (msgDesc) => {
        if (msgDesc.chat.id !== chatId || !msgDesc.text) return;
        const stepDescription = msgDesc.text.trim();
        console.log(`[DEBUG] Received step description: "${stepDescription}" for type: "${stepType}"`);

        // Step 4: If the step type is 'choice', ask for options.
        let stepOptions = [];
        if (stepType === 'choice') {
          await bot.sendMessage(chatId, 'Please provide options for this choice step, separated by spaces:');
          bot.once('message', async (msgOptions) => {
            if (msgOptions.chat.id !== chatId || !msgOptions.text) return;
            stepOptions = msgOptions.text.split(' ').map(option => option.trim());
            console.log(`[DEBUG] Received step options: "${stepOptions}" for type: "${stepType}"`);

            // Proceed to create the step with options.
            await createStep(process, stepType, stepPrompt, stepDescription, stepOptions, position, stepIndex, bot, chatId);
          });
        } else {
          // Proceed to create the step without options.
          await createStep(process, stepType, stepPrompt, stepDescription, stepOptions, position, stepIndex, bot, chatId);
        }
      });
    });
  });
};

// Helper function to create and save the step.
async function createStep(process, stepType, stepPrompt, stepDescription, stepOptions, position, stepIndex, bot, chatId) {
  const newStep = {
    stepId: `step_${Date.now()}`,
    type: stepType,
    prompt: stepPrompt,
    description: stepDescription,
    options: stepType === 'choice' ? stepOptions : undefined,
    validation: stepType === 'file_process' ? { required: false, fileTypes: [] } : { required: false },
    metadata: stepType === 'generate_questions_process' ? { numQuestions: 3 } : {},
    stepSequenceNumber: process.steps.length + 1 // Add stepSequenceNumber
  };

  try {
    if (position === 'before' && stepIndex !== null) {
      process.steps.splice(stepIndex, 0, newStep);
    } else if (position === 'after' && stepIndex !== null) {
      process.steps.splice(stepIndex + 1, 0, newStep);
    } else {
      process.steps.push(newStep);
    }
    await process.save();
    console.log(`[DEBUG] Step added to processId: "${process._id}"`);

    await bot.sendMessage(chatId, 'Step added successfully. What would you like to do next?', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Add Another Step', callback_data: `add_steps_manual_${process._id}` }],
          [{ text: 'Finish Process', callback_data: `finish_process_${process._id}` }]
        ]
      }
    });
  } catch (error) {
    console.error(`[ERROR] Failed to add step: ${error.message}`);
    await bot.sendMessage(chatId, 'An error occurred while adding the step. Please try again later.');
  }
}
