import { Router } from 'express';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import multer from 'multer';
import util from 'util';
import mongoose from 'mongoose';
import Mdfiles from '../models/Mdfiles.js';
import {isAuthenticated} from '../auth/auth.js';

import FormData from 'form-data';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import axios from 'axios';
import sharp from 'sharp';
import { Dropbox } from 'dropbox'; // Import the Dropbox class

import config from '../config/config.js';

import logMessage  from '../services/logMessage.js';
import generateOpenAIResponse  from '../services/openAIService.js';
import analyzePhotoAndText  from '../services/photoTextAnalysis.js';
import  searchDocuments  from '../services/documentSearchService.js';
import extractContentElements from '../services/extractContentfromMarkdown.js';
import { title } from 'process';
import { encoding_for_model } from 'tiktoken';
import OpenaiFile from '../models/openaifiles.js';

// List of Endpoints:
// - /ask: Test endpoint to verify OpenAI connection
// - /process-text: Endpoint to process text for different operations (answer-question, spellcheck-rewrite, generate-image-prompt)
// - /create-image: Endpoint to generate and save an image using DALL-E 3
// - /createimage: Endpoint to generate and save an image using DALL-E 2

console.error(`The application is running in ${config.NODE_ENV} mode.`);
console.error(`The base URL is ${config.BASE_URL}`);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();
dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

let accessToken = null; // Initialize accessToken
let expiryTime = 0; // Initialize expiryTime

async function refreshAccessToken() {
    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', process.env.DROPBOX_REFRESH_TOKEN); // Ensure refreshToken is defined
  
    try {
      const response = await axios.post('https://api.dropboxapi.com/oauth2/token', params, {
        auth: {
          username: process.env.DROPBOX_APP_KEY,
          password: process.env.DROPBOX_APP_SECRET,
        },
      });
  
      const newAccessToken = response.data.access_token;
      const expiresIn = response.data.expires_in; // Expiry time in seconds
      expiryTime = Date.now() + expiresIn * 1000; // Current time + expiry duration in ms
  
      // Update the global access token
      accessToken = newAccessToken;
  
      return newAccessToken;
    } catch (error) {
      console.error('Error refreshing access token:', error);
      throw error;
    }
  }
  
  // Middleware to refresh the access token if expired
  async function ensureValidToken(req, res, next) {
    if (!accessToken || Date.now() >= expiryTime) {
      try {
        accessToken = await refreshAccessToken();
      } catch (error) {
        return res.status(500).json({
          message: 'Error refreshing access token',
          error: error.message,
        });
      }
    }
    next();
  }

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
            { $limit: 10 }, // Limit to top 10 most similar documents
            {
                $project: {
                    _id: 0, // Exclude the _id field
                    title: 1, // Include the title field
                    URL: 1, // Include the URL field
                },
            },
        ]);

        return documents.map(doc => ({
            title: doc.title || 'Untitled',
            URL: doc.URL || 'No URL available',
        }));
    } catch (err) {
        console.error('Error performing search:', err);
        throw err;
    }
};

/**
 * Function to generate embeddings using OpenAI
 * @param {string} text - The text content to generate embeddings for
 * @returns {Array} - The combined embeddings for all chunks
 */
async function generateEmbedding(text) {
    if (!text || typeof text !== 'string') {
        throw new Error('Input text is required and must be a non-empty string.');
    }

    try {
        console.error('Starting to generate embeddings...');
        const maxTokens = 8191; // Token limit for the OpenAI model
        const chunkSize = maxTokens - 100; // Leave buffer for overhead
        const contentChunks = splitIntoChunks(text, chunkSize);

        console.error(`Total chunks created: ${contentChunks.length}`); // Log the number of chunks

        const embeddings = [];
        for (const chunk of contentChunks) {
            console.error(`Processing chunk of size ${chunk.length} tokens: ${chunk.substring(0, 100)}...`); // Log the first 100 chars of the chunk
            console.error('Sending request to OpenAI API...');
            const response = await openai.embeddings.create({
                model: 'text-embedding-ada-002',
                input: chunk,
            });
            console.error('Received response from OpenAI API.');

            if (response && response.data && response.data.length > 0) {
                embeddings.push(...response.data.map(item => item.embedding));
            } else {
                console.warn('No embeddings returned for chunk:', chunk);
            }
        }

        console.error(`Total embeddings generated: ${embeddings.length}`);
        return embeddings.flat();
    } catch (error) {
        console.error('Error generating embeddings:', error.message);
        throw error;
    }
}

