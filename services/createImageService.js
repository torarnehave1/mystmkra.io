import axios from 'axios';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import config from '../config/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const createImageService = async (prompt, size = "1024x1024") => {
    const validSizes = ["1024x1024", "1792x1024", "1024x1792"];
    if (!validSizes.includes(size)) {
        size = "1024x1024"; // Default size if the provided size is invalid
    }

    try {
        const response = await openai.images.generate({
            model: "dall-e-3",
            prompt: prompt,
            n: 1,
            size: size
        });

        if (!response || !response.data || !response.data[0] || !response.data[0].url) {
            throw new Error('Invalid response from OpenAI API');
        }

        const imageUrl = response.data[0].url;
        const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const imageBuffer = Buffer.from(imageResponse.data, 'binary');

        const croppedImageBuffer = await sharp(imageBuffer)
            .resize(280, 280)
            .toBuffer();

        const timestamp = Date.now();
        const imageFilePath = path.join(__dirname, '..', '/public/images', `image_${timestamp}.png`);
        const imageUrlRelative = `/images/image_${timestamp}.png`;
        const ReturnimageUrl = `${config.BASE_URL}${imageUrlRelative}`;

        fs.writeFileSync(imageFilePath, croppedImageBuffer);

        return { message: 'Image saved successfully', imageFilePath, ReturnimageUrl };
    } catch (error) {
        console.error('Error creating image:', error.message);
        throw new Error('Failed to create image');
    }
};

export default createImageService;
