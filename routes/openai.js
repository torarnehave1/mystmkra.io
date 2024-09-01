import { Router } from 'express';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import multer from 'multer';
import util from 'util';


import FormData from 'form-data';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import axios from 'axios';
import sharp from 'sharp';

import config from '../config/config.js';

console.log(`The application is running in ${config.NODE_ENV} mode.`);
console.log(`The base URL is ${config.BASE_URL}`);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const router = Router();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Test endpoint to verify OpenAI connection
router.post('/ask', async (req, res) => {
    const { question } = req.body;

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: "You will answer back in a professional way with markdown format and titles where it is appropriate" },
                { role: "user", content: question },
            ],
        });

        res.json({ response: completion.choices[0].message.content });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to get response from OpenAI' });
    }
});

// Refactored translate-audio endpoint
const upload = multer({ storage: multer.memoryStorage() });

router.post('/translate-audio', upload.single('file'), async (req, res) => {
    try {
        const file = req.file;
        const language = 'en'   // Get the language from the request body if provided

        if (!file) {
            console.error('File not provided');
            return res.status(400).json({ error: 'File is required' });
        }

        const formData = new FormData();
        formData.append('file', file.buffer, file.originalname);
        formData.append('model', 'whisper-1');

        if (language) {
            formData.append('language', language);  // Include language in the request if provided
        }

        const response = await axios.post('https://api.openai.com/v1/audio/translations', formData, {
            headers: {
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                ...formData.getHeaders(),
            },
        });

        res.json(response.data);  // Send the full response back to the client
    } catch (error) {
        console.error('Error translating audio:', error.message || error);
        if (error.response) {
            console.error('Response data:', error.response.data);  // Log the error data
            console.error('Response status:', error.response.status);
            console.error('Response headers:', error.response.headers);
        } else if (error.request) {
            console.error('Request data:', error.request);
        }
        res.status(500).json({ error: 'Failed to translate audio' });
    }
});

router.post('/process-text', async (req, res) => {
    const { operation, prompt } = req.body;

    const systemMessages = {
        'answer-question': "You will answer back in a professional way with markdown format and titles where it is appropriate.",
        'spellcheck-rewrite': "You will spellcheck and rewrite the following text, keeping it as close to the original as possible , keep the original language while fixing any grammatical or typographical errors. You will answer back in a professional way with markdown format and titles where it is appropriate. If the main title of the text is missing, come up with your own suggestion on a title based on the text content. Create an abstract as a intro chapter.",
        'generate-image-prompt': "You are an AI that generates creative and descriptive prompts for generating images based on provided text content. Please generate an image prompt that best represents the key themes or scenes from the following content."
    };

    if (!systemMessages[operation]) {
        return res.status(400).json({ error: 'Invalid operation type' });
    }

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: systemMessages[operation] },
                { role: "user", content: prompt },
            ],
        });

        const responseText = completion.choices[0].message.content;

        const responseKey = operation === 'spellcheck-rewrite' ? 'rewrittenText' :
                            operation === 'generate-image-prompt' ? 'prompt' :
                            'response';

        res.json({ [responseKey]: responseText });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to get response from OpenAI' });
    }
});

router.post('/create-image', async (req, res) => {
    const { prompt } = req.body;

    try {
        const response = await openai.images.generate({
            model: "dall-e-3",
            prompt: prompt,
            n: 1,
            size: "1792x1024"
        });

        if (!response || !response.data || !response.data[0] || !response.data[0].url) {
            throw new Error('Invalid response from OpenAI API');
        }

        const imageUrl = response.data[0].url;
        const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const imageBuffer = Buffer.from(imageResponse.data, 'binary');

        const croppedImageBuffer = await sharp(imageBuffer)
            .resize(1024, 341)
            .toBuffer();

        const timestamp = Date.now();
        const imageFilePath = path.join(__dirname, '..', '/public/images', `image_${timestamp}.png`);
        const imageUrlRelative = `/images/image_${timestamp}.png`;
        const ReturnimageUrl = `${config.BASE_URL}${imageUrlRelative}`;

        fs.writeFileSync(imageFilePath, croppedImageBuffer);

        res.json({ message: 'Image saved successfully', imageFilePath, ReturnimageUrl });
    } catch (error) {
        console.error('Error creating image:', error.message || error);
        res.status(500).json({ error: 'Failed to create image' });
    }
});

router.get('/createimage', async (req, res) => {
    const prompt = req.query.prompt;

    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    try {
        const response = await openai.images.generate({
            model: "dall-e-2",
            prompt: prompt,
            n: 1,
            size: "1024x1024"
        });

        const imageUrl = response.data[0].url;
        const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const imageBuffer = Buffer.from(imageResponse.data, 'binary');

        const croppedImageBuffer = await sharp(imageBuffer)
            .resize(1024, 341)
            .toBuffer();

        const timestamp = Date.now();
        const imageFilePath = path.join(__dirname, '..', '/public/images', `image_${timestamp}.png`);

        fs.writeFileSync(imageFilePath, croppedImageBuffer);

        res.json({ message: 'Image saved successfully', imageFilePath, imageUrl });
    } catch (error) {
        console.error('Error creating image:', error);
        res.status(500).json({ error: 'Failed to create image' });
    }
});

export default router;
