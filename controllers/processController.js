import processes from '../models/process.js';

// ...existing code...

// Function to get the next step
export const getNextStep = (processId, currentStepSequenceNumber) => {
  return processes.findOne({ _id: processId })
    .then(process => {
      const nextStep = process.steps.find(step => step.stepSequenceNumber === currentStepSequenceNumber + 1);
      return nextStep;
    });
};

// Function to get the previous step
export const getPreviousStep = (processId, currentStepSequenceNumber) => {
  return processes.findOne({ _id: processId })
    .then(process => {
      const previousStep = process.steps.find(step => step.stepSequenceNumber === currentStepSequenceNumber - 1);
      return previousStep;
    });
};

// ...existing code...