/**
 * Utility function to split text into chunks
 * @param {string} text - The input text
 * @param {number} maxTokens - The maximum number of tokens per chunk
 * @returns {Array} - Array of text chunks
 */
function splitIntoChunks(text, maxTokens) {
    console.error('Starting to split text into chunks...');
    const chunks = [];
    let currentChunk = "";

    for (const line of text.split("\n")) {
        if ((currentChunk + line).length > maxTokens) {
            chunks.push(currentChunk);
            currentChunk = "";
        }
        currentChunk += `${line}\n`;
    }

    if (currentChunk.length > 0) {
        chunks.push(currentChunk);
    }

    console.error(`Chunks created: ${chunks.length}`);
    chunks.forEach((chunk, index) => {
        console.error(`Chunk ${index + 1} size: ${chunk.length}`);
    });

    return chunks;
}

/**
 * Function to check the length of the content and split it into multiple parts if necessary
 * @param {string} content - The content to check and split
 * @param {number} maxLength - The maximum length of each part
 * @returns {Array} - An array of content parts
 */
function splitContentIntoParts(content, maxLength) {
    const parts = [];
    let currentPart = '';

    for (const line of content.split('\n')) {
        if ((currentPart + line).length > maxLength) {
            parts.push(currentPart);
            currentPart = '';
        }
        currentPart += `${line}\n`;
    }

    if (currentPart.length > 0) {
        parts.push(currentPart);
    }

    return parts;
}

async function saveMarkdownContent(req, res) {
    const { content, documentId } = req.body;

    if (!content.trim()) {
        return res.status(400).json({ error: 'Textarea is empty. Please enter some content.' });
    }

    // Retrieve the user ID from the request
    const userId = req.user.id; // Assuming userId is available in the request

    if (!userId) {
        return res.status(400).json({ error: 'User ID not found. Please log in again.' });
    }

    try {
        const maxLength = 8192;
        const contentParts = splitContentIntoParts(content, maxLength);
        const totalParts = contentParts.length;
        const newDocumentId = new mongoose.Types.ObjectId();

        const savedParts = await Promise.all(contentParts.map((part, index) => {
            const newDocument = new Mdfiles({
                _id: newDocumentId,
                content: part,
                User_id: userId, // Ensure User_id is set
                part: index + 1,
                totalParts: totalParts,
                documentId: newDocumentId
            });
            return newDocument.save();
        }));

        const result = savedParts[0]; // Use the first part as the reference

        res.json({
            success: true,
            message: 'File saved successfully',
            documentId: result.documentId,
            filePath: `/dropbox/blog/${userId}/${result.documentId}.md`,
        });
    } catch (error) {
        console.error('Error saving file:', error);
        res.status(500).json({ error: 'An error occurred while saving the file' });
    }
}

const conversationStates = {};

router.post('/webhook_BAK/:botToken', async (req, res) => {
    const botToken = req.params.botToken; // Extract bot token from the URL
    const payload = req.body;

    console.error(`Received webhook for bot: ${botToken}`);
    console.error('Payload:', JSON.stringify(payload, null, 2));

    if (botToken === process.env.TELEGRAM_BOT1_TOKEN || botToken === process.env.TELEGRAM_BOT2_TOKEN) {
        console.error('Bot triggered');

        if (payload.message) {
            const chatId = payload.message.chat.id;
            const text = payload.message.text; // Extract the text from the message
            const fromId = payload.message.from.id;

            // Check if the message is from the bot itself
            if (payload.message.from.is_bot) {
                console.error('Skipping message from the bot itself.');
                res.status(200).send('OK');
                return;
            }

            try {
                if (text && text.includes('?')) {
                    console.error(`Performing search for query: "${text}"`);

                    // Perform the search
                    const urls = await performSearch(text); // Returns only URLs

                    if (urls.length === 0) {
                        await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                            chat_id: chatId,
                            text: "No documents found matching your query.",
                        });
                    } else {
                        console.error('Sending results to Telegram.');

                        // Iterate through the URLs and send each as a separate message
                        for (const url of urls) {
                            await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                                chat_id: chatId,
                                text: url, // Send only the pure URL
                            });

                            // Introduce a delay between messages to avoid hitting Telegram rate limits
                            await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
                        }

                        console.error('All URLs sent as separate messages.');
                    }

                    // Return the original response to the HTTP client
                    res.status(200).json({ success: true, urlsSent: urls.length });
                    return; // Exit after sending the HTTP response
                } else {
                    console.error('Message does not contain a question mark.');
                    await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                        chat_id: chatId,
                        text: "Please include a `?` in your message to perform a search.",
                    });
                }
            } catch (err) {
                console.error('Error processing message:', err);

                await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                    chat_id: chatId,
                    text: "An error occurred while processing your request. Please try again later.",
                });

                res.status(500).json({ error: 'An error occurred while processing your request.' });
                return;
            }
        }
    } else {
        console.error('Unknown bot token');
        res.status(400).json({ error: 'Invalid bot token.' });
    }
});




