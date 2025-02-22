// File: answerService.js

import ProcessAnswers from '../../models/ProcessAnswers.js';
import UserState from '../../models/UserState.js';

/**
 * saveAnswer
 *
 * Saves the user's answer for the current step and updates the process progress.
 *
 * This function performs the following:
 *   1. Ensures the UserState exists for the given chatId.
 *   2. Saves (or updates) the answer in the UserState (if the step type is not 'info_process').
 *   3. Upserts the answer in the ProcessAnswers collection.
 *   4. Increments the currentStepIndex in the UserState.
 *
 * Parameters:
 *   bot         - The Telegram bot instance.
 *   chatId      - The Telegram chat ID.
 *   processId   - The ID of the process the user is working on.
 *   stepIndex   - The index of the step being answered.
 *   answer      - The user's answer (text, file name, or selected choices).
 *   stepType    - The type of the step (e.g., 'text_process', 'file_process', 'choice', etc.).
 *   stepPrompt  - The prompt text for the step.
 *   stepDescription - The description text for the step.
 *
 * Returns:
 *   The updated UserState document.
 */
export async function saveAnswer({ bot, chatId, processId, stepIndex, answer, stepType, stepPrompt, stepDescription }) {
  const debugPrefix = '[DEBUG answerService saveAnswer]';
  try {
    // Retrieve or create UserState for the user.
    let userState = await UserState.findOne({ userId: chatId });
    if (!userState) {
      console.log(`${debugPrefix} Creating new UserState for user ${chatId}`);
      userState = new UserState({
        userId: chatId,
        processId,
        currentStepIndex: 0,
        answers: [],
        isProcessingStep: false,
      });
    }
    
    // Save the answer in UserState for non-info_process steps.
    if (stepType !== 'info_process' && answer != null) {
      if (!userState.answers) {
        userState.answers = [];
      }
      const existingIndex = userState.answers.findIndex(a => a.stepIndex === stepIndex);
      if (existingIndex !== -1) {
        userState.answers[existingIndex].answer = answer;
      } else {
        userState.answers.push({ stepIndex, answer });
      }
    }
    await userState.save();
    
    // Upsert the answer in the ProcessAnswers collection.
    let processAnswers = await ProcessAnswers.findOne({ userId: chatId, processId });
    if (!processAnswers) {
      processAnswers = new ProcessAnswers({
        userId: chatId,
        processId,
        answers: []
      });
    }
    
    const answerData = {
      stepIndex,
      stepPrompt: stepPrompt || '',
      stepDescription: stepDescription || '',
      answer,
    };
    
    const existingAnswerIndex = processAnswers.answers.findIndex(a => a.stepIndex === stepIndex);
    if (existingAnswerIndex !== -1) {
      processAnswers.answers[existingAnswerIndex] = answerData;
    } else if (stepType !== 'info_process') {
      processAnswers.answers.push(answerData);
    }
    await processAnswers.save();
    console.log(`${debugPrefix} Answer saved for step ${stepIndex}`);
    
    // Increment the step index in UserState.
    userState.currentStepIndex = stepIndex + 1;
    await userState.save();
    console.log(`${debugPrefix} UserState updated: currentStepIndex is now ${userState.currentStepIndex}`);
    
    return userState;
  } catch (error) {
    console.error(`${debugPrefix} ERROR: ${error.message}`);
    await bot.sendMessage(chatId, 'An error occurred while saving your answer. Please try again.');
    throw error;
  }
}
