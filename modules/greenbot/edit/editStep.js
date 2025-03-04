import Process from '../models/process.js';

export async function editProcessStep(processId, stepId, newStepData) {
  try {
    const process = await Process.findById(processId);
    if (!process) {
      throw new Error('Process not found');
    }
    const stepIndex = process.steps.findIndex(
      step => step.stepId === stepId || step._id.toString() === stepId
    );
    if (stepIndex === -1) {
      throw new Error('Step not found');
    }
    const step = process.steps[stepIndex];
    Object.keys(newStepData).forEach(key => {
      step[key] = newStepData[key];
    });
    await process.save();
    return process.steps[stepIndex];
  } catch (error) {
    throw new Error(`Failed to edit process step: ${error.message}`);
  }
}