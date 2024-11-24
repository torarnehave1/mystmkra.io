
// Create a MongoDB schema to log Telegram messages from users and groups.
// The schema should include the following fields:
// 1. `messageId`: A unique identifier for the message.
// 2. `chatId`: The ID of the chat (group or private) where the message was sent.
// 3. `chatType`: The type of chat (e.g., "private", "group", "supergroup").
// 4. `userId`: The ID of the user who sent the message.
// 5. `username`: The username of the sender (if available).
// 6. `firstName`: The first name of the sender.
// 7. `lastName`: The last name of the sender (if available).
// 8. `text`: The content of the message.
// 9. `timestamp`: The date and time the message was sent.
// 10. `isGroup`: A boolean indicating whether the message was sent in a group or not.
// Ensure the schema is flexible for future expansion (e.g., storing attachments).
// Add an index on `chatId` and `userId` for optimized queries.
// Use Mongoose for defining the schema and model.

import { Schema, model } from 'mongoose';

const telegramLogSchema = new Schema({
    messageId: { type: Number, required: true, unique: true },
    chatId: { type: Number, required: true },
    chatType: { type: String, required: true },
    userId: { type: Number, required: true },
    username: { type: String },
    firstname: { type: String, required: true },
    lastname: { type: String },
    text: { type: String, required: true },
    timestamp: { type: Date, required: true },
    isGroup: { type: Boolean, required: true },
    });

telegramLogSchema.index({ chatId: 1, userId: 1 });

const TelegramLog = model('TelegramLog', telegramLogSchema);

export default TelegramLog;
