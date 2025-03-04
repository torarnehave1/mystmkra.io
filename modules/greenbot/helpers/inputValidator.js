import mongoose from 'mongoose';
import axios from 'axios';
import Process from '../models/process.js';

/**
 * @file services/greenbot/helpers/inputValidator.js
 * @module inputValidator
 * @description Contains input validation functions for user input.
 */



/**
 * ✅ Validate if a given process ID exists in the database.
 * @param {string} processId - The process ID to validate.
 * @returns {Promise<boolean>} True if valid, false otherwise.
 */
export async function isValidProcessId(processId) {
  if (!mongoose.Types.ObjectId.isValid(processId)) {
    return false; // Not a valid MongoDB ObjectId format
  }
  const process = await Process.findById(processId);
  return !!process; // Returns true if process exists, false otherwise
}

/**
 * ✅ Validate if a given URL is a valid image URL.
 * - Checks if URL format is valid.
 * - Fetches the URL and verifies if it's an image.
 *
 * @param {string} url - The image URL to validate.
 * @returns {Promise<boolean>} True if it's a valid image, false otherwise.
 */
export async function isValidImageUrl(url) {
  try {
    new URL(url); // Throws an error if not a valid URL

    const response = await axios.head(url, { timeout: 5000 });
    const contentType = response.headers['content-type'];
    return contentType && contentType.startsWith('image/');
  } catch (error) {
    console.error(`🔴 Invalid image URL: ${url}`, error.message);
    return false;
  }
}

/**
 * ✅ Validate required text input fields.
 * @param {string} input - The user input to check.
 * @returns {boolean} True if input is valid, false otherwise.
 */
export function isValidText(input) {
  return typeof input === 'string' && input.trim().length > 0;
}

/**
 * ✅ Validate email format.
 * @param {string} email - The email to validate.
 * @returns {boolean} True if valid email format, false otherwise.
 */
export function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * ✅ Validate numeric input.
 * @param {string|number} input - The input to validate.
 * @returns {boolean} True if it's a valid number, false otherwise.
 */
export function isValidNumber(input) {
  return !isNaN(input) && isFinite(input);
}