router.post('/webhook/:botToken', async (req, res) => {
    const botToken = req.params.botToken; // Extract bot token from the URL
    const payload = req.body;

    console.error(`Received webhook for bot: ${botToken}`);
    console.error('Payload:', JSON.stringify(payload, null, 2));

    if (botToken === process.env.TELEGRAM_BOT1_TOKEN || botToken === process.env.TELEGRAM_BOT2_TOKEN) {
        console.error('Bot triggered');

        if (payload.message) {
            const chatId = payload.message.chat.id;
            const text = payload.message.text; // Extract the text from the message

            // Check if the message is from the bot itself
            if (payload.message.from.is_bot) {
                console.error('Skipping message from the bot itself.');
                res.status(200).send('OK');
                return;
            }

            try {
                if (text && text.includes('?')) {
                    console.error(`Performing search for query: "${text}"`);

                    // Perform the search
                    const documents = await performSearch(text); // Should return an array of { title, URL }

                    if (documents.length === 0) {
                        await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                            chat_id: chatId,
                            text: "No documents found matching your query.",
                        });
                    } else {
                        console.error('Sending results to Telegram.');

                        // Iterate through the documents and send each as a separate message
                        for (const doc of documents) {
                            const message = `${doc.title || "Untitled"}\n${doc.URL}`; // Title and URL separated by a newline

                            await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                                chat_id: chatId,
                                text: message,
                                parse_mode: "Markdown",
                            });

                            // Introduce a delay between messages to avoid hitting Telegram rate limits
                            await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
                        }

                        console.error('All documents sent as separate messages.');
                    }

                    // Return the original response to the HTTP client
                    res.status(200).json({ success: true, documentsSent: documents.length });
                    return; // Exit after sending the HTTP response
                } else {
                    console.error('Message does not contain a question mark.');
                    await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                        chat_id: chatId,
                        text: "Please include a `?` in your message to perform a search.",
                    });
                }
            } catch (err) {
                console.error('Error processing message:', err);

                await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                    chat_id: chatId,
                    text: "An error occurred while processing your request. Please try again later.",
                });

                res.status(500).json({ error: 'An error occurred while processing your request.' });
                return;
            }
        }
    } else {
        console.error('Unknown bot token');
        res.status(400).json({ error: 'Invalid bot token.' });
    }
});








