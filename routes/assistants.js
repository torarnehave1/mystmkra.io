import { Router } from 'express';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import axios from 'axios';
import mongoose from 'mongoose';
import Assistant from '../models/assistants.js'; // Import the Assistant model
import VectorStore from '../models/vectorStores.js'; // Import the VectorStore model
import VectorStoreFile from '../models/vectorStoreFileSchema.js'; // Import the VectorStoreFile model
import multer from 'multer'; // Import multer for file uploads
import fs from 'fs'; // Import fs for file system operations

dotenv.config();

const router = Router();
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Endpoint to create a new assistant
router.post('/create-assistant', async (req, res) => {
    const { name, description, model, instructions, tools } = req.body;

    try {
        const myAssistant = await openai.beta.assistants.create({
            instructions,
            name,
            tools: tools.map(tool => ({ type: tool })),
            model,
        });

        console.log(myAssistant);

        // Add the new assistant to the database
        const newAssistant = new Assistant({
            _id: new mongoose.Types.ObjectId(),
            id: myAssistant.id,
            object: myAssistant.object,
            created_at: myAssistant.created_at,
            name: myAssistant.name,
            description,
            model: myAssistant.model,
            instructions: myAssistant.instructions,
            tools: myAssistant.tools.map(tool => tool.type),
            tool_resources: myAssistant.tool_resources,
            metadata: myAssistant.metadata,
            temperature: myAssistant.temperature,
            top_p: myAssistant.top_p,
            response_format: myAssistant.response_format,
        });

        await newAssistant.save();

        res.json({ success: true, message: 'New Assistant added successfully', assistant: myAssistant });
    } catch (error) {
        console.error("Error creating assistant:", error);
        res.status(500).json({ error: "Failed to create assistant" });
    }
});

// Endpoint to retrieve the list of attached files for an assistant
router.get('/assistant-files', async (req, res) => {
    const assistantId = req.query.id; // Get the assistant ID from the query parameters

    if (!assistantId) {
        return res.status(400).json({ error: 'Assistant ID is required' });
    }

    try {
        // Retrieve the Assistant
        const assistant = await openai.beta.assistants.retrieve(assistantId, {
            headers: {
                'OpenAI-Beta': 'assistants=v2',
            },
        });
        console.error("Assistant retrieved successfully:", assistant);

        // Extract the list of attached files and the assistant's name
        const attachedFiles = assistant.files || [];
        const fileNames = attachedFiles.map(file => file.name);
        const assistantName = assistant.name;

        res.json({
            success: true,
            assistantName: assistantName,
            files: fileNames,
        });
    } catch (error) {
        console.error("Error retrieving assistant files:", error.message);
        res.status(500).json({ error: "Failed to retrieve assistant files" });
    }
});

// Endpoint to retrieve the list of vector stores for an assistant
router.get('/assistant-vector-stores', async (req, res) => {
    const assistantId = req.query.id; // Get the assistant ID from the query parameters

    if (!assistantId) {
        return res.status(400).json({ error: 'Assistant ID is required' });
    }

    try {
        // Retrieve the Assistant
        const assistant = await openai.beta.assistants.retrieve(assistantId, {
            headers: {
                'OpenAI-Beta': 'assistants=v2',
            },
        });
        console.error("Assistant retrieved successfully:", assistant);

        // Retrieve the list of vector stores
        const vectorStoresResponse = await axios.get('https://api.openai.com/v1/vector_stores', {
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'OpenAI-Beta': 'assistants=v2',
            },
        });
        const vectorStores = vectorStoresResponse.data.data || [];

        // Debugging: Log the vector stores and assistant details
        console.log("Vector stores retrieved:", vectorStores);
        console.log("Assistant details:", assistant);

        // Filter vector stores using the tool_resources field
        const vectorStoreIds = assistant.tool_resources?.file_search?.vector_store_ids || [];
        const filteredVectorStores = vectorStores.filter(store => vectorStoreIds.includes(store.id));

        res.json({
            success: true,
            vectorStores: filteredVectorStores,
        });
    } catch (error) {
        console.error("Error retrieving vector stores:", error.message);
        res.status(500).json({ error: "Failed to retrieve vector stores" });
    }
});

