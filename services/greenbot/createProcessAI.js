import OpenAI from 'openai';
import Process from '../../models/process.js';
import config from '../../config/config.js';

const openai = new OpenAI({
  apiKey: config.openaiApiKey,
});

/**
 * Generates structured steps dynamically based on a process title and description.
 * @param {String} processId - The MongoDB document ID of the process.
 * @param {String} title - The title of the process.
 * @param {String} description - A detailed description of the process.
 * @returns {Object} Updated process with generated steps.
 */
async function handleCreateProcessAI(processId, title, description) {
  const systemMessage = `You are an AI that generates structured steps for different types of processes.
  Your goal is to create a logical sequence of steps based on the given title and description.
  
  **Rules to follow:**
  - Steps must be **clear, structured, and relevant** to the process.
  - Ensure a **natural progression** from start to finish.
  - Use a **variety of step types** (text input, multiple-choice, yes/no, file upload).
  - Provide a detailed description for each step to help the user understand how to complete it.
  - The response **MUST** follow this exact JSON schema:

  {
    "steps": [
      {
        "stepId": "String",
        "type": "String",
        "prompt": "String",
        "description": "String",
        "options": [String], 
        "validation": {
          "required": Boolean,
          "regex": String,
          "fileTypes": [String]
        },
        "metadata": {
          "numQuestions": Number
        },
        "stepSequenceNumber": Number
      }
    ]
  }

  **Step Type Guide:**
  - "text_process": Open-ended input (e.g., "Describe your goal.")
  - "yes_no_process": Simple yes/no selection.
  - "choice": Multiple-choice question (e.g., "Select your preferred option").
  - "file_process": Requires file upload (e.g., "Upload your business plan").
  - "generate_questions_process": AI-generated follow-up questions.
  - "final": Marks the last step in the process.
  - "info_process": Provides information to the user without requiring input.
  - "sound": Requires sound URL or a file upload input.
  - "call_to_action": Prompts the user to take a specific action.
  - Feel free to mix and match these types to create a comprehensive process.
  
  **Now generate a structured list of steps for the process below:**
  Title: "${title}"
  Description: "${description}"
  `;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: `Generate structured steps for: "${title}".` }
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });

    let stepsData;
    try {
      stepsData = JSON.parse(response.choices[0].message.content);
    } catch (parseError) {
      console.error(`[ERROR] Failed to parse AI response JSON: ${parseError.message}`);
      throw new Error('Invalid JSON format returned by AI.');
    }

    const steps = Array.isArray(stepsData.steps)
      ? stepsData.steps.map((step, index) => ({
          ...step,
          stepId: `step_${Date.now()}_${Math.floor(Math.random() * 1000)}`, // Generates a unique step ID
          stepSequenceNumber: index + 1,
        }))
      : [];

    if (!steps.length) {
      throw new Error('AI response did not contain valid steps.');
    }

    const process = await Process.findById(processId);
    if (!process) {
      throw new Error(`Process with ID ${processId} not found.`);
    }

    process.steps = steps;
    await process.save();

    console.log(`[SUCCESS] Process ${processId} updated with new steps.`);
    return process;
  } catch (error) {
    console.error(`[ERROR] Failed to generate steps: ${error.message}`);
    throw error;
  }
}

export default handleCreateProcessAI;
