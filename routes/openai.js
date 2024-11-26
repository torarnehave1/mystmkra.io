import { Router } from 'express';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import multer from 'multer';
import util from 'util';
import mongoose from 'mongoose';
import Mdfiles from '../models/Mdfiles.js';


import FormData from 'form-data';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import axios from 'axios';
import sharp from 'sharp';

import config from '../config/config.js';

import logMessage  from '../services/logMessage.js';
import generateOpenAIResponse  from '../services/openAIService.js';
import analyzePhotoAndText  from '../services/photoTextAnalysis.js';
import  searchDocuments  from '../services/documentSearchService.js';
import extractContentElements from '../services/extractContentfromMarkdown.js';


// List of Endpoints:
// - /ask: Test endpoint to verify OpenAI connection
// - /translate-audio: Endpoint to translate audio files using the Whisper model
// - /process-text: Endpoint to process text for different operations (answer-question, spellcheck-rewrite, generate-image-prompt)
// - /create-image: Endpoint to generate and save an image using DALL-E 3
// - /createimage: Endpoint to generate and save an image using DALL-E 2


console.log(`The application is running in ${config.NODE_ENV} mode.`);
console.log(`The base URL is ${config.BASE_URL}`);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const router = Router();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

let currentThreadId = null;  // In-memory store for the current thread ID

const performSearch = async (query) => {
    try {
        // Generate embedding for the query
        const queryEmbedding = await generateEmbedding(query);

        // Ensure the embedding is valid
        if (!Array.isArray(queryEmbedding) || !queryEmbedding.every(item => typeof item === 'number')) {
            throw new Error('Invalid query embedding format.');
        }

        // Find documents with similar embeddings
        const documents = await Mdfiles.aggregate([
            {
                $addFields: {
                    similarity: {
                        $let: {
                            vars: {
                                queryVector: queryEmbedding,
                                docVector: '$embeddings',
                            },
                            in: {
                                $reduce: {
                                    input: { $range: [0, { $size: '$$queryVector' }] },
                                    initialValue: 0,
                                    in: {
                                        $add: [
                                            '$$value',
                                            {
                                                $multiply: [
                                                    { $arrayElemAt: ['$$queryVector', '$$this'] },
                                                    { $arrayElemAt: ['$$docVector', '$$this'] },
                                                ],
                                            },
                                        ],
                                    },
                                },
                            },
                        },
                    },
                },
            },
            { $sort: { similarity: -1 } },
            { $limit: 2 }, // Limit to top 2 most similar documents
            {
                $project: {
                    _id: 0, // Exclude the _id field
                    content: 1, // Include the full content for processing
                    similarity: 1, // Include similarity for sorting
                },
            },
        ]);

        // Process documents using extractContentElements
        const processedDocuments = documents.map((doc) => {
            const extracted = extractContentElements(doc.content || ''); // Assuming this function extracts imageUrl, title, and excerpt
            return {
                similarity: doc.similarity, // Include similarity
                imageUrl: extracted.imageUrl, // Extracted image URL
                title: extracted.title, // Extracted title
                excerpt: extracted.excerpt, // Extracted excerpt
            };
        });

        return processedDocuments;
    } catch (err) {
        console.error('Error performing search:', err);
        throw err;
    }
};






/**
 * Function to generate embeddings using OpenAI
 * @param {string} text - The text content to generate embeddings for
 * @returns {Array} - The generated embedding
 */
async function generateEmbedding(text) {
    if (!text || typeof text !== 'string') {
        throw new Error('Input text is required and must be a non-empty string.');
    }
    try {
        const response = await openai.embeddings.create({
            model: 'text-embedding-ada-002',
            input: text,
        });
        return response.data[0].embedding;
    } catch (error) {
        console.error('Error generating embedding:', error.message);
        throw error;
    }
}

const conversationStates = {};

