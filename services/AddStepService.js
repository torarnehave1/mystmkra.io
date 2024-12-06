import Process from '../models/process.js';

export const handleAddStep = async (bot, chatId, processId) => {
  console.log(`[DEBUG] Adding step to processId: "${processId}" for chatId: ${chatId}`);

  await bot.sendMessage(chatId, 'Please select the step type:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Text Input', callback_data: `step_type_text_process_${processId}` }],
        [{ text: 'Yes/No', callback_data: `step_type_yes_no_process_${processId}` }],
        [{ text: 'File Upload', callback_data: `step_type_file_process_${processId}` }],
        [{ text: 'Choice', callback_data: `step_type_choice_${processId}` }],
        [{ text: 'Generate Questions', callback_data: `step_type_generate_questions_process_${processId}` }],
        [{ text: 'Final Step', callback_data: `step_type_final_${processId}` }],
      ],
    },
  });

  bot.once('callback_query', async (callbackQuery) => {
    const { data } = callbackQuery;

    console.log(`[DEBUG] Raw callback data: "${data}"`);

    // Correct step type extraction
    const stepType = data.replace(/^step_type_/, '').replace(`_${processId}`, '');

    console.log(`[DEBUG] Extracted step type: "${stepType}"`);

    // Validate the extracted step type
    const allowedStepTypes = [
      'text_process',
      'yes_no_process',
      'file_process',
      'choice',
      'generate_questions_process',
      'final',
    ];

    if (!allowedStepTypes.includes(stepType)) {
      console.error(
        `[ERROR] Invalid step type: "${stepType}". Allowed types are: ${allowedStepTypes.join(', ')}.`
      );
      await bot.sendMessage(chatId, `Invalid step type: "${stepType}". Please try again.`);
      return;
    }

    console.log(`[DEBUG] Step type "${stepType}" is valid.`);

    // Prompt user for the details of the step
    await bot.sendMessage(chatId, `You selected the step type: "${stepType}". Please provide the details for this step.`);

    bot.once('message', async (msg) => {
      const stepPrompt = msg.text;
      console.log(`[DEBUG] Received step prompt: "${stepPrompt}" for step type: "${stepType}" and processId: "${processId}"`);

      const newStep = {
        stepId: `step_${Date.now()}`,
        type: stepType,
        prompt: stepPrompt,
        options: stepType === 'choice' ? [] : undefined, // Add options array for 'choice' type
        validation: {
          required: false,
          fileTypes: stepType === 'file_process' ? [] : undefined, // Add fileTypes array for 'file_process' type
        },
        metadata: {
          numQuestions: stepType === 'generate_questions_process' ? 3 : undefined, // Metadata for 'generate_questions_process' type
        },
      };

      try {
        const process = await Process.findById(processId);
        if (!process) {
          console.error(`[ERROR] Process not found for processId: "${processId}"`);
          await bot.sendMessage(chatId, 'The process could not be found. Please try again.');
          return;
        }

        process.steps.push(newStep);
        await process.save();
        console.log(`[DEBUG] Step added to processId: "${processId}"`);

        await bot.sendMessage(chatId, 'Step added successfully. What would you like to do next?', {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Add Another Step', callback_data: `add_step_${processId}` }],
              [{ text: 'Finish Process', callback_data: `finish_process_${processId}` }],
            ],
          },
        });
      } catch (error) {
        console.error(`[ERROR] Failed to add step to process: ${error.message}`);
        await bot.sendMessage(chatId, 'An error occurred while adding the step. Please try again later.');
      }
    });
  });
};
