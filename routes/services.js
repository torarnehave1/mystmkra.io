import { Router } from 'express';
import { generateDescription } from '../services/generateDescription.js';

const router = Router();

router.post('/generate-description', async (req, res) => {
    const { name, model, instructions, currentDescription } = req.body;

    try {
        const description = await generateDescription(name, model, instructions, currentDescription);
        res.json({ success: true, description });
    } catch (error) {
        console.error('Error generating description:', error);
        res.status(500).json({ success: false, error: 'Failed to generate description' });
    }
});

export default router;
