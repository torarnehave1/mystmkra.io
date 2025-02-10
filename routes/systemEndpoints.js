import { Router } from 'express';
import Endpoint from '../models/endpoints.js'; // Import the Endpoint model
import mongoose from 'mongoose';

const router = Router();

// Endpoint to add a new system endpoint
router.post('/add-endpoint', async (req, res) => {
    const { url, trigger, parameters, Typeof, description } = req.body;
    console.log('Received request to add endpoint:', { url, trigger, parameters, Typeof, description });

    // Function to extract parameters from a comma-separated string
    const extractParameters = (paramString) => {
        return paramString.split(',').map(param => param.trim());
    };

    // Extract parameters into an array, ensuring it is stored even if it is only 1 parameter
    const parametersArray = parameters ? (Array.isArray(parameters) ? parameters : (parameters.includes(',') ? extractParameters(parameters) : [parameters.trim()])) : [];
    console.log('Extracted parameters:', parametersArray);

    try {
        const newEndpoint = new Endpoint({ url, trigger, parameters: parametersArray, Typeof, description });
        console.log('New endpoint object created:', newEndpoint);

        await newEndpoint.save();
        console.log('Endpoint saved successfully:', newEndpoint);

        res.status(201).json({ success: true, message: 'Endpoint created successfully', endpoint: newEndpoint });
    } catch (error) {
        console.error('Error creating endpoint:', error);
        res.status(500).json({ success: false, error: 'Failed to create endpoint' });
    }
});

// Endpoint to retrieve all system endpoints
router.get('/endpoints', async (req, res) => {
    try {
        const endpoints = await Endpoint.find();
        res.json({ success: true, endpoints });
    } catch (error) {
        console.error('Error retrieving endpoints:', error);
        res.status(500).json({ success: false, error: 'Failed to retrieve endpoints' });
    }
});

// Endpoint to retrieve a specific endpoint by ID
router.get('/endpoints/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const endpoint = await Endpoint.findById(id);
        if (!endpoint) {
            return res.status(404).json({ success: false, error: 'Endpoint not found' });
        }
        res.json({ success: true, endpoint });
    } catch (error) {
        console.error('Error retrieving endpoint:', error);
        res.status(500).json({ success: false, error: 'Failed to retrieve endpoint' });
    }
});

// Endpoint to update a specific endpoint by ID
router.put('/endpoints/:id', async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;

    try {
        const updatedEndpoint = await Endpoint.findByIdAndUpdate(id, updateData, { new: true });
        if (!updatedEndpoint) {
            return res.status(404).json({ success: false, error: 'Endpoint not found' });
        }
        res.json({ success: true, message: 'Endpoint updated successfully', endpoint: updatedEndpoint });
    } catch (error) {
        console.error('Error updating endpoint:', error);
        res.status(500).json({ success: false, error: 'Failed to update endpoint' });
    }
});

// Endpoint to delete a specific endpoint by ID
router.delete('/endpoints/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const deletedEndpoint = await Endpoint.findByIdAndDelete(id);
        if (!deletedEndpoint) {
            return res.status(404).json({ success: false, error: 'Endpoint not found' });
        }
        res.json({ success: true, message: 'Endpoint deleted successfully' });
    } catch (error) {
        console.error('Error deleting endpoint:', error);
        res.status(500).json({ success: false, error: 'Failed to delete endpoint' });
    }
});

// Endpoint to get the URL by finding the trigger
router.get('/endpoint-url/:trigger', async (req, res) => {
    const { trigger } = req.params;

    try {
        const endpoint = await Endpoint.findOne({ trigger });
        if (!endpoint) {
            return res.json({ success: true, message: 'Trigger not found' });
        }
        res.json({ 
            success: true, 
            url: endpoint.url, 
            trigger: endpoint.trigger, 
            Typeof: endpoint.Typeof,
            parameters: endpoint.parameters // Include parameters in the response
        });
    } catch (error) {
        console.error('Error retrieving endpoint URL:', error);
        res.status(500).json({ success: false, error: 'Failed to retrieve endpoint URL' });
    }
});

// Endpoint to get all possible enum values for the Typeof field
router.get('/endpoint-types', (req, res) => {
    try {
        const EndpointSchema = mongoose.model('Endpoint').schema;
        const enumValues = EndpointSchema.path('Typeof').enumValues;
        res.json({ success: true, types: enumValues });
    } catch (error) {
        console.error('Error fetching endpoint types:', error);
        res.status(500).json({ success: false, error: 'Error fetching endpoint types' });
    }
});

export default router;
