// File: services/greenbot/edit/editStep.js
import Process from '../../../models/process.js';

/**
 * Updates a specific step in a process.
 *
 * @param {String} processId - The ID of the process.
 * @param {String} stepId - The unique identifier of the step (either stepId or Mongo _id).
 * @param {Object} newStepData - An object containing updated fields (e.g., prompt, description, options, validation).
 * @returns {Promise<Object>} - The updated step object.
 */
export async function editProcessStep(processId, stepId, newStepData) {
  try {
    const process = await Process.findById(processId);
    if (!process) {
      throw new Error('Process not found');
    }
    // Locate the step by its stepId or _id (converted to string)
    const stepIndex = process.steps.findIndex(
      step => step.stepId === stepId || step._id.toString() === stepId
    );
    if (stepIndex === -1) {
      throw new Error('Step not found');
    }
    const step = process.steps[stepIndex];
    // Update each provided field
    Object.keys(newStepData).forEach(key => {
      step[key] = newStepData[key];
    });
    await process.save();
    return process.steps[stepIndex];
  } catch (error) {
    throw new Error(`Failed to edit process step: ${error.message}`);
  }
}
