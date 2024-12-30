import mongoose from 'mongoose';

const { Schema } = mongoose;

const markdownFileSchema = new Schema({
    chatId: {
        type: String,
        required: true,
    },
    content: {
        type: String,
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

const MarkdownFile = mongoose.model('MarkdownFile', markdownFileSchema);

export default MarkdownFile;
