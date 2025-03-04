import dotenv from 'dotenv';
import Process from '../greenbot/models/process.js';
import handleChoiceStep from './steps/choiceProcess.js'; // Dedicated module for 'choice' steps
import handleFileProcessStep from './steps/fileProcess.js'; // Dedicated module for 'file_process' steps
import handleTextProcessStep from './steps/textProcess.js'; // Dedicated module for 'text_process' steps
import handleYesNoProcessStep from './steps/yesNoProcess.js'; // Dedicated module for 'yes_no_process' steps
import handleSoundProcessStep from './steps/soundProcess.js'; // Dedicated module for 'sound' steps
import handleInfoProcessStep from './steps/infoProcess.js'; // Dedicated module for 'info_process' steps
import handleCallToActionProcessStep from './steps/callToActionProcess.js'; // Dedicated module for 'call_to_action' steps
import handleConnectProcessStep from './steps/connectProcess.js'; // Import the new connect step handler

dotenv.config();

/**
 * Module: processNavigator.js
 *
 * This module provides functions to navigate through a process step-by-step.
 * It uses the UserState to track progress and the Process model to fetch the process document.
 * The function showCurrentStep dispatches step presentation based on the step type.
 *
 * Functions:
 *  - goToFirstStep(bot, chatId, userState)
 *  - showCurrentStep(bot, chatId, userState)
 *  - handleNextStep(bot, chatId, userState)
 *  - handlePreviousStep(bot, chatId, userState)
 *  - updateUserState(userState)
 */

export async function goToFirstStep(bot, chatId, userState) {
  const debugPrefix = '[DEBUG processNavigator goToFirstStep]';
  console.log(`${debugPrefix} Starting goToFirstStep with userState:`, userState.processId);
  if (!userState.processId) {
    console.error(`${debugPrefix} ERROR: processId not set in UserState.`);
    await bot.sendMessage(chatId, "Process not set. Please start a process.");
    return;
  }
  // Set internal index to 0 (first step).
  userState.currentStepIndex = 0;
  await updateUserState(userState, debugPrefix);
  console.log(`${debugPrefix} Set currentStepIndex to 0 (first step).`);
  await showCurrentStep(bot, chatId, userState);
}

export async function showCurrentStep(bot, chatId, userState) {
  const debugPrefix = '[DEBUG processNavigator showCurrentStep X]';
  
  //Console log the userState.stepIndex and the userState.processId
 // console.log(`${debugPrefix} userState.stepIndex: ${userState.currentStepIndex}`);

  //console.log(`${debugPrefix} Starting showCurrentStep with userState:`, userState);
  
  
  
  if (!userState || !userState.processId) {
    console.error(`${debugPrefix} ERROR: UserState is missing or processId not set.`);
    await bot.sendMessage(chatId, "Process not set. Please start a process.");
    return;
  }
  let process;
  try {
    process = await Process.findById(userState.processId);
    console.log(`${debugPrefix} Fetched process:`, process);
  } catch (error) {
    console.error(`${debugPrefix} ERROR: Failed to fetch process: ${error.message}`);
    await bot.sendMessage(chatId, "Error fetching process.");
    return;
  }
  if (!process) {
    console.error(`${debugPrefix} ERROR: Process not found for ID: ${userState.processId}`);
    await bot.sendMessage(chatId, "Process not found.");
    return;
  }
  // Sort steps by stepSequenceNumber.
  const sortedSteps = process.steps.sort((a, b) => a.stepSequenceNumber - b.stepSequenceNumber);
  console.log(`${debugPrefix} Sorted steps:`, sortedSteps);
  const currentIndex = userState.currentStepIndex;
  if (currentIndex < 0 || currentIndex >= sortedSteps.length) {
    console.error(`${debugPrefix} ERROR: currentStepIndex (${currentIndex}) is out of bounds.`);
    await bot.sendMessage(chatId, "Invalid step index.");
    return;
  }
  const step = sortedSteps[currentIndex];
  console.log(`${debugPrefix} Displaying step ${step.stepSequenceNumber}: ${step.prompt}`);

  // Dispatch presentation based on step type.

  // Add a case for each step type that requires special handling.

  switch (step.type) {
    case 'choice':
      console.log(`${debugPrefix} Handling 'choice' step.`);
      await handleChoiceStep(bot, chatId, userState, step);
      break;
    case 'file_process':
      console.log(`${debugPrefix} Handling 'file_process' step.`);
      await handleFileProcessStep(bot, chatId, userState, step);
      break;
    case 'text_process':
      console.log(`${debugPrefix} Handling 'text_process' step.`);
      await handleTextProcessStep(bot, chatId, userState, step);
      break;
    case 'sound':
      console.log(`${debugPrefix} Handling 'sound' step.`);
      await handleSoundProcessStep(bot, chatId, userState, step);
      break;
    case 'yes_no_process':
      console.log(`${debugPrefix} Handling 'yes_no_process' step.`);
      await handleYesNoProcessStep(bot, chatId, userState, step);
      break;
    case 'info_process':
      console.log(`${debugPrefix} Handling 'info_process' step.`);
      await handleInfoProcessStep(bot, chatId, userState, step);
      break;
    case 'call_to_action':
      console.log(`${debugPrefix} Handling 'call_to_action' step.`);
      await handleCallToActionProcessStep(bot, chatId, userState, step);
      break;
    case 'connect':
      console.log(`${debugPrefix} Handling 'connect' step.`);
      await handleConnectProcessStep(bot, chatId, userState, step);
      break;
    case 'final': 
      console.log(`${debugPrefix} Handling 'final' step.`);
      await defaultStepPresentation(bot, chatId, userState, step);
      break;
    default:
      console.log(`${debugPrefix} Handling default step.`);
      await defaultStepPresentation(bot, chatId, userState, step);
      break;
  }
}

