import mongoose from 'mongoose';

const { Schema } = mongoose;

const userStateSchema = new Schema({
  userId: { type: String, required: true, unique: true },
  currentStepIndex: { type: Number, default: 0 },
  processId: { type: String }, // Active process
  systemLanguage: { type: String, enum: ['EN', 'NO'], default: 'EN' },
  responses: [{ stepId: String, value: Schema.Types.Mixed }], // User inputs
  generatedQuestions: [{ text: String, confirmed: { type: Boolean, default: false } }], // Suggested questions
  conversationHistory: [
    {
      role: { type: String, enum: ['system', 'user', 'assistant'], required: true },
      content: { type: String, required: true },
    },
  ], // Chat history
});

const UserState = mongoose.model('UserState', userStateSchema);

export default UserState;
