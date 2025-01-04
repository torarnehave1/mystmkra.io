import mongoose from 'mongoose';

const assistantSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,

  id: {
    type: String,
    required: true,
    unique: true, // Ensures IDs are unique
  },

  object: {
    type: String,
    default: 'assistant', // Always "assistant"
    required: true,
  },

  created_at: {
    type: Number, // Unix timestamp in seconds
    required: true,
  },

  name: {
    type: String,
    maxlength: 256,
    default: null, // Null if not provided
  },

  description: {
    type: String,
    maxlength: 512,
    default: null, // Null if not provided
  },

  model: {
    type: String,
    required: true, // Must reference a valid model ID
  },

  instructions: {
    type: String,
    maxlength: 256000,
    default: null, // Null if not provided
  },

  tools: {
    type: [
      {
        type: String,
        enum: ['code_interpreter', 'file_search', 'function'], // Allowed types
      },
    ],
    validate: {
      validator: (tools) => tools.length <= 128, // Max 128 tools
      message: 'Exceeds maximum of 128 tools',
    },
  },

  tool_resources: {
    type: Map,
    of: Array, // Tool-specific resources (e.g., file IDs or vector store IDs)
    default: null,
  },

  metadata: {
    type: Map,
    of: String,
    validate: {
      validator: (metadata) => metadata.size <= 16, // Max 16 key-value pairs
      message: 'Metadata exceeds maximum key-value pair count of 16',
    },
  },

  temperature: {
    type: Number,
    min: 0,
    max: 2,
    default: null,
  },

  top_p: {
    type: Number,
    min: 0,
    max: 1,
    default: null,
  },

  response_format: {
    type: mongoose.Schema.Types.Mixed, // Allows flexibility for auto or object
    default: 'auto',
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },

  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

const Assistant = mongoose.model('Assistant', assistantSchema);
export default Assistant;
