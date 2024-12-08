import mongoose from 'mongoose';

const ProcessAnswersSchema = new mongoose.Schema({
  userId: {
    type: Number,
    required: true,
  },
  processId: {
    type: mongoose.Schema.Types.ObjectId, // Use ObjectId type
    required: true,
    ref: 'Process', // Reference to the Process model
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
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const ProcessAnswers = mongoose.model('ProcessAnswers', ProcessAnswersSchema);

export default ProcessAnswers;