router.post('/webhook/:botToken', async (req, res) => {
    const botToken = req.params.botToken; // Extract bot token from the URL
    const payload = req.body;

    console.log(`Received webhook for bot: ${botToken}`);
    console.log('Payload:', payload);

    if (botToken === process.env.TELEGRAM_BOT1_TOKEN || botToken === process.env.TELEGRAM_BOT2_TOKEN) {
        console.log('Bot triggered');

        if (payload.message) {
            const chatId = payload.message.chat.id;
            const text = payload.message.text;

            // Log the received message
            await logMessage(payload.message);

            // Ensure a default state exists for the chat
            if (!conversationStates[chatId]) {
                conversationStates[chatId] = 'default';
            }

            try {
                if (text.startsWith('//FIND')) {
                    const query = text.replace('//FIND', '').trim();

                    if (!query) {
                        await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                            chat_id: chatId,
                            text: "Please provide a search query after `//FIND`.",
                        });
                        return;
                    }

                    console.log(`Searching for documents with query: "${query}"`);

                    // Perform the search
                    const documents = await performSearch(query);

                    if (documents.length === 0) {
                        await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                            chat_id: chatId,
                            text: "No documents found matching your query.",
                        });
                    } else {
                        // Prepare the response
                        const responseMessage = documents
                            .map((doc, index) => {
                                return `${index + 1}. ${doc.title || 'Untitled'} (Similarity: ${(doc.similarity * 100).toFixed(2)}%)\nExcerpt: ${doc.excerpt || 'No excerpt available.'}`;
                            })
                            .join('\n\n');

                        await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                            chat_id: chatId,
                            text: `Search Results:\n\n${responseMessage}`,
                            parse_mode: "Markdown",
                        });
                    }
                } else {
                    // Send a default response for testing
                    await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                        chat_id: chatId,
                        text: "OK",
                    });
                }
            } catch (err) {
                console.error('Error processing message:', err);

                await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                    chat_id: chatId,
                    text: "An error occurred while processing your request. Please try again later.",
                });
            }
        }
    } else {
        console.log('Unknown bot token');
    }

    res.status(200).send('OK'); // Respond to Telegram
});





router.post('/webhook2/:botToken', async (req, res) => {
    const botToken = req.params.botToken; // Extract bot token from the URL
    const payload = req.body;

    console.log(`Received webhook for bot: ${botToken}`);
    console.log('Payload:', payload);

    // Handle logic for each bot
    if (botToken === process.env.TELEGRAM_BOT1_TOKEN) {
        console.log('Bot 1 triggered');

        if (payload.message) {
            const chatId = payload.message.chat.id;
            const text = payload.message.text;
            const chatType = payload.message.chat.type; // Detect group or private chat

            // Check the current state for this chat
            const currentState = conversationStates[chatId] || 'default';

            try {
                // Handle different states
                if (currentState === 'awaitingSearchQuery') {
                    if (!text || text.trim() === '') {
                        // Prompt user again if no valid query is provided
                        await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                            chat_id: chatId,
                            text: "Please provide a valid search query.",
                        });
                        return;
                    }

                    console.log(`Performing search for query: "${text.trim()}"`);

                    // Call the searchDocuments function
                    const documents = await searchDocuments(text.trim());

                    if (documents.length === 0) {
                        await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                            chat_id: chatId,
                            text: "No documents found matching your query.",
                        });
                    } else {
                        const processedDocuments = documents.map((doc) => {
                            console.log('Document content:', doc.content || 'No content available.');
                            const extracted = extractContentElements(doc.content || '');
                            return {
                                similarity: doc.similarity,
                                ...extracted,
                            };
                        });

                        const responseMessage = processedDocuments
                            .map((doc, index) => {
                                return `${index + 1}. ${doc.title || 'Untitled'} (Similarity: ${(doc.similarity * 100).toFixed(2)}%)\nImage: ${doc.imageUrl || 'No image'}\nExcerpt: ${doc.excerpt}`;
                            })
                            .join('\n\n');

                        await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                            chat_id: chatId,
                            text: `Search Results:\n\n${responseMessage}`,
                            parse_mode: "Markdown",
                        });

                        console.log('Search results sent to user.');
                    }

                    // Reset state after search
                    conversationStates[chatId] = 'default';
                } else if (text?.startsWith('/search')) {
                    console.log('Search command detected.');

                    // Transition to 'awaitingSearchQuery' state
                    conversationStates[chatId] = 'awaitingSearchQuery';

                    await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                        chat_id: chatId,
                        text: "What would you like to search for? Please provide a query.",
                    });
                } else {
                    console.log(`Message detected in state '${currentState}': "${text}"`);

                    if (chatType === 'private' && text === "Hvordan har du det?") {
                        const reply = "Jeg har det som et mirakel!";
                        await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                            chat_id: chatId,
                            text: reply,
                        });
                        console.log('Reply sent: "Jeg har det som et mirakel!"');
                    } else if (chatType === 'group' || chatType === 'supergroup') {
                        console.log(`Message detected in a group (${chatType}): "${text}"`);

                        if (payload.message.photo || payload.message.caption) {
                            console.log("Photo or caption detected in group. Sending for analysis.");

                            const analysisResult = await analyzePhotoAndText(botToken, payload.message);

                            await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                                chat_id: chatId,
                                text: analysisResult,
                                parse_mode: "Markdown",
                            });

                            console.log("Analysis result sent to group.");
                        }

                        if (text && text.includes("?")) {
                            console.log(`Sending question to OpenAI: "${text}"`);

                            const groupReply = await generateOpenAIResponse(text);

                            await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                                chat_id: chatId,
                                text: groupReply,
                                parse_mode: "Markdown",
                            });

                            console.log(`Reply sent to group: "${groupReply}"`);
                        }
                    }
                }
            } catch (err) {
                console.error('Error processing message:', err);
            }
        }
    } else if (botToken === process.env.TELEGRAM_BOT2_TOKEN) {
        console.log('Bot 2 triggered');
        // Add your bot 2-specific logic here
    } else {
        console.log('Unknown bot');
    }

    res.status(200).send('OK'); // Respond to Telegram
});






