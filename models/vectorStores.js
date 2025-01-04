import mongoose from 'mongoose';

const VectorStoreSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,

  store_id: {
    type: String,
    required: true,
    unique: true,
  },

  name: {
    type: String,
    required: true,
  },

  description: {
    type: String,
    default: null,
  },

  created_at: {
    type: Number, // Unix timestamp
    required: true,
  },

  status: {
    type: String,
    required: true,
    enum: ['active', 'inactive', 'failed', 'completed'], // Add 'completed' to the enum
    default: 'active',
  },

  status_details: {
    type: String,
    default: null,
  },

  usage_bytes: {
    type: Number,
    required: true,
  },

  file_counts: {
    in_progress: {
      type: Number,
      required: true,
    },
    completed: {
      type: Number,
      required: true,
    },
    failed: {
      type: Number,
      required: true,
    },
    cancelled: {
      type: Number,
      required: true,
    },
    total: {
      type: Number,
      required: true,
    },
  },

  metadata: {
    type: Object,
    default: {},
  },

  expires_after: {
    type: Number,
    default: null,
  },

  expires_at: {
    type: Number,
    default: null,
  },

  last_active_at: {
    type: Number,
    required: true,
  },
});

const VectorStore = mongoose.model('VectorStore', VectorStoreSchema);
export default VectorStore;
