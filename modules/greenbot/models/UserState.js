import mongoose from 'mongoose';

const UserStateSchema = new mongoose.Schema({
  userId: {
    type: Number,
    required: true,
    unique: true, // Ensure one state per user
  },
  processId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Process', // Reference to the Process model
    default: null, // Optional initially
  },
  currentStepIndex: {
    type: Number,
    default: 0, // Default to the first step
  },
  isProcessingStep: {
    type: Boolean,
    default: false, // Used to prevent duplicate step handling
  },
  answers: [
    {
      stepIndex: {
        type: Number,
        required: true,
      },
      answer: {
        type: String,
        required: true,
      },
    },
  ],
  systemLanguage: {
    type: String,
    enum: ['EN', 'NO'], // Languages available
    default: 'EN', // Default to English
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const UserState = mongoose.model('UserState', UserStateSchema);

export default UserState;
