import Mdfiles from '../models/Mdfiles.js';
import OpenAI from 'openai';

const openai = new OpenAI(); // Initialize OpenAI instance

/**
 * Generate an embedding for the given text using OpenAI.
 * @param {string} text - The text content to generate embeddings for.
 * @returns {Promise<Array>} - The generated embedding as an array of numbers.
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

/**
 * Search documents based on similarity to the query embedding.
 * @param {string} query - The search query text.
 * @returns {Promise<Array>} - An array of documents sorted by similarity.
 */
export default async function searchDocuments(query) {
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
            { $limit: 2 },
            {
              $project: {
                contentSnippet: {
                  $substr: [
                    {
                      $toString: {
                        $ifNull: ['$content', 'No content available.']
                      }
                    },
                    0,
                    50
                  ]
                },
                similarity: 1,
                
              }
            }
          ]);
          
          
          

        return documents;
    } catch (error) {
        console.error('Error in searchDocuments:', error);
        throw new Error('Failed to search documents');
    }
}

