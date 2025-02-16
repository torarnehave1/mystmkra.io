// helpers.js

import mongoose from 'mongoose'; // Import mongoose to use ObjectId validation

// Helper: Get translation
export const getTranslation = (language, key, placeholders = {}, translations) => {
   // console.log('[DEBUG] Inside getTranslation:', { language, key, translations });
  
    const translation = translations[language]?.[key] || key;
   // console.log('[DEBUG] Retrieved Translation:', translation);
  
    const formattedTranslation = translation.replace(/\{(\w+)\}/g, (_, placeholder) => placeholders[placeholder] || `{${placeholder}}`);
   // console.log('[DEBUG] Formatted Translation:', formattedTranslation);
  
    return formattedTranslation;
  };
  
  
  // Helper: Extract processId
  export const extractProcessId = (data) => {
    const parts = data.split('_');
    console.log(`[DEBUG] extractProcessId: data="${data}", parts="${parts}"`);
    return parts.slice(2).join('_'); // Extract the parts after the first two as processId
  };
  
  // Helper: Extract step type and processId
  export const extractStepTypeAndProcessId = (data) => {
    const parts = data.split('_');
    console.log(`[DEBUG] extractStepTypeAndProcessId: data="${data}", parts="${parts}"`);
    const type = parts.slice(2, -1).join('_'); // Extract step type
    const processId = parts.slice(-1)[0]; // Extract processId
    return { type, processId };
  };
  
  // Helper: Validate processId
  export const isValidProcessId = (processId) => {
    return mongoose.Types.ObjectId.isValid(processId); // Validate using mongoose ObjectId
  };

/**
 * Extract process ID from callback data.
 * @param {String} data - Callback data string.
 * @returns {String|null} - Extracted process ID or null if not found.
 */
export const extractProcessIdFromCallbackData = (data) => {
  const parts = data.split('_');
  return parts.length > 2 ? parts[2] : null;
};

/**
 * Extract process ID and step index from callback data.
 * @param {String} data - Callback data string.
 * @returns {Object|null} - Extracted process ID and step index or null if not found.
 */
export const extractProcessIdAndStepIndexFromCallbackData = (data) => {
  const match = data.match(/(?:edit_prompt_|edit_type_|edit_step_description_|next_review_step_|previous_review_step_)([0-9a-fA-F]{24})_(\d+)/);
  return match ? { processId: match[1], stepIndex: parseInt(match[2]) } : null;
};
