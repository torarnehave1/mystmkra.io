import { Router } from 'express';
import mongoose from 'mongoose';
import Assistant from '../models/assistants.js'; // Import the Assistant model
import VectorStoreFile from '../models/vectorStoreFileSchema.js'; // Import the VectorStoreFile model
import VectorStore from '../models/vectorStores.js'; // Import the VectorStore model
import File from '../models/openaifiles.js'; // Import the File model

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

// New endpoint to get assistants from MongoDB
router.get('/assistantsdb', async (req, res) => {
    try {
        const assistants = await Assistant.find();
        res.json({ success: true, assistants });
    } catch (error) {
        console.error('Error retrieving assistants from MongoDB:', error);
        res.status(500).json({ success: false, error: 'Failed to retrieve assistants from MongoDB' });
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

// Endpoint to store vector store files in the collection
router.get('/savetodb-vector-store-files', async (req, res) => {
    const vectorStoreId = req.query.id; // Get the vector store ID from the query parameters

    if (!vectorStoreId) {
        return res.status(400).json({ error: 'Vector store ID is required' });
    }

    try {
        // Fetch the vector store files from the external endpoint
        const response = await fetch(`http://localhost:3001/assistants/vector-store-files?id=${vectorStoreId}`);
        const data = await response.json();

        if (data.success) {
            // Store each file in the VectorStoreFile collection
            for (const fileId of data.files) {
                const newVectorStoreFile = new VectorStoreFile({
                    _id: new mongoose.Types.ObjectId(),
                    vector_store_id: vectorStoreId,
                    file_id: fileId,
                });

                await newVectorStoreFile.save();
            }

            res.json({ success: true, message: 'Vector store files stored successfully' });
        } else {
            res.status(500).json({ success: false, error: 'Failed to fetch vector store files' });
        }
    } catch (error) {
        console.error('Error storing vector store files:', error);
        res.status(500).json({ success: false, error: 'Failed to store vector store files' });
    }
});


router.get('/vectorstoresdb', async (req, res) => {
    const assistantId = req.query.id;

    try {
        // Fetch the assistant's tool_resources data
        const result = await Assistant.findOne(
            { id: assistantId },
            { "tool_resources.file_search.vector_store_ids": 1, _id: 0 }
        );

        // Debugging: Log the raw result as a string
        const rawResult = JSON.stringify(result);
        console.debug('Raw Result:', rawResult);

        // Use regex to extract the vector_store_id
        const match = rawResult.match(/"vector_store_ids":\s*\[\s*"([^"]+)"/);

        // If no match, return an error
        if (!match) {
            return res.status(404).json({ success: false, error: 'Vector store ID not found' });
        }

        // Extracted vector store ID
        const vectorStoreId = match[1];
        console.debug('Extracted Vector Store ID:', vectorStoreId);

        // Query the vectorstore collection for the matching document
        const vectorStore = await VectorStore.findOne({ store_id: vectorStoreId });

        // If no matching vector store is found
        if (!vectorStore) {
            return res.status(404).json({ success: false, error: 'Vector store not found' });
        }

        // Return the matching vector store document
        res.json({ success: true, vectorStore });
    } catch (error) {
        console.error('Error retrieving data:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});














    
    






// New endpoint to get vector stores connected to a specific assistant from MongoDB
router.get('/vectorstoresdbbk', async (req, res) => {
    const assistantId = req.query.id; // Get the assistant ID from the query parameters

    if (!assistantId) {
        return res.status(400).json({ error: 'Assistant ID is required' });
    }

    try {
        // Find the assistant by ID and project the necessary fields
        const assistant = await Assistant.findOne(
            { id: assistantId },
            { "tool_resources.file_search.vector_store_ids": 1, _id: 0 }
        );

        if (!assistant) {
            return res.status(404).json({ success: false, error: 'Assistant not found' });
        }

        // Get the vector store IDs from the assistant's tool_resources

        // Find the vector stores by their IDs
       // const vectorStores = await VectorStore.find({ store_id: { $in: vectorStoreIds } });

       const vectorStore = await VectorStore.findOne({ store_id: storeId });


        res.json({ success: true, vectorStore });
    } catch (error) {
        console.error('Error retrieving vector stores from MongoDB:', error);
        res.status(500).json({ success: false, error: 'Failed to retrieve vector stores from MongoDB' });
    }
});


// New endpoint to get vector store files from MongoDB
router.get('/vectorstorefilesdb', async (req, res) => {
    const vectorStoreId = req.query.id; // Get the vector store ID from the query parameters

    if (!vectorStoreId) {
        return res.status(400).json({ error: 'Vector store ID is required' });
    }

    try {
        const vectorStoreFiles = await VectorStoreFile.find({ vector_store_id: vectorStoreId });
        const fileIds = vectorStoreFiles.map(file => file.file_id);

        // Fetch filenames and file_ids from the files collection
        const files = await File.find({ file_id: { $in: fileIds } }, { filename: 1, file_id: 1, _id: 0 });

        res.json({ success: true, files });
    } catch (error) {
        console.error('Error retrieving vector store files from MongoDB:', error);
        res.status(500).json({ success: false, error: 'Failed to retrieve vector store files from MongoDB' });
    }
});

export default router;