router.get('/search-documents', async (req, res) => {
    const { query } = req.query;
  
    try {
      // Generate embedding for the query
      const queryEmbedding = await generateEmbedding(query);
  
      // Ensure the embedding is valid
      if (!Array.isArray(queryEmbedding) || !queryEmbedding.every(item => typeof item === 'number')) {
        return res.status(400).json({ message: 'Invalid query embedding format.' });
      }
  
      // Find documents with similar embeddings
      const documents = await Mdfiles.aggregate([
        {
          $addFields: {
            similarity: {
              $let: {
                vars: {
                  queryVector: queryEmbedding,
                  docVector: '$embeddings'
                },
                in: {
                  $reduce: {
                    input: { $range: [0, { $size: '$$queryVector' }] },
                    initialValue: 0,
                    in: {
                      $add: [
                        '$$value',
                        {
                          $multiply: [
                            { $arrayElemAt: ['$$queryVector', '$$this'] },
                            { $arrayElemAt: ['$$docVector', '$$this'] }
                          ]
                        }
                      ]
                    }
                  }
                }
              }
            }
          }
        },
        { $sort: { similarity: -1 } },
        { $limit: 10 } // Limit to top 10 most similar documents
      ]);
  
      res.status(200).json(documents);
    } catch (err) {
      console.error('Error searching documents:', err);
      res.status(500).json({ message: 'Error searching documents', error: err.message });
    }
  });
  

  

