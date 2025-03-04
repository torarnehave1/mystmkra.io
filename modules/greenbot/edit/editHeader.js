
import Process from '../../../models/process.js';

/**
 * Updates the process header fields.
 * @file services/greenbot/edit/editHeader.js
 * @module editHeader
 * @param {String} processId - The ID of the process.
 * @param {Object} newHeaderData - An object with keys for title, description, and/or imageUrl.
 * @returns {Promise<Object>} - The updated process document.
 * 
 * @description This module contains a function to edit the header fields of a process.
 * It exports the editProcessHeader function, which updates the title, description, and/or imageUrl
 * of a process based on the provided newHeaderData object.
 * The function returns the updated process document.
 * @see {@link module:processArchPublish}
 * @see {@link module:connectProcess}
 * @see {@link module:inputValidator}
 * @see {@link module:ViewProcessHeader}
 * @see {@link module:answerService}
 * @see {@link module:processService}
 */

export async function editProcessHeader(processId, newHeaderData) {
  try {
    const process = await Process.findById(processId);
    if (!process) {
      throw new Error('Process not found');
    }
    // Update header fields if provided
    if (newHeaderData.title !== undefined) {
      process.title = newHeaderData.title;
    }
    if (newHeaderData.description !== undefined) {
      process.description = newHeaderData.description;
    }
    if (newHeaderData.imageUrl !== undefined) {
      process.imageUrl = newHeaderData.imageUrl;
    }
    await process.save();
    return process;
  } catch (error) {
    throw new Error(`Failed to edit process header: ${error.message}`);
  }
}
