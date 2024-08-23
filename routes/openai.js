import { Router } from 'express';
import OpenAI from 'openai';
import dotenv from 'dotenv';

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

//write a test end point to see if I can connect to openai


router.get('/test', async (req, res) => {

    try {

        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                { role: "system", content: "You are a helpful assistant." },
                { role: "user", content: "Who won the world series in 2020?" },
            ],
        });

        res.json({ response: completion.choices[0].message.content });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to get response from OpenAI' });
    }

});




// Define the route for handling OpenAI requests
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


router.post('/process-text', async (req, res) => {
    const { operation, prompt } = req.body;

    try {
        let systemMessage = "";
        let userMessage = prompt;

        // Determine the type of operation
        if (operation === 'answer-question') {
            systemMessage = "You will answer back in a professional way with markdown format and titles where it is appropriate";
        } else if (operation === 'spellcheck-rewrite') {
            systemMessage = "You will spellcheck and rewrite the following text, keeping it as close to the original as possible while fixing any grammatical or typographical errors.";
        } else {
            return res.status(400).json({ error: 'Invalid operation type' });
        }

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: systemMessage },
                { role: "user", content: userMessage },
            ],
        });

        const responseText = completion.choices[0].message.content;

        if (operation === 'answer-question') {
            res.json({ response: responseText });
        } else if (operation === 'spellcheck-rewrite') {
            res.json({ rewrittenText: responseText });
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to get response from OpenAI' });
    }
});





router.post('/create-image', async (req, res) => {
    const { prompt } = req.body;

    try {
        const response = await openai.images.generate({  // Ensure 'generate' is correct for your SDK
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

        // Process the image to crop to 1024x341
        const croppedImageBuffer = await sharp(imageBuffer)
            .resize(1024, 341)  // Resize to 1024x341
            .toBuffer();

        const timestamp = Date.now();
        const imageFilePath = path.join(__dirname,'..', '/public/images', `image_${timestamp}.png`);
        console.log(imageFilePath);

        const imageUrlRelative = `/images/image_${timestamp}.png`;
        const ReturnimageUrl = `${config.BASE_URL}${imageUrlRelative}`;

        fs.writeFileSync(imageFilePath, croppedImageBuffer);

        res.json({ message: 'Image saved successfully', imageFilePath, ReturnimageUrl });


        //res.json({ imageUrl });
    } catch (error) {
        console.error('Error creating image:', error.message || error);
        res.status(500).json({ error: 'Failed to create image' });
    }
});




router.get('/createimage', async (req, res) => {
    const prompt = req.query.prompt;  // Get the prompt from the query parameters

    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    try {
        const response = await openai.images.generate({
            model: "dall-e-2",  // Ensure this is the correct model for your API version
            prompt: prompt,
            n: 1,
            size: "1024x1024"  // Generate a square image
        });

        const imageUrl = response.data[0].url;

        // Download the image from the URL
        const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const imageBuffer = Buffer.from(imageResponse.data, 'binary');

        // Process the image to crop to 1024x341
        const croppedImageBuffer = await sharp(imageBuffer)
            .resize(1024, 341)  // Resize to 1024x341
            .toBuffer();

        const timestamp = Date.now();
        const imageFilePath = path.join(__dirname,'..', '/public/images', `image_${timestamp}.png`);
        console.log(imageFilePath);

        fs.writeFileSync(imageFilePath, croppedImageBuffer);

        res.json({ message: 'Image saved successfully', imageFilePath, imageUrl });
    } catch (error) {
        console.error('Error creating image:', error);
        res.status(500).json({ error: 'Failed to create image' });
    }
});


export default router;