// Endpoint to retrieve the list of files for a specific vector store
router.get('/vector-store-files', async (req, res) => {
    const vectorStoreId = req.query.id; // Get the vector store ID from the query parameters

    if (!vectorStoreId) {
        return res.status(400).json({ error: 'Vector store ID is required' });
    }

    try {
        // Retrieve the files for the vector store
        const filesResponse = await axios.get(`https://api.openai.com/v1/vector_stores/${vectorStoreId}/files`, {
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'OpenAI-Beta': 'assistants=v2',
            },
        });
        const files = filesResponse.data.data || [];

        res.json({
            success: true,
            files: files.map(file => file.id),
        });
    } catch (error) {
        console.error("Error retrieving vector store files:", error.message);
        res.status(500).json({ error: "Failed to retrieve vector store files" });
    }
});

router.get('/create-thread-res', async (req, res) => {
    try {
      const userMessage = req.query.message;
      if (!userMessage) {
        return res.status(400).json({ error: 'Message is required' });
      }
  
      const assistantId = process.env.ASSISTANT_ID;
      if (!assistantId) {
        return res.status(500).json({ error: 'ASSISTANT_ID is not configured' });
      }
  
      // Create a Thread
      const thread = await openai.beta.threads.create({}, {
        headers: { 'OpenAI-Beta': 'assistants=v2' },
      });
      console.error("Thread created successfully with ID:", thread.id);
  
      // Send the User's Message 
      const message = { // Hardcode the message object temporarily for debugging
        thread_id: thread.id,
        role: "user", 
        content: userMessage,
      };
  
      console.log("Message object before API call:", message); // Log the message object
  
      const messageResult = await openai.beta.threads.messages.create(
        message, 
        {
          headers: { 'OpenAI-Beta': 'assistants=v2' },
        }
      );
      console.error("Message sent successfully:", messageResult);
  
      // Run the Assistant 
      const run = await openai.beta.threads.runs.create(
        {
          thread_id: thread.id,
          assistant_id: assistantId 
        },
        { headers: { 'OpenAI-Beta': 'assistants=v2' } }
      );
      console.error("Run initiated successfully:", run);
  
      // Poll the status of the run (with exponential backoff)
      let runStatus;
      let delay = 1000;
      do {
        runStatus = await openai.beta.threads.runs.retrieve(
          { thread_id: thread.id, run_id: run.id },
          { headers: { 'OpenAI-Beta': 'assistants=v2' } }
        );
        console.error("Run status:", runStatus.status);
        if (runStatus.status === 'completed') break;
        await new Promise(resolve => setTimeout(resolve, delay));
        delay = Math.min(delay * 2, 10000); 
      } while (runStatus.status !== 'completed');
  
      // Retrieve Messages 
      const messages = await openai.beta.threads.messages.list(
        { thread_id: thread.id },
        { headers: { 'OpenAI-Beta': 'assistants=v2' } }
      );
      console.error("Messages retrieved successfully:", messages);
  
      // Extract the assistant's response 
      const assistantResponse = messages.data
        .filter((message) => message.role === "assistant")
        .map((message) => message.content)
        .join("\n");
  
      // Return the response
      res.json({
        success: true,
        threadId: thread.id,
        message: "Message sent and response received successfully",
        assistantResponse: assistantResponse,
      });
  
    } catch (error) {
      console.error("Error during assistant interaction:", error);
      res.status(500).json({
        success: false,
        error: 'Failed to process your request. Please try again later.'
      });
    }
  });

