
import Process from '../../../models/process.js';

/**
 * Moves a step up in the sequence.
 * @file services/greenbot/edit/reorderSteps.js
 * @module reorderSteps
 * @description Contains functions for reordering steps in a process.
 * @requires module:../../models/process
 * @see [Process model]{@link module:../../models/process}
 * @exports moveStepUp
  * @exports moveStepDown
  * 
 * @param {String} processId - The ID of the process.
 * @param {String} stepId - The identifier of the step to move.
 * @returns {Promise<Array>} - The updated steps array.
 */
export async function moveStepUp(processId, stepId) {
  try {
    const process = await Process.findById(processId);
    if (!process) {
      throw new Error('Process not found');
    }
    const steps = process.steps;
    const index = steps.findIndex(
      step => step.stepId === stepId || step._id.toString() === stepId
    );
    if (index === -1) {
      throw new Error('Step not found');
    }
    if (index === 0) {
      throw new Error('Step is already at the top');
    }
    // Swap the current step with the one above it
    const temp = steps[index - 1];
    steps[index - 1] = steps[index];
    steps[index] = temp;
    // Update the stepSequenceNumbers accordingly
    steps[index - 1].stepSequenceNumber = index;
    steps[index].stepSequenceNumber = index + 1;
    await process.save();
    return process.steps;
  } catch (error) {
    throw new Error(`Failed to move step up: ${error.message}`);
  }
}

/**
 * Moves a step down in the sequence.
 *
 * @param {String} processId - The ID of the process.
 * @param {String} stepId - The identifier of the step to move.
 * @returns {Promise<Array>} - The updated steps array.
 */
export async function moveStepDown(processId, stepId) {
  try {
    const process = await Process.findById(processId);
    if (!process) {
      throw new Error('Process not found');
    }
    const steps = process.steps;
    const index = steps.findIndex(
      step => step.stepId === stepId || step._id.toString() === stepId
    );
    if (index === -1) {
      throw new Error('Step not found');
    }
    if (index === steps.length - 1) {
      throw new Error('Step is already at the bottom');
    }
    // Swap the current step with the one below it
    const temp = steps[index + 1];
    steps[index + 1] = steps[index];
    steps[index] = temp;
    // Update the stepSequenceNumbers accordingly
    steps[index].stepSequenceNumber = index + 1;
    steps[index + 1].stepSequenceNumber = index + 2;
    await process.save();
    return process.steps;
  } catch (error) {
    throw new Error(`Failed to move step down: ${error.message}`);
  }
}