router.get('/search-documents-content', async (req, res) => {
  const { query } = req.query;

  try {
    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);

    // Ensure the embedding is valid
    if (!Array.isArray(queryEmbedding) || !queryEmbedding.every(item => typeof item === 'number')) {
      return res.status(400).json({ message: 'Invalid query embedding format.' });
    }

    // Find documents with similar embeddings
    const documents = await Mdfiles.aggregate([
      {
        $addFields: {
          similarity: {
            $let: {
              vars: {
                queryVector: queryEmbedding,
                docVector: '$embeddings',
              },
              in: {
                $reduce: {
                  input: { $range: [0, { $size: '$$queryVector' }] },
                  initialValue: 0,
                  in: {
                    $add: [
                      '$$value',
                      {
                        $multiply: [
                          { $arrayElemAt: ['$$queryVector', '$$this'] },
                          { $arrayElemAt: ['$$docVector', '$$this'] },
                        ],
                      },
                    ],
                  },
                },
              },
            },
          },
        },
      },
      { $sort: { similarity: -1 } },
      { $limit: 10 }, // Limit to top 10 most similar documents
      {
        $project: {
          _id: 0, // Exclude the _id field
          content: 1, // Include the full content for processing
          similarity: 1, // Include similarity for sorting
        },
      },
    ]);

    // Process documents using extractContentElements
    const processedDocuments = documents.map((doc) => {
      const extracted = extractContentElements(doc.content || '');
      return {
        similarity: doc.similarity,
        ...extracted, // Include imageUrl, title, and excerpt
      };
    });

    res.status(200).json(processedDocuments);
  } catch (err) {
    console.error('Error searching documents:', err);
    res.status(500).json({ message: 'Error searching documents', error: err.message });
  }
});

  
  
  
 

  


  
router.get('/send-message', async (req, res) => {
    const { question } = req.query;

    try {
        // Step 1: Get or create the current thread
        let threadId;

        if (currentThreadId) {
            // If there's already a thread ID stored, use it
            threadId = currentThreadId;
            console.log('Using existing thread ID:', threadId);
        } else {
            // Otherwise, create a new thread
            const threadResponse = await axios.post(
                `https://api.openai.com/v1/assistants/${process.env.ASSISTANT_ID}/threads`, 
                {}, 
                {
                    headers: {
                        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                        'OpenAI-Beta': 'assistants=v2',
                        'Content-Type': 'application/json',
                    },
                }
            );

            threadId = threadResponse.data.id;
            currentThreadId = threadId;  // Store the new thread ID
            console.log('New thread created with ID:', threadId);
        }

        // Step 2: Send the User Message to the Thread
        const messagePayload = {
            role: 'user',
            content: question || 'Hva er bioenergetikk',  // Use provided question or default
        };

        console.log("Sending message with payload:", messagePayload);

        const response = await axios.post(
            `https://api.openai.com/v1/assistants/${process.env.ASSISTANT_ID}/threads/${threadId}/messages`, 
            messagePayload, 
            {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                    'OpenAI-Beta': 'assistants=v2',
                    'Content-Type': 'application/json',
                },
            }
        );

        // Log and return the API response
        console.log('Message sent successfully:', response.data);
        res.json({
            success: true,
            data: response.data,
        });

    } catch (error) {
        // Error handling
        console.error('Error during message handling:', error.message);
        if (error.response) {
            console.error('Error details:', error.response.data);
            res.status(500).json({
                success: false,
                error: error.response.data,
            });
        } else {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }
});

router.get('/get-or-create-thread', async (req, res) => {
    try {
        let threadId;

        if (currentThreadId) {
            // If there's already a thread ID stored, use it
            threadId = currentThreadId;
            console.log('Using existing thread ID:', threadId);
        } else {
            // Otherwise, create a new thread
            const threadResponse = await axios.post(
                `https://api.openai.com/v1/assistants/${process.env.ASSISTANT_ID}/threads`, 
                {}, 
                {
                    headers: {
                        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                        'OpenAI-Beta': 'assistants=v2',
                        'Content-Type': 'application/json',
                    },
                }
            );
            threadId = threadResponse.data.id;
            currentThreadId = threadId;  // Store the new thread ID
            console.log('New thread created with ID:', threadId);
        }

        res.json({
            success: true,
            threadId: threadId,
        });

    } catch (error) {
        console.error('Error handling thread:', error.response ? error.response.data : error.message);
        res.status(500).json({
            success: false,
            error: error.response ? error.response.data : error.message,
        });
    }
});



router.get('/send-direct-message', async (req, res) => {
    const { question } = req.query;

    try {
        // Get or create the current thread
        let threadId;

        if (currentThreadId) {
            threadId = currentThreadId;
            console.log('Using existing thread ID:', threadId);
        } else {
            const threadResponse = await axios.post(
                `https://api.openai.com/v1/assistants/${process.env.ASSISTANT_ID}/threads`, 
                {}, 
                {
                    headers: {
                        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                        'OpenAI-Beta': 'assistants=v2',
                        'Content-Type': 'application/json',
                    },
                }
            );
            threadId = threadResponse.data.id;
            currentThreadId = threadId;  // Store the new thread ID
            console.log('New thread created with ID:', threadId);
        }

        // Define the payload
        const messagePayload = {
            thread_id: threadId,  // Use the current thread ID
            role: 'user',
            content: question || 'Hva er bioenergetikk',  // Use provided question or default
        };

        // Send the message directly to the OpenAI API using axios
        const response = await axios.post(
            `https://api.openai.com/v1/assistants/${process.env.ASSISTANT_ID}/threads/${threadId}/messages`, 
            messagePayload, 
            {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                    'OpenAI-Beta': 'assistants=v2',
                    'Content-Type': 'application/json',
                },
            }
        );

        // Log and return the API response
        console.log('Message sent successfully:', response.data);
        res.json({
            success: true,
            data: response.data,
        });

    } catch (error) {
        // Log and return any errors
        console.error('Error sending message:', error.response ? error.response.data : error.message);
        res.status(500).json({
            success: false,
            error: error.response ? error.response.data : error.message,
        });
    }
});