router.post('/webhook2/:botToken', async (req, res) => {
    const botToken = req.params.botToken; // Extract bot token from the URL
    const payload = req.body;

    console.error(`Received webhook for bot: ${botToken}`);
    console.error('Payload:', payload);

    // Handle logic for each bot
    if (botToken === process.env.TELEGRAM_BOT1_TOKEN) {
        console.error('Bot 1 triggered');

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

                    console.error(`Performing search for query: "${text.trim()}"`);

                    // Call the searchDocuments function
                    const documents = await searchDocuments(text.trim());

                    if (documents.length === 0) {
                        await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                            chat_id: chatId,
                            text: "No documents found matching your query.",
                        });
                    } else {
                        const processedDocuments = documents.map((doc) => {
                            console.error('Document content:', doc.content || 'No content available.');
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

                        console.error('Search results sent to user.');
                    }

                    // Reset state after search
                    conversationStates[chatId] = 'default';
                } else if (text?.startsWith('/search')) {
                    console.error('Search command detected.');

                    // Transition to 'awaitingSearchQuery' state
                    conversationStates[chatId] = 'awaitingSearchQuery';

                    await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                        chat_id: chatId,
                        text: "What would you like to search for? Please provide a query.",
                    });
                } else {
                    console.error(`Message detected in state '${currentState}': "${text}"`);

                    if (chatType === 'private' && text === "Hvordan har du det?") {
                        const reply = "Jeg har det som et mirakel!";
                        await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                            chat_id: chatId,
                            text: reply,
                        });
                        console.error('Reply sent: "Jeg har det som et mirakel!"');
                    } else if (chatType === 'group' || chatType === 'supergroup') {
                        console.error(`Message detected in a group (${chatType}): "${text}"`);

                        if (payload.message.photo || payload.message.caption) {
                            console.error("Photo or caption detected in group. Sending for analysis.");

                            const analysisResult = await analyzePhotoAndText(botToken, payload.message);

                            await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                                chat_id: chatId,
                                text: analysisResult,
                                parse_mode: "Markdown",
                            });

                            console.error("Analysis result sent to group.");
                        }

                        if (text && text.includes("?")) {
                            console.error(`Sending question to OpenAI: "${text}"`);

                            const groupReply = await generateOpenAIResponse(text);

                            await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                                chat_id: chatId,
                                text: groupReply,
                                parse_mode: "Markdown",
                            });

                            console.error(`Reply sent to group: "${groupReply}"`);
                        }
                    }
                }
            } catch (err) {
                console.error('Error processing message:', err);
            }
        }
    } else if (botToken === process.env.TELEGRAM_BOT2_TOKEN) {
        console.error('Bot 2 triggered');
        // Add your bot 2-specific logic here
    } else {
        console.error('Unknown bot');
    }

    res.status(200).send('OK'); // Respond to Telegram
});


