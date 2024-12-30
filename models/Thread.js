import mongoose from 'mongoose';

const threadSchema = new mongoose.Schema({
    chatId: { type: String, required: true },
    userName: { type: String, required: true }, // Added userName field
    botName: { type: String, required: true },  // Added botName field
    messages: [
        {
            role: { type: String, required: true },
            content: { type: String, required: true },
        },
    ],
}, { timestamps: true });

const Thread = mongoose.model('Thread', threadSchema);

export default Thread;