router.post('/send-message', async (req, res) => {
    const { question } = req.body;  // Get the user's question from the request body
    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });

    try {
        // Step 1: Retrieve the Assistant
        const assistant = await openai.beta.assistants.retrieve(process.env.ASSISTANT_ID, {
            headers: {
                'OpenAI-Beta': 'assistants=v2',
            },
        });
        console.log("Assistant retrieved successfully:", assistant);

        // Step 2: Create a Thread
        const thread = await openai.beta.threads.create({}, {
            headers: {
                'OpenAI-Beta': 'assistants=v2',
            },
        });
        console.log("Thread created successfully:", thread);

        // Step 3: Send the User Message to the Thread
        const messagePayload = {
            thread_id: thread.id,  // The ID of the created thread
            role: "user",           // Set the role to 'user'
            content: question || "What is bioenergetic analysis?",  // The content of the message
        };

        console.log("Sending message with payload:", messagePayload);

        const message = await openai.beta.threads.messages.create(messagePayload, {
            headers: {
                'OpenAI-Beta': 'assistants=v2',
            },
        });

        console.log("Message sent successfully:", message);

        // Respond to the client with a success message
        res.json({
            success: true,
            message: "Message sent successfully!",
            messageId: message.id,  // Optionally return the message ID
        });

    } catch (error) {
        console.error("Error during sending message:", error.message);
        console.error("Error details:", error.response ? error.response.data : error);
        res.status(500).json({ success: false, error: error.message });
    }
});



