import mongoose from 'mongoose';

const vectorStoreFileSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,

  vector_store_id: {
    type: String, // Change to String type
    ref: 'VectorStore', // References the VectorStore schema
    required: true,
  },

  file_id: {
    type: String, // Change to String type
    ref: 'File', // References the File schema
    required: true,
  },

  added_at: {
    type: Date,
    default: Date.now,
  },
});

const VectorStoreFile = mongoose.model('VectorStoreFile', vectorStoreFileSchema);
export default VectorStoreFile;
