// Create a function named `logMessage` to log a Telegram message to a MongoDB database.
// Import the `TelegramLog` model from '../models/telegramLog.js'.
// The function should take a single parameter, `message`, which is the Telegram message object.
// Destructure the following fields from the `message` object:
// - `message_id` as `messageId`
// - `chat.id` as `chatId`
// - `chat.type` as `chatType`
// - `from.id` as `userId`
// - `from.username` as `username`
// - `from.first_name` as `firstName`
// - `from.last_name` as `lastName`
// - `text`
// - `date`
// Determine if the message is from a group by checking if `chatType` is either "group" or "supergroup".
// Create a new instance of the `TelegramLog` model with the extracted fields and convert the `date` to a JavaScript `Date` object (convert seconds to milliseconds).
// Save the log entry to the database using `logEntry.save()`.
// Log a success message to the console when the message is logged successfully.
// Catch and log any errors during the logging process.

// Solution
// services/logMessage.js
import TelegramLog from '../models/telegramlog.js';

const logMessage = async (message, isOutgoing = false) => {
    try {
        const {
            message_id: messageId,
            chat: { id: chatId, type: chatType },
            from: { id: userId, username, first_name: firstName, last_name: lastName } = {},
            text,
            date
        } = message;

        const isGroup = chatType === 'group' || chatType === 'supergroup';
        const command = text && text.startsWith('/') ? text.split(' ')[0] : null;

        const logEntry = {
            messageId,
            chatId,
            chatType,
            userId,
            username,
            firstName,
            lastName,
            text,
            command,
            timestamp: date ? new Date(date * 1000) : new Date(),
            isGroup,
            isOutgoing,
        };

        await TelegramLog.findOneAndUpdate(
            { messageId },
            { $set: logEntry },
            { upsert: true, new: true }
        );

        console.log(`${isOutgoing ? 'Outgoing' : 'Incoming'} message logged successfully.`);
    } catch (error) {
        console.error('Error logging message:', error);
    }
};



export default logMessage;