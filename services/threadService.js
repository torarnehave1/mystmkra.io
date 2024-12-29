import Thread from '../models/Thread.js';

export async function getThread(chatId) {
    const thread = await Thread.findOne({ chatId });
    return thread ? thread.messages : [];
}

export async function saveMessage(chatId, role, content) {
    const thread = await Thread.findOneAndUpdate(
        { chatId },
        { $push: { messages: { role, content } } },
        { new: true, upsert: true }
    );
    return thread.messages;
}

export async function clearThread(chatId) {
    await Thread.deleteOne({ chatId });
}
