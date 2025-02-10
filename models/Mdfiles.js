import mongoose from 'mongoose';

const MdFilesSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  
  title: {
  type: String,
  required: false
  },
  content: {
  type: String,
  required: true
  },

  URL: {
  type: String,
  required: false
  },

  User_id:{
  type: mongoose.Schema.Types.ObjectId,
  ref: 'User',
  required: true
  },

  locked: {
  type: Boolean,
  default: false
  },
  author: {
  type: String,
  required: false
  },
  createdAt: {
  type: Date,
  default: Date.now
  },

  updatedAt: {
  type: Date,
  default: Date.now
  },

  publishedAt: {
  type: Date,
  default: Date.now
  },

  published: {
  type: Boolean,
  default: false
  },

  ImgURL:{
  type: String,
  required: false
  },

  embeddings: {
  type: [Number], // Array of numbers for embeddings
  required: false,
  default: [] // Default to an empty array
  },

  part: {
  type: Number,
  default: 1
  },
  totalParts: {
  type: Number,
  default: 1
  },
  documentId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'MdFiles'
  },

  connectedAssistant: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Assistant',
  required: false,
  default: null
  },

  tags: {
    type: [String],
    default: []
  }

});

const MdFiles = mongoose.model('MdFiles', MdFilesSchema);
export default MdFiles;