export async function handleNextStep(bot, chatId, userState) {
  const debugPrefix = '[DEBUG processNavigator handleNextStep]';
  console.log(`${debugPrefix} Starting handleNextStep with userState:`, userState.processId);
  let process;
  try {
    process = await Process.findById(userState.processId);
    console.log(`${debugPrefix} Fetched process:`, process);
  } catch (error) {
    console.error(`${debugPrefix} ERROR: Failed to fetch process: ${error.message}`);
    await bot.sendMessage(chatId, "Error fetching process.");
    return;
  }
  if (!process) {
    console.error(`${debugPrefix} ERROR: Process not found.`);
    await bot.sendMessage(chatId, "Process not found.");
    return;
  }
  const sortedSteps = process.steps.sort((a, b) => a.stepSequenceNumber - b.stepSequenceNumber);
  console.log(`${debugPrefix} Sorted steps:`, sortedSteps);
  console.log(`${debugPrefix} Current step index: ${userState.currentStepIndex}`);
  if (userState.currentStepIndex >= sortedSteps.length - 1) {
    console.log(`${debugPrefix} Already at final step.`);
    await bot.sendMessage(chatId, "You are already at the final step.");
    return;
  }
  // Ensure the step index is incremented correctly
  const nextStepIndex = userState.currentStepIndex + 1;
  if (nextStepIndex < sortedSteps.length && sortedSteps[nextStepIndex].stepSequenceNumber === sortedSteps[userState.currentStepIndex].stepSequenceNumber + 1) {
    userState.currentStepIndex = nextStepIndex;
  } else {
    console.error(`${debugPrefix} ERROR: Invalid step sequence.`);
    await bot.sendMessage(chatId, "Invalid step sequence.");
    return;
  }
  await updateUserState(userState, debugPrefix);
  console.log(`${debugPrefix} Moved to next step, index: ${userState.currentStepIndex}`);
  await showCurrentStep(bot, chatId, userState);
}

export async function handlePreviousStep(bot, chatId, userState) {
  const debugPrefix = '[DEBUG processNavigator handlePreviousStep]';
  console.log(`${debugPrefix} Starting handlePreviousStep with userState:`, userState);
  if (userState.currentStepIndex <= 0) {
    console.log(`${debugPrefix} Already at the first step.`);
    await bot.sendMessage(chatId, "You are at the first step, cannot go back further.");
    return;
  }
  userState.currentStepIndex--;
  await updateUserState(userState, debugPrefix);
  console.log(`${debugPrefix} Moved to previous step, index: ${userState.currentStepIndex}`);
  await showCurrentStep(bot, chatId, userState);
}

/**
 * Helper function to persist the updated UserState.
 */
async function updateUserState(userState, debugPrefix = '[DEBUG processNavigator updateUserState]') {
 // console.log(`${debugPrefix} Updating userState:`, userState);
  try {
    await userState.save();
    console.log(`${debugPrefix} UserState updated successfully.`);
  } catch (error) {
    console.error(`${debugPrefix} ERROR: Failed to update UserState: ${error.message}`);
  }
}

/**
 * Default presentation for step types that do not have a dedicated handler.
 */
async function defaultStepPresentation(bot, chatId, userState, step) {
  const debugPrefix = '[DEBUG processNavigator defaultStepPresentation]';
  console.log(`${debugPrefix} Default presentation for step:`, step);
  let caption = `<b>Step ${step.stepSequenceNumber}:</b> ${step.prompt}`;
  if (step.description) {
    caption += `\n\n<i>${step.description}</i>`;
  }
  const inlineKeyboard = { inline_keyboard: [] };
  const navRow = [];
  if (userState.currentStepIndex > 0) {
    navRow.push({ text: "Previous", callback_data: "previous_step" });
  }
  if (step.type === 'final') {
    navRow.push({ text: "Exit", callback_data: "/reset" });
  } else {
    navRow.push({ text: "Next", callback_data: "next_step" });
  }
  inlineKeyboard.inline_keyboard.push(navRow);
  console.log(`${debugPrefix} Sending step with caption: ${caption}`);
  await bot.sendMessage(chatId, caption, {
    parse_mode: "HTML",
    reply_markup: inlineKeyboard,
  });
}