router.get('/create-thread-res', async (req, res) => {
    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });

    try {
        // Step 1: Retrieve the Assistant
        const assistant = await openai.beta.assistants.retrieve(process.env.ASSISTANT_ID, {
            headers: {
                'OpenAI-Beta': 'assistants=v2',
            },
        });
        console.log("Assistant retrieved successfully:", assistant);

        // Step 2: Create a Thread with the Assistant ID
        const thread = await openai.beta.threads.create({
            assistant_id: process.env.ASSISTANT_ID,  // Ensure assistant_id is included here
        }, {
            headers: {
                'OpenAI-Beta': 'assistants=v2',
            },
        });
        console.log("Thread created successfully with ID:", thread.id);

        // Step 3: Send a Hardcoded Message
        const message = await openai.beta.threads.messages.create(
            thread.id,
            { role: "user", content: "Hva er NIBI?" }
        );
        console.log("Message sent successfully:", message);

        // Step 4: Run the Assistant to process the message
        const run = await openai.beta.threads.runs.create({
            assistant_id: process.env.ASSISTANT_ID,  // Ensure assistant_id is included here
            thread_id: thread.id,
        }, {
            headers: {
                'OpenAI-Beta': 'assistants=v2',
            },
        });
        console.log("Run initiated successfully:", run);

        // Step 5: Poll the status of the run until it's complete
        let runStatus;
        do {
            runStatus = await openai.beta.threads.runs.retrieve({
                thread_id: thread.id,
                run_id: run.id,
            }, {
                headers: {
                    'OpenAI-Beta': 'assistants=v2',
                },
            });
            console.log("Run status:", runStatus.status);
            if (runStatus.status === 'completed') break;
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before checking again
        } while (runStatus.status !== 'completed');

        // Step 6: Retrieve Messages from the Thread (including the assistant's response)
        const messages = await openai.beta.threads.messages.list({
            thread_id: thread.id,
        }, {
            headers: {
                'OpenAI-Beta': 'assistants=v2',
            },
        });
        console.log("Messages retrieved successfully:", messages);

        // Extract the assistant's response from the messages
        const assistantResponse = messages.body.data
            .filter(message => message.role === 'assistant')
            .map(message => message.content)
            .join('\n');

        // Return the thread ID, confirmation, and assistant's response to the client
        res.json({
            success: true,
            threadId: thread.id,
            message: "Message sent and response received successfully",
            assistantResponse: assistantResponse,
        });

    } catch (error) {
        console.error("Error during assistant retrieval, thread creation, message sending, or response retrieval:", error.message);
        console.error("Error details:", error.response ? error.response.data : error);
        res.status(500).json({ success: false, error: error.message });
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
        console.log("Assistant retrieved successfully:", assistant);

        // Create a Thread
        const thread = await openai.beta.threads.create({}, {
            headers: {
                'OpenAI-Beta': 'assistants=v2',
            },
        });
        if (!thread || thread.error || thread.status === 'failed') {
            throw new Error('Failed to create thread');
        }
        console.log("Thread created successfully with ID:", thread.id);

        // Send the User's Question as a Message
        const message = await openai.beta.threads.messages.create(
            thread.id,
            { role: "user", content: question }  // Use the user's question here
        );
        if (!message || message.error || message.status === 'failed') {
            throw new Error('Failed to send message');
        }
        console.log("Message sent successfully:", message);

        // Start the Assistant Run
        const run = await openai.beta.threads.runs.create(
            thread.id,
            { assistant_id: process.env.ASSISTANT_ID }
        );
        if (!run || run.error || run.status === 'failed') {
            throw new Error('Failed to initiate run');
        }
        console.log("Run initiated successfully:", run);

        // Poll the status until the run is completed
        let runStatus;
        do {
            runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
            if (!runStatus || runStatus.error || runStatus.status === 'failed') {
                throw new Error('Failed to retrieve run status');
            }
            console.log("Run status:", runStatus.status);
            if (runStatus.status === 'completed') break;
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before checking again
        } while (runStatus.status !== 'completed');

        // Once completed, retrieve the messages in the thread
        const messages = await openai.beta.threads.messages.list(thread.id);
        if (!messages || messages.error || messages.status === 'failed') {
            throw new Error('Failed to retrieve messages');
        }
        console.log("Messages retrieved successfully:", messages);

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

// Create an Express.js endpoint to generate an embedding for a document in the "mdfiles" collection in MongoDB.
// The document is selected using `req.params.docid` from the URL.
// Use the OpenAI model "text-embedding-ada-002" to generate an embedding from the "content" field of the document.
// Add the generated embedding to the "embeddings" field of the same document.
// Return a success message or an error message in JSON format.

router.get('/emb/:docid', async (req, res) => {
    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });
   
    try {
        const docid = req.params.docid;

        // Convert docid to ObjectId
        if (!mongoose.Types.ObjectId.isValid(docid)) {
            return res.status(400).json({ error: 'Invalid document ID format' });
        }

        const doc = await Mdfiles.findOne({ _id: docid });
        if (!doc) {
            return res.status(404).json({ error: 'Document not found' });
        }

        // Check if content exists and is non-empty
        if (!doc.content || doc.content.trim() === '') {
            return res.status(400).json({ error: 'Document content is empty or invalid' });
        }

        // Generate embeddings
        const response = await openai.embeddings.create({
            model: 'text-embedding-ada-002',
            input: [doc.content], // Single document embedding
        });

        const embeddings = response.data[0].embedding;

        // Update the document with the new embeddings
        const updatedDoc = await Mdfiles.updateOne(
            { _id: docid },
            { $set: { embeddings } }
        );

        if (updatedDoc.modifiedCount === 1) {
            return res.json({ success: true, message: 'Embedding generated successfully' });
        } else {
            return res.status(500).json({ error: 'Failed to update the document with embeddings' });
        }
    } catch (error) {
        console.error('Error generating embedding:', error.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});


router.get('/create-thread-msg', async (req, res) => {
    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });

    try {
        // Retrieve the Assistant
        const assistant = await openai.beta.assistants.retrieve(process.env.ASSISTANT_ID, {
            headers: {
                'OpenAI-Beta': 'assistants=v2',
            },
        });
        console.log("Assistant retrieved successfully:", assistant);

        // Create a Thread
        const thread = await openai.beta.threads.create({}, {
            headers: {
                'OpenAI-Beta': 'assistants=v2',
            },
        });
        console.log("Thread created successfully with ID:", thread.id);

        // Send a Hardcoded Message
        const message = await openai.beta.threads.messages.create(
            thread.id,
            { role: "user", content: "Hva er NIBI?" }
        );
        console.log("Message sent successfully:", message);

        // Start the Assistant Run
        const run = await openai.beta.threads.runs.create(
            thread.id,
            { assistant_id: process.env.ASSISTANT_ID }
        );
        console.log("Run initiated successfully:", run);

        // Poll the status until the run is completed
        let runStatus;
        do {
            runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
            console.log("Run status:", runStatus.status);
            if (runStatus.status === 'completed') break;
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before checking again
        } while (runStatus.status !== 'completed');

        // Once completed, retrieve the messages in the thread
        const messages = await openai.beta.threads.messages.list(thread.id);
        console.log("Messages retrieved successfully:", messages);

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
            assistantResponse: assistantResponse,
        });

    } catch (error) {
        console.error("Error during assistant retrieval, thread creation, or message sending:", error.message);
        console.error("Error details:", error.response ? error.response.data : error);
        if (!res.headersSent) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
});




