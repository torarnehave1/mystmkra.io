
import mongoose from 'mongoose';

const ProcessAnswersSchema = new mongoose.Schema({
  userId: {
    type: Number,
    required: true,
  },
  processId: {
    type: String,
    required: true,
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
});

const ProcessAnswers = mongoose.model('ProcessAnswers', ProcessAnswersSchema);

export default ProcessAnswers;