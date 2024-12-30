import mongoose from 'mongoose';
import dotenv from 'dotenv';
import MarkdownFile from '../models/MarkdownFile.js';

// Load environment variables from .env file
dotenv.config();

// const uri = process.env.MONGODB_URI;
// mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function saveMarkdownFile(chatId, content) {
    const markdownFile = new MarkdownFile({ chatId, content });
    await markdownFile.save();
}

async function getMarkdownFileContent(chatId) {
    const document = await MarkdownFile.findOne({ chatId }).sort({ createdAt: -1 }).exec();
    return document ? document.content : null;
}

export { saveMarkdownFile, getMarkdownFileContent };
