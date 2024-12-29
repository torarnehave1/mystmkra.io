import mongoose from 'mongoose';

const threadSchema = new mongoose.Schema({
    chatId: { type: String, required: true },
    messages: [
        {
            role: { type: String, required: true },
            content: { type: String, required: true },
        },
    ],
}, { timestamps: true });

const Thread = mongoose.model('Thread', threadSchema);

export default Thread;
