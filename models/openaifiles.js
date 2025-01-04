import mongoose from 'mongoose';

const OpenaifileSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,

  file_id: {
    type: String,
    required: true,
    unique: true,
  },

  filename: {
    type: String,
    required: true,
  },

  purpose: {
    type: String,
    required: true,
    enum: ['assistants', 'fine-tune', 'file_search'], // Common purposes
  },

  bytes: {
    type: Number,
    required: true,
  },

  created_at: {
    type: Number, // Unix timestamp
    required: true,
  },

  status: {
    type: String,
    required: true,
    enum: ['processed', 'in_progress', 'failed'],
    default: 'in_progress',
  },

  status_details: {
    type: String,
    default: null,
  },
});

const OpenaiFile = mongoose.model('File', OpenaifileSchema);
export default OpenaiFile;
