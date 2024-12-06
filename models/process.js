import mongoose from 'mongoose';

const { Schema } = mongoose;

// Step Schema: Defines each step in a process
const stepSchema = new Schema({
  stepId: { type: String, required: true }, // Unique identifier for the step
  type: {
    type: String,
    enum: ['text_process', 'yes_no_process', 'file_process', 'choice', 'generate_questions_process', 'final'],
    required: true,
  }, // Type of step
  prompt: { type: String, required: true }, // Question or instruction text for the user
  options: [String], // Options for 'choice' steps
  validation: {
    required: { type: Boolean, default: false }, // Whether the step is mandatory
    regex: String, // Validation for text input (e.g., email format)
    fileTypes: [String], // Allowed file types for 'file' steps (e.g., ['image/jpeg', 'application/pdf'])
  },
  metadata: {
    numQuestions: { type: Number, default: 3 }, // Specific to 'generate_questions', number of questions to generate
  },
});

// Process Schema: Defines the overall workflow
const processSchema = new Schema({
  title: { type: String, required: true }, // Title of the process
  description: { type: String }, // Optional description for the process
  steps: [stepSchema], // Array of steps in the process
  createdBy: { type: String }, // User or system that created the process
  createdAt: { type: Date, default: Date.now }, // Timestamp for process creation
  isFinished: { type: Boolean, default: false }, // Indicates if the process is finished
});

const processes = mongoose.model('process', processSchema);

export default processes;