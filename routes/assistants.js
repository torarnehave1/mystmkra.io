import { Router } from 'express';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import axios from 'axios';
import mongoose from 'mongoose';
import Assistant from '../models/assitants.js'; // Import the Assistant model

dotenv.config();

const router = Router();
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Endpoint to create a new assistant
router.get('/create-assistant', async (req, res) => {
    try {
        const myAssistant = await openai.beta.assistants.create({
            instructions: "You are a expert in carpenting. When asked a question, write and run Python code to answer the question.",
            name: "Snekker",
            tools: [{ type: "code_interpreter" }],
            model: "gpt-4o",
        });

        console.log(myAssistant);
        res.json({ assistant: myAssistant });
    } catch (error) {
        console.error("Error creating assistant:", error);
        res.status(500).json({ error: "Failed to create assistant" });
    }
});

// Endpoint to retrieve the list of attached files for an assistant
router.get('/assistant-files', async (req, res) => {
    try {
        // Retrieve the Assistant
        const assistant = await openai.beta.assistants.retrieve(process.env.ASSISTANT_ID, {
            headers: {
                'OpenAI-Beta': 'assistants=v2',
            },
        });
        console.error("Assistant retrieved successfully:", assistant);

        // Extract the list of attached files and the assistant's name
        const attachedFiles = assistant.files || [];
        const fileNames = attachedFiles.map(file => file.name);
        const assistantName = assistant.name;

        // Retrieve the list of vector stores
        const vectorStoresResponse = await axios.get('https://api.openai.com/v1/vector_stores', {
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'OpenAI-Beta': 'assistants=v2',
            },
        });
        const vectorStores = vectorStoresResponse.data.data || [];
        const vectorStoreDetails = await Promise.all(vectorStores.map(async (store) => {
            const filesResponse = await axios.get(`https://api.openai.com/v1/vector_stores/${store.id}/files`, {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                    'OpenAI-Beta': 'assistants=v2',
                },
            });
            const fileNames = filesResponse.data.data
                .filter(file => file && file.id) // Ensure file and file.id are not null
                .map(file => file.id);
            return {
                id: store.id,
                name: store.name,
                file_counts: store.file_counts,
                files: fileNames,
            };
        }));

        res.json({
            success: true,
            assistantName: assistantName,
            files: fileNames,
            vectorStores: vectorStoreDetails,
        });
    } catch (error) {
        console.error("Error retrieving assistant files or vector stores:", error.message);
        res.status(500).json({ error: "Failed to retrieve assistant files or vector stores" });
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

export default router;