router.get('/create-thread', async (req, res) => {
    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });

    try {
        // Step 1: Retrieve the Assistant
        const assistant = await openai.beta.assistants.retrieve(process.env.ASSISTANT_ID, {
            headers: {
                'OpenAI-Beta': 'assistants=v2',
            },
        });
        console.log("Assistant retrieved successfully:", assistant);

        // Step 2: Create a Thread
        const thread = await openai.beta.threads.create({}, {
            headers: {
                'OpenAI-Beta': 'assistants=v2',
            },
        });
        console.log("Thread created successfully with ID:", thread.id);

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
    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });

    try {
        // Step 1: Retrieve the Assistant
        const assistant = await openai.beta.assistants.retrieve(process.env.ASSISTANT_ID, {
            headers: {
                'OpenAI-Beta': 'assistants=v2',
            },
        });
        console.log("Assistant retrieved successfully:", assistant);

        // Step 2: Create a Thread
        const thread = await openai.beta.threads.create({}, {
            headers: {
                'OpenAI-Beta': 'assistants=v2',
            },
        });
        console.log("Thread created successfully:", thread);

        // Step 3: Log the message payload before sending
        const messagePayload = {
            thread_id: thread.id,  // Use thread_id instead of threadId
            role: 'user',           // This must be included to specify the message sender
            content: question || "What is bioenergetic analysis?",
        };
        console.log("Sending message with payload:", messagePayload);

        // Step 3: Add the User Message to the Thread
        const message = await openai.beta.threads.messages.create(messagePayload, {
            headers: {
                'OpenAI-Beta': 'assistants=v2',
            },
        });
        console.log("Message added successfully:", message);

        // Step 4: Run the Assistant
        const run = await openai.beta.threads.runs.create({
            thread_id: thread.id,  // Use thread_id instead of threadId
        }, {
            headers: {
                'OpenAI-Beta': 'assistants=v2',
            },
        });
        console.log("Run initiated successfully:", run);

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
            console.log("Run status:", runStatus.status);
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
        console.log("Messages retrieved successfully:", messages);

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



router.get('/ask-assistant', async (req, res) => {
    const assistantId = process.env.ASSISTANT_ID;
    const userMessage = "Hva er nibi?";

    if (!assistantId) {
        return res.status(400).json({ error: 'Assistant ID is not configured in the environment variables' });
    }

    try {
        const response = await openai.beta.assistants.call(assistantId, {
            input: userMessage,
        });

        res.json({ message: 'Assistant response received', response: response });
    } catch (error) {
        console.error('Error calling assistant:', error.message || error);
        if (error.response) {
            console.error('Response data:', error.response.data);
            console.error('Response status:', error.response.status);
        } else if (error.request) {
            console.error('Request data:', error.request);
        }
        res.status(500).json({ error: 'Failed to call assistant' });
    }
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
