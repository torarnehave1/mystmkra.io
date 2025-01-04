import { Router } from 'express';
import mongoose from 'mongoose';
import Assistant from '../models/assitants.js'; // Import the Assistant model

const router = Router();

// Endpoint to add assistants to the database
router.post('/add-assistant', async (req, res) => {
    const { id, object, created_at, name, description, model, instructions, tools, tool_resources, metadata, temperature, top_p, response_format } = req.body;

    try {
        const newAssistant = new Assistant({
            _id: new mongoose.Types.ObjectId(),
            id,
            object,
            created_at,
            name,
            description,
            model,
            instructions,
            tools,
            tool_resources,
            metadata,
            temperature,
            top_p,
            response_format,
        });

        await newAssistant.save();
        res.status(201).json({ success: true, message: 'Assistant added successfully', assistant: newAssistant });
    } catch (error) {
        console.error('Error adding assistant:', error);
        res.status(500).json({ success: false, error: 'Failed to add assistant' });
    }
});

// Endpoint to retrieve all assistants from the database
router.get('/assistants', async (req, res) => {
    try {
        const assistants = await Assistant.find();
        res.json({ success: true, assistants });
    } catch (error) {
        console.error('Error retrieving assistants:', error);
        res.status(500).json({ success: false, error: 'Failed to retrieve assistants' });
    }
});

// Endpoint to retrieve a specific assistant by ID
router.get('/assistants/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const assistant = await Assistant.findOne({ id });
        if (!assistant) {
            return res.status(404).json({ success: false, error: 'Assistant not found' });
        }
        res.json({ success: true, assistant });
    } catch (error) {
        console.error('Error retrieving assistant:', error);
        res.status(500).json({ success: false, error: 'Failed to retrieve assistant' });
    }
});

// Endpoint to update a specific assistant by ID
router.put('/assistants/:id', async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;

    try {
        const updatedAssistant = await Assistant.findOneAndUpdate({ id }, updateData, { new: true });
        if (!updatedAssistant) {
            return res.status(404).json({ success: false, error: 'Assistant not found' });
        }
        res.json({ success: true, message: 'Assistant updated successfully', assistant: updatedAssistant });
    } catch (error) {
        console.error('Error updating assistant:', error);
        res.status(500).json({ success: false, error: 'Failed to update assistant' });
    }
});

// Endpoint to delete a specific assistant by ID
router.delete('/assistants/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const deletedAssistant = await Assistant.findOneAndDelete({ id });
        if (!deletedAssistant) {
            return res.status(404).json({ success: false, error: 'Assistant not found' });
        }
        res.json({ success: true, message: 'Assistant deleted successfully' });
    } catch (error) {
        console.error('Error deleting assistant:', error);
        res.status(500).json({ success: false, error: 'Failed to delete assistant' });
    }
});

export default router;