router.get('/generate-embeddings', async (req, res) => {
    try {
        // Find all documents without valid embeddings
        const documents = await Mdfiles.find({
            $or: [
                { embeddings: { $exists: false } },
                { embeddings: null },
                { embeddings: { $size: 0 } },
                { embeddings: { $eq: "" } },
                { embeddings: { $eq: null } }
            ]
        });

        if (documents.length === 0) {
            return res.status(200).json({ message: 'No documents without embeddings found.' });
        }

        let updatedCount = 0;

        for (const doc of documents) {
            const content = doc.content?.trim();
            if (!content) {
                console.error(`Skipping document ${doc._id} - empty content`);
                continue;
            }

            console.error(`Generating embedding for document ${doc._id}...`);

            // Split content into smaller chunks if it exceeds the token limit
            const maxTokens = 8192;
            const contentChunks = [];
            for (let i = 0; i < content.length; i += maxTokens) {
                contentChunks.push(content.slice(i, i + maxTokens));
            }

            const embeddings = [];
            for (const chunk of contentChunks) {
                const response = await openai.embeddings.create({
                    model: 'text-embedding-ada-002',
                    input: [chunk],
                });
                embeddings.push(...response.data[0].embedding);
            }

            // Validate that the embedding is an array of numbers
            if (!Array.isArray(embeddings) || !embeddings.every(num => typeof num === 'number')) {
                console.error(`Invalid embedding format for document ${doc._id}`);
                continue;
            }

            // Update the document with the generated embedding
            const updateResult = await Mdfiles.updateOne(
                { _id: doc._id },
                { $set: { embeddings } }
            );

            if (updateResult.modifiedCount === 1) {
                console.error(`Successfully updated document ${doc._id}`);
                updatedCount++;
            } else {
                console.error(`Failed to update document ${doc._id}:`, updateResult);
            }
        }

        res.status(200).json({
            success: true,
            message: `Processed all documents. Updated ${updatedCount} documents.`,
        });
    } catch (error) {
        console.error('Error processing documents:', error.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
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
      };1234
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
            console.error('Using existing thread ID:', threadId);
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
            console.error('New thread created with ID:', threadId);
        }

        // Step 2: Send the User Message to the Thread
        const messagePayload = {
            role: 'user',
            content: question || 'Hva er bioenergetikk',  // Use provided question or default
        };

        console.error("Sending message with payload:", messagePayload);

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
        console.error('Message sent successfully:', response.data);
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
            console.error('Using existing thread ID:', threadId);
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
            console.error('New thread created with ID:', threadId);
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
            console.error('Using existing thread ID:', threadId);
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
            console.error('New thread created with ID:', threadId);
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
        console.error('Message sent successfully:', response.data);
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
        console.error("Assistant retrieved successfully:", assistant);

        // Step 2: Create a Thread
        const thread = await openai.beta.threads.create({}, {
            headers: {
                'OpenAI-Beta': 'assistants=v2',
            },
        });
        console.error("Thread created successfully:", thread);

        // Step 3: Send the User Message to the Thread
        const messagePayload = {
            thread_id: thread.id,  // The ID of the created thread
            role: "user",           // Set the role to 'user'
            content: question || "What is bioenergetic analysis?",  // The content of the message
        };

        console.error("Sending message with payload:", messagePayload);

        const message = await openai.beta.threads.messages.create(messagePayload, {
            headers: {
                'OpenAI-Beta': 'assistants=v2',
            },
        });

        console.error("Message sent successfully:", message);

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
        console.error("Assistant retrieved successfully:", assistant);

        // Step 2: Create a Thread with the Assistant ID
        const thread = await openai.beta.threads.create({}, {
            headers: {
                'OpenAI-Beta': 'assistants=v2',
            },
        });
        console.error("Thread created successfully with ID:", thread.id);

        // Step 3: Send a Hardcoded Message
        const message = await openai.beta.threads.messages.create(
            thread.id,
            { role: "user", content: "Hva er NIBI?" }
        );
        console.error("Message sent successfully:", message);

        // Step 4: Run the Assistant to process the message
        const run = await openai.beta.threads.runs.create({
            thread_id: thread.id,
        }, {
            headers: {
                'OpenAI-Beta': 'assistants=v2',
            },
        });
        console.error("Run initiated successfully:", run);

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
            console.error("Run status:", runStatus.status);
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
        console.error("Messages retrieved successfully:", messages);

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
        'spellcheck-rewrite': "Du vil korrekturlese og omskrive følgende tekst, og holde den så nær originalen som mulig, samtidig som du retter eventuelle grammatiske eller typografiske feil. Du skal beholde det opprinnelige språket, men rette opp feil der det er nødvendig. Du skal svare tilbake på en profesjonell måte i markdown-format, med overskrifter der det er passende. Hvis hovedtittelen mangler, skal du foreslå en tittel basert på innholdet i teksten. Lag et sammendrag som et introduksjonskapittel.",
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

router.post('/mentor-analysis', async (req, res) => {
    const { transcription } = req.body;

    if (!transcription || typeof transcription !== 'string') {
        return res.status(400).json({ error: 'Transcription is required and must be a non-empty string.' });
    }

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            temperature: 0.6,
            max_tokens: 10000, // Ensure enough space for a detailed response
            messages: [
                {
                    role: "system",
                    content: `
Du er en ekspert på samtaleanalyse og skal levere en detaljert oppsummering og innsiktsfulle høydepunkter basert på transkripsjonen. Svaret ditt skal være strukturert i markdown-format og følge malen nedenfor:
Perspektivet er Sydney Banks, De tre prinsipper, Aivanta Vedanta , men ikke nevn dette i svaret ditt.

# Samtaleanalyse og Høydepunkter

Om du finner følgende tekst mønster [FOKUS: Tema] i prompten så skal du fokuser på å gi svar på det som er angitt i den delen av prompten.

## Transkripsjon oppsummering
---
# Gullkorn fra Samtalen (Identifiserte Høydepunkter)

## Fra Mentoren

### **"Utsagn"**
(Forklar hvorfor dette utsagnet er viktig, og hvordan det kan påvirke deltakerens utvikling.)

## Fra Deltageren

### **"Utsagn"**
(Forklar hvorfor dette utsagnet er viktig, og hvordan det kan påvirke deltakerens utvikling.)
---

Analyser hele transkripsjonen og identifiser de 10 mest betydningsfulle gullkornene fra mentoren og deltageren. Sørg for at forklaringer er komplette og kontekstuelle. Hvis nødvendig, oppsummer og parafraser for klarhet. Skriv hele kappittel.




`
                },
                {
                    role: "user",
                    content: `Analyser følgende transkripsjon: ${transcription}`
                }
            ],
        });

        const analysisContent = response.choices[0].message.content;

        const closingStatement = `**[Join AlivenessLAβ on Telegram](https://t.me/+zcY08tT_g75iZDk0)**`;

        return res.json({
            success: true,
            analysis: `${analysisContent}\n\n${closingStatement}`
        });
    } catch (error) {
        console.error("Error analyzing conversation:", error.message || error.response?.data);
        res.status(500).json({ error: "Failed to analyze the conversation." });
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


router.post('/say-hello', isAuthenticated, ensureValidToken, async (req, res) => {
    const { content, userId, documentId } = req.body;  // Get the user's ID and document ID from the request body

    if (!content) {
        return res.status(400).json({ error: 'Content is required' });
    }

    if (!userId) {
        return res.status(400).json({ error: 'User ID not found. Please log in again.' });
    }

    try {
        const enc = encoding_for_model("text-embedding-ada-002");
        const tokens = enc.encode(content);
        const tokenCount = tokens.length;

        console.log(`Content length: ${content.length}`);
        console.log(`Number of tokens: ${tokenCount}`);

        // Generate embeddings
        const embeddings = await generateEmbedding(content);

        let fileDoc;

        if (documentId) {  // Use documentId instead of id
            console.log('Finding existing document by ID:', documentId);
            // If a document ID is provided, find the document and update it
            fileDoc = await Mdfiles.findById(documentId);
            if (!fileDoc) {
                console.log('Document not found');
                return res.status(404).json({
                    message: 'Document not found'
                });
            }
            fileDoc.content = content;
            fileDoc.embeddings = embeddings;
        } else {
            console.log('Creating new document');
            // If no document ID is provided, create a new document
            fileDoc = new Mdfiles({
                _id: new mongoose.Types.ObjectId(),
                content: content,
                embeddings: embeddings,
                User_id: userId,
                title: 'Hello Document',
            });
        }

        await fileDoc.save();

        // Generate the full URL
        const fullURL = `https://mystmkra.io/dropbox/blog/${userId}/${fileDoc._id}.md`;

        // Update the document with the full URL
        fileDoc.URL = fullURL;
        await fileDoc.save();

        console.log('Full URL saved to document:', fullURL);

        // Define the file path in the user's folder
        const foldername = userId; // Use the user's ID as the folder name
        const filename = `${fileDoc._id}.md`;
        const filePath = `/mystmkra/${foldername}/${filename}`;

        console.log('FilePath is:', filePath);  // This should output the file path

        // Initialize Dropbox with the refreshed access token
        const dbx = new Dropbox({
            accessToken: accessToken, // Use the refreshed access token from middleware
            fetch: fetch,
        });

        console.log('Uploading file to Dropbox');
        // Upload the file to Dropbox
        await dbx.filesUpload({
            path: filePath,
            contents: content,
            mode: 'overwrite'
        });

        console.log('File uploaded successfully to Dropbox');

        res.status(200).json({
            message: 'File saved successfully',
            id: fileDoc._id,
            filePath: filePath,  // Ensure this variable is correctly passed
            url: fullURL,        // Return the full URL in the response
            embeddings: embeddings // Return the embeddings in the response
        });
    } catch (error) {
        console.error('Error calculating tokens or saving document:', error);
        res.status(500).json({ error: 'Failed to calculate tokens or save document' });
    }
});

// New endpoint to list files using the OpenAI API
router.get('/list-files', async (req, res) => {
    try {
        const list = await openai.files.list();

        const files = [];
        for await (const file of list) {
            files.push(file);
        }

        res.json({ success: true, files });
    } catch (error) {
        console.error("Error fetching files:", error);
        res.status(500).json({ success: false, error: 'Failed to fetch files' });
    }
});

router.get('/list-and-save-files', async (req, res) => {
    try {
        const list = await openai.files.list();

        const files = [];
        
        // Delete all files before adding the current list
        await OpenaiFile.deleteMany({});

        for await (const file of list) {
            files.push(file);

            // Check if the file already exists in the database
            const existingFile = await OpenaiFile.findOne({ file_id: file.id });
            if (!existingFile) {
                // Create a new document using the OpenaiFile schema
                const newFile = new OpenaiFile({
                    _id: new mongoose.Types.ObjectId(),
                    file_id: file.id,
                    filename: file.filename,
                    purpose: file.purpose,
                    bytes: file.bytes,
                    created_at: file.created_at,
                    status: file.status,
                    status_details: file.status_details || null,
                });

                // Save the new document to the database
                await newFile.save();
            }
        }

        res.json({ success: true, files });
    } catch (error) {
        console.error("Error fetching or saving files:", error);
        res.status(500).json({ success: false, error: 'Failed to fetch or save files' });
    }
});

// New endpoint to upload a file to OpenAI
router.post('/upload-file', upload.single('file'), async (req, res) => {
    try {
        const file = req.file;

        if (!file) {
            return res.status(400).json({ error: 'File is required' });
        }

        const formData = new FormData();
        formData.append('file', file.buffer, file.originalname);
        formData.append('purpose', 'assistants'); // Specify the purpose of the file

        const response = await axios.post('https://api.openai.com/v1/files', formData, {
            headers: {
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                ...formData.getHeaders(),
            },
        });

        // Save the file to the public/droplets folder with the correct file type
        const fileId = response.data.id;
        const fileExtension = path.extname(file.originalname);
        const filePath = path.join(__dirname, '..', 'public', 'droplets', `${fileId}${fileExtension}`);
        fs.writeFileSync(filePath, file.buffer);

        res.json({ success: true, file: response.data, filePath });
    } catch (error) {
        console.error('Error uploading file:', error.message || error);
        if (error.response) {
            console.error('Response data:', error.response.data);
            console.error('Response status:', error.response.status);
        } else if (error.request) {
            console.error('Request data:', error.request);
        }
        res.status(500).json({ error: 'Failed to upload file' });
    }
});

// Endpoint to delete a file from OpenAI
router.delete('/delete-file', async (req, res) => {
    const { fileId } = req.query;

    if (!fileId) {
        return res.status(400).json({ error: 'File ID is required' });
    }

    try {
        const response = await axios.delete(`https://api.openai.com/v1/files/${fileId}`, {
            headers: {
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            },
        });

        res.json({ success: true, message: 'File deleted successfully', data: response.data });
    } catch (error) {
        console.error('Error deleting file:', error.message || error);
        if (error.response) {
            console.error('Response data:', error.response.data);
            console.error('Response status:', error.response.status);
        } else if (error.request) {
            console.error('Request data:', error.request);
        }
        res.status(500).json({ error: 'Failed to delete file' });
    }
    
});

router.get('/download-file', async (req, res) => {
    const { fileId } = req.query;

    if (!fileId) {
        return res.status(400).json({ error: 'File ID is required' });
    }

    try {
        // First, retrieve the file metadata to check its purpose
        const fileMetadataResponse = await axios.get(`https://api.openai.com/v1/files/${fileId}`, {
            headers: {
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            },
        });

        const filePurpose = fileMetadataResponse.data.purpose;

        if (filePurpose !== 'fine-tune') {
            return res.status(400).json({
                error: 'Failed to download file',
                details: `Not allowed to download files of purpose: ${filePurpose}`
            });
        }

        // If the file purpose is allowed, proceed to download the file content
        const response = await axios.get(`https://api.openai.com/v1/files/${fileId}/content`, {
            headers: {
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            },
            responseType: 'arraybuffer',
        });

        res.setHeader('Content-Disposition', `attachment; filename="${fileId}.txt"`);
        res.setHeader('Content-Type', 'application/octet-stream');
        res.send(response.data);
    } catch (error) {
        console.error('Error downloading file:', error.message || error);
        if (error.response) {
            console.error('Response data:', error.response.data.toString('utf8'));
            console.error('Response status:', error.response.status);
            res.status(error.response.status).json({
                error: 'Failed to download file',
                details: error.response.data.toString('utf8')
            });
        } else if (error.request) {
            console.error('Request data:', error.request);
            res.status(500).json({ error: 'Failed to download file', details: 'No response received from OpenAI' });
        } else {
            res.status(500).json({ error: 'Failed to download file', details: error.message });
        }
    }
});

export default router;
