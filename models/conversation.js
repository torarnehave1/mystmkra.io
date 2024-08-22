import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema({
  Name: {
    type: String,
    required: true
  },
  note: [{
    userId: {
      type: String,
      required: true
    },
    text: {
      type: String,
      required: true
    },
    sender: {
      type: String,
      required: false
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
  conversation_quality: { 
    type: Number, 
    required: true 
},
  mentor: {
     type: String,
      required: true 
    },
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Conversation = mongoose.model('Conversation', conversationSchema);

export default Conversation;