router.get('/create-thread', async (req, res) => {
    try {
        // Step 1: Retrieve the Assistant
        const assistant = await openai.beta.assistants.retrieve(process.env.ASSISTANT_ID, {
            headers: {
                'OpenAI-Beta': 'assistants=v2',
            },
        });
        console.error("Assistant retrieved successfully:", assistant);

        // Step 2: Create a Thread
        const thread = await openai.beta.threads.create({}, {
            headers: {
                'OpenAI-Beta': 'assistants=v2',
            },
        });
        console.error("Thread created successfully with ID:", thread.id);

        // Return the thread ID to the client
        res.json({
            success: true,
            threadId: thread.id,
        });

    } catch (error) {
        console.error("Error during assistant retrieval or thread creation:", error.message);
        console.error("Error details:", error.response ? error.response.data : error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/interact-with-assistant', async (req, res) => {
    const { question } = req.body;

    try {
        // Step 1: Retrieve the Assistant
        const assistant = await openai.beta.assistants.retrieve(process.env.ASSISTANT_ID, {
            headers: {
                'OpenAI-Beta': 'assistants=v2',
            },
        });
        console.error("Assistant retrieved successfully:", assistant);

        // Step 2: Create a Thread
        const thread = await openai.beta.threads.create({}, {
            headers: {
                'OpenAI-Beta': 'assistants=v2',
            },
        });
        console.error("Thread created successfully:", thread);

        // Step 3: Log the message payload before sending
        const messagePayload = {
            thread_id: thread.id,  // Use thread_id instead of threadId
            role: 'user',           // This must be included to specify the message sender
            content: question || "What is bioenergetic analysis?",
        };
        console.error("Sending message with payload:", messagePayload);

        // Step 3: Add the User Message to the Thread
        const message = await openai.beta.threads.messages.create(messagePayload, {
            headers: {
                'OpenAI-Beta': 'assistants=v2',
            },
        });
        console.error("Message added successfully:", message);

        // Step 4: Run the Assistant
        const run = await openai.beta.threads.runs.create({
            thread_id: thread.id,  // Use thread_id instead of threadId
        }, {
            headers: {
                'OpenAI-Beta': 'assistants=v2',
            },
        });
        console.error("Run initiated successfully:", run);

        // Step 5: Retrieve the Run Status and Wait for Completion
        let runStatus;
        do {
            runStatus = await openai.beta.threads.runs.retrieve({
                thread_id: thread.id,  // Use thread_id instead of threadId
                run_id: run.id,        // Use run_id instead of runId
            }, {
                headers: {
                    'OpenAI-Beta': 'assistants=v2',
                },
            });
            console.error("Run status:", runStatus.status);
            if (runStatus.status === 'completed') break;
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before checking again
        } while (runStatus.status !== 'completed');

        // Step 6: Retrieve Messages from the Thread
        const messages = await openai.beta.threads.messages.list({
            thread_id: thread.id  // Use thread_id instead of threadId
        }, {
            headers: {
                'OpenAI-Beta': 'assistants=v2',
            },
        });
        console.error("Messages retrieved successfully:", messages);

        // Format and send the response
        const responseMessages = messages.body.data.map(message => ({
            role: message.role,
            content: message.content
        }));

        res.json({
            success: true,
            messages: responseMessages
        });

    } catch (error) {
        console.error("Error during interaction with assistant:", error.message);
        console.error("Error details:", error.response ? error.response.data : error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/ask-assistant2', async (req, res) => {
    const assistantId = process.env.ASSISTANT_ID || 'asst_r1C69xTdggfaReVHyjZUZnyy';
    const { question } = req.body;

    if (!assistantId) {
        return res.status(400).json({ error: 'Assistant ID is not configured in the environment variables' });
    }

    if (!question) {
        return res.status(400).json({ error: 'No question provided' });
    }

    try {
        const response = await axios.post(`https://api.openai.com/v1/assistants/${assistantId}/messages`, {
            input: question
        }, {
            headers: {
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
                'OpenAI-Beta': 'assistants=v2',  // Required header for accessing the beta API
            }
        });

        res.json({ message: 'Assistant response received', response: response.data });
    } catch (error) {
        console.error('Error asking assistant:', error.message || error);
        if (error.response) {
            console.error('Response data:', error.response.data);
            console.error('Response status:', error.response.status);
        } else if (error.request) {
            console.error('Request data:', error.request);
        }
        res.status(500).json({ error: 'Failed to ask assistant' });
    }
});

router.get('/retrieve-assistant', async (req, res) => {
    const assistantId = process.env.ASSISTANT_ID || 'asst_r1C69xTdggfaReVHyjZUZnyy';

    if (!assistantId) {
        return res.status(400).json({ error: 'Assistant ID is not configured in the environment variables' });
    }

    try {
        const response = await axios.get(`https://api.openai.com/v1/assistants/${assistantId}`, {
            headers: {
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
                'OpenAI-Beta': 'assistants=v2',  // Add this header
            }
        });

        res.json({ message: 'Assistant retrieved successfully', data: response.data });
    } catch (error) {
        console.error('Error retrieving assistant:', error.message || error);
        if (error.response) {
            console.error('Response data:', error.response.data); // Log the response data from the API
            console.error('Response status:', error.response.status); // Log the status code from the API
        } else if (error.request) {
            console.error('Request data:', error.request); // Log the request that was made
        } else {
            console.error('Unexpected error:', error.message); // Log any unexpected errors
        }
        res.status(500).json({ error: 'Failed to retrieve assistant' });
    }
});

router.post('/ask-assistant', async (req, res) => {
    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });

    const { question } = req.body; // Extract the question from the request body

    try {
        // Retrieve the Assistant
        const assistant = await openai.beta.assistants.retrieve(process.env.ASSISTANT_ID, {
            headers: {
                'OpenAI-Beta': 'assistants=v2',
            },
        });
        if (!assistant || assistant.error || assistant.status === 'failed') {
            throw new Error('Failed to retrieve assistant');
        }
        console.error("Assistant retrieved successfully:", assistant);

        // Create a Thread
        const thread = await openai.beta.threads.create({}, {
            headers: {
                'OpenAI-Beta': 'assistants=v2',
            },
        });
        if (!thread || thread.error || thread.status === 'failed') {
            throw new Error('Failed to create thread');
        }
        console.error("Thread created successfully with ID:", thread.id);

        // Send the User's Question as a Message
        const message = await openai.beta.threads.messages.create(
            thread.id,
            { role: "user", content: question }  // Use the user's question here
        );
        if (!message || message.error || message.status === 'failed') {
            throw new Error('Failed to send message');
        }
        console.error("Message sent successfully:", message);

        // Start the Assistant Run
        const run = await openai.beta.threads.runs.create(
            thread.id,
            { assistant_id: process.env.ASSISTANT_ID }
        );
        if (!run || run.error || run.status === 'failed') {
            throw new Error('Failed to initiate run');
        }
        console.error("Run initiated successfully:", run);

        // Poll the status until the run is completed
        let runStatus;
        do {
            runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
            if (!runStatus || runStatus.error || runStatus.status === 'failed') {
                throw new Error('Failed to retrieve run status');
            }
            console.error("Run status:", runStatus.status);
            if (runStatus.status === 'completed') break;
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before checking again
        } while (runStatus.status !== 'completed');

        // Once completed, retrieve the messages in the thread
        const messages = await openai.beta.threads.messages.list(thread.id);
        if (!messages || messages.error || messages.status === 'failed') {
            throw new Error('Failed to retrieve messages');
        }
        console.error("Messages retrieved successfully:", messages);

        // Extract the assistant's response
        const assistantResponse = messages.data
            .filter(msg => msg.role === 'assistant')
            .map(msg => msg.content.map(part => part.text.value).join(''))
            .join('\n');

        // Send the assistant's response back to the client
        res.json({
            success: true,
            threadId: thread.id,
            runStatus: runStatus.status,
            response: assistantResponse,
        });

    } catch (error) {
        console.error("Error during assistant retrieval, thread creation, or message sending:", error.message);
        console.error("Error details:", error.response ? error.response.data : error);
        if (!res.headersSent) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
});

// Endpoint to add assistants to the database
router.get('/add-assistants', async (req, res) => {
    try {
        const myAssistants = await openai.beta.assistants.list({
            order: "desc",
            limit: "20",
        });

        for (const assistant of myAssistants.data) {
            // Ensure tools is an array of strings
            if (assistant.tools && !Array.isArray(assistant.tools)) {
                assistant.tools = assistant.tools.map(tool => tool.type);
            }

            try {
                await Assistant.updateOne(
                    { id: assistant.id },
                    { $set: {
                        ...assistant,
                        tools: assistant.tools.map(tool => tool.toString()) // Ensure tools are strings
                    }},
                    { upsert: true } // Create a new document if it doesn't exist
                );
            } catch (error) {
                console.error(`Error updating assistant with ID ${assistant.id}:`, error);
            }
        }

        res.json({ success: true, message: 'Assistants have been added to the database.' });
    } catch (error) {
        console.error("Error adding assistants to the database:", error);
        res.status(500).json({ error: "Failed to add assistants to the database" });
    }
});

// Endpoint to list available models
router.get('/models', async (req, res) => {
    try {
        const list = await openai.models.list();
        const models = [];
        const allowedModels = ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'];
        for await (const model of list) {
            if (allowedModels.includes(model.id)) {
                models.push(model);
            }
        }
        res.json({ success: true, models });
    } catch (error) {
        console.error('Error listing models:', error);
        res.status(500).json({ success: false, error: 'Failed to list models' });
    }
});


router.get('/allmodels', async (req, res) => {
    try {
        const list = await openai.models.list();
        const models = [];
       
        for await (const model of list) {
          
                models.push(model);
            
        }
        res.json({ success: true, models });
    } catch (error) {
        console.error('Error listing models:', error);
        res.status(500).json({ success: false, error: 'Failed to list models' });
    }
});

// Endpoint to retrieve the list of vector stores for an assistant and save them to the database
router.get('/save-assistant-vector-stores', async (req, res) => {
    const assistantId = req.query.id; // Get the assistant ID from the query parameters

    if (!assistantId) {
        return res.status(400).json({ error: 'Assistant ID is required' });
    }

    try {
        // Retrieve the Assistant
        const assistant = await openai.beta.assistants.retrieve(assistantId, {
            headers: {
                'OpenAI-Beta': 'assistants=v2',
            },
        });
        console.error("Assistant retrieved successfully:", assistant);

        // Retrieve the list of vector stores
        const vectorStoresResponse = await axios.get('https://api.openai.com/v1/vector_stores', {
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'OpenAI-Beta': 'assistants=v2',
            },
        });
        const vectorStores = vectorStoresResponse.data.data || [];

        // Log the vector stores and assistant details
        console.log("Vector stores retrieved:", vectorStores);
        console.log("Assistant details:", assistant);

        // Filter vector stores using the tool_resources field
        const rawResult = JSON.stringify(assistant);
        const match = rawResult.match(/"vector_store_ids":\s*\[\s*"([^"]+)"/);
        const vectorStoreIds = match ? [match[1]] : [];

        const filteredVectorStores = vectorStores.filter(store => vectorStoreIds.includes(store.id));

        // Delete existing vector store documents for the assistant
        await VectorStore.deleteMany({ store_id: { $in: vectorStoreIds } });

        // Save the filtered vector stores to the database
        for (const store of filteredVectorStores) {
            const newStore = new VectorStore({
                _id: new mongoose.Types.ObjectId(),
                store_id: store.id,
                name: store.name,
                description: store.description || null,
                created_at: store.created_at,
                status: store.status,
                status_details: store.status_details || null,
                usage_bytes: store.usage_bytes,
                file_counts: {
                    in_progress: store.file_counts.in_progress,
                    completed: store.file_counts.completed,
                    failed: store.file_counts.failed,
                    cancelled: store.file_counts.cancelled,
                    total: store.file_counts.total,
                },
                metadata: store.metadata || {},
                expires_after: store.expires_after || null,
                expires_at: store.expires_at || null,
                last_active_at: store.last_active_at,
            });

            await newStore.save();
            console.log(`Saved new vector store to database: ${store.name}`);
        }

        res.json({
            success: true,
            vectorStores: filteredVectorStores,
        });
    } catch (error) {
        console.error("Error retrieving or saving vector stores:", error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
            console.error('Response status:', error.response.status);
        } else if (error.request) {
            console.error('Request data:', error.request);
        }
        res.status(500).json({ error: "Failed to retrieve or save vector stores" });
    }
});

// Endpoint to retrieve the list of vector stores and save them to the database
router.get('/save-all-vector-stores', async (req, res) => {
    try {
        // Retrieve the list of vector stores
        const vectorStoresResponse = await axios.get('https://api.openai.com/v1/vector_stores', {
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'OpenAI-Beta': 'assistants=v2',
            },
        });
        const vectorStores = vectorStoresResponse.data.data || [];

        // Log the vector stores
        console.log("Vector stores retrieved:", vectorStores);

        // Delete all existing vector stores from the database
        await VectorStore.deleteMany({});
        console.log("All existing vector stores deleted from the database.");

        // Save all vector stores to the database
        for (const store of vectorStores) {
            const newStore = new VectorStore({
                _id: new mongoose.Types.ObjectId(),
                store_id: store.id,
                name: store.name,
                description: store.description || null,
                created_at: store.created_at,
                status: store.status,
                status_details: store.status_details || null,
                usage_bytes: store.usage_bytes,
                file_counts: store.file_counts,
                metadata: store.metadata || {},
                expires_after: store.expires_after || null,
                expires_at: store.expires_at || null,
                last_active_at: store.last_active_at,
            });

            await newStore.save();
            console.log(`Saved new vector store to database: ${store.name}`);
        }

        res.json({
            success: true,
            vectorStores: vectorStores,
        });
    } catch (error) {
        console.error("Error retrieving or saving vector stores:", error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
            console.error('Response status:', error.response.status);
        } else if (error.request) {
            console.error('Request data:', error.request);
        }
        res.status(500).json({ error: "Failed to retrieve or save vector stores" });
    }
});

// New endpoint to retrieve file content
router.get('/file-content', async (req, res) => {
    const fileId = req.query.id; // Get the file ID from the query parameters

    if (!fileId) {
        return res.status(400).json({ error: 'File ID is required' });
    }

    try {
        const file = await openai.files.content(fileId);
        res.json({ success: true, content: file });
    } catch (error) {
        console.error('Error retrieving file content:', error);
        if (error.response && error.response.data && error.response.data.error && error.response.data.error.message === 'Not allowed to download files of purpose: assistants') {
            res.status(403).json({ success: false, error: 'Not allowed to download files of purpose: assistants' });
        } else {
            res.status(500).json({ success: false, error: 'Failed to retrieve file content' });
        }
    }
});

// New endpoint to delete a specific file from a vector store and the database
router.delete('/delete-vector-store-file', async (req, res) => {
    const { vectorStoreId, fileId } = req.query; // Get the vector store ID and file ID from the query parameters

    if (!vectorStoreId || !fileId) {
        return res.status(400).json({ error: 'Vector store ID and file ID are required' });
    }

    try {
        // Delete the file from the database
        await VectorStoreFile.findOneAndDelete({ vector_store_id: vectorStoreId, file_id: fileId });

        res.json({ success: true, message: 'File deleted from database' });
    } catch (error) {
        console.error('Error deleting file from database:', error);
        res.status(500).json({ success: false, error: 'Failed to delete file from database' });
    }
});

// New endpoint to upload a file to the vector store and attach it to the assistant
router.post('/upload-vector-store-file', upload.single('file'), async (req, res) => {
    const { vectorStoreId, assistantId } = req.body;
    const file = req.file;

    console.debug('Received upload request:', { vectorStoreId, assistantId, file });

    if (!vectorStoreId || !assistantId || !file) {
        console.error('Missing required parameters:', { vectorStoreId, assistantId, file });
        return res.status(400).json({ error: 'Vector store ID, assistant ID, and file are required' });
    }

    try {
        // Upload the file to OpenAI
        console.debug('Reading file from path:', file.path);
        const fileData = fs.readFileSync(file.path);
        console.debug('File data read successfully');

        const uploadedFile = await openai.files.create({
            purpose: 'assistants',
            file: fileData,
            filename: file.originalname,
        });

        console.debug('File uploaded to OpenAI:', uploadedFile);

        // Attach the file to the vector store
        await openai.beta.vectorStores.files.add(vectorStoreId, uploadedFile.id);
        console.debug('File attached to vector store:', { vectorStoreId, fileId: uploadedFile.id });

        // Save the file details to the database
        const newVectorStoreFile = new VectorStoreFile({
            _id: new mongoose.Types.ObjectId(),
            vector_store_id: vectorStoreId,
            file_id: uploadedFile.id,
        });
        await newVectorStoreFile.save();
        console.debug('File details saved to database:', newVectorStoreFile);

        // Clean up the uploaded file from the server
        fs.unlinkSync(file.path);
        console.debug('Uploaded file removed from server:', file.path);

        // Call save-assistant-vector-stores to update the vector store
        await axios.get(`/assistants/save-assistant-vector-stores?id=${vectorStoreId}`);
        // Call savetodb-vector-store-files to save vector store files to the database
        await axios.get(`/assistantsdb/savetodb-vector-store-files?id=${vectorStoreId}`);
        // Call list-and-save-files to refresh the list of files
        await axios.get(`/openai/list-and-save-files`);

        res.json({ success: true, message: 'File uploaded and attached to vector store successfully', file: uploadedFile });
    } catch (error) {
        if (error.response && error.response.status === 413) {
            console.error('Error uploading file to vector store: Payload Too Large');
            res.status(413).json({ success: false, error: 'The data value transmitted exceeds the capacity limit.' });
        } else {
            console.error('Error uploading file to vector store:', error);
            res.status(500).json({ success: false, error: 'Failed to upload file to vector store' });
        }
    }
});

// Endpoint to attach a file to a vector store
router.post('/attach-file-to-vector-store', async (req, res) => {
    const { fileId, vectorStoreId } = req.body;

    console.debug('Received request to attach file to vector store:', { fileId, vectorStoreId });

    if (!fileId || !vectorStoreId) {
        console.error('Missing required parameters:', { fileId, vectorStoreId });
        return res.status(400).json({ error: 'File ID and Vector Store ID are required' });
    }

    try {
        // Attach the file to the vector store using the correct method
        const myVectorStoreFile = await openai.beta.vectorStores.files.create(vectorStoreId, {
            file_id: fileId
        });
        console.debug('File attached to vector store successfully:', myVectorStoreFile);

        res.json({ success: true, message: 'File attached to vector store successfully' });
    } catch (error) {
        console.error('Error attaching file to vector store:', error);
        res.status(500).json({ error: 'Failed to attach file to vector store' });
    }
});

export default router;
