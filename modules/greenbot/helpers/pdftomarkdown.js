import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import pdf from 'pdf-parse';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * @file services/greenbot/helpers/pdftomarkdown.js
 * @module pdftomarkdown
 * @param {string} pdfPath - The path to the PDF file.
 * @returns {Promise<string>} - A Promise that resolves with the path to the generated Markdown file.
 * @throws {Error} - If an error occurs during the conversion process.
 * @description This module converts a PDF file to a Markdown file.
 * @example
 * import { convertPdfToMarkdown } from './services/greenbot/helpers/pdftomarkdown.js';
 * const pdfPath = 'example.pdf';
 * convertPdfToMarkdown(pdfPath)
 *  .then((markdownPath) => {
 *   console.log(`Markdown file generated at: ${markdownPath}`);
 * })
 * 
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to convert PDF to Markdown
async function convertPdfToMarkdown(pdfPath) {
    try {
        // Read the PDF file
        const dataBuffer = readFileSync(pdfPath);
        
        // Parse the PDF
        const data = await pdf(dataBuffer);
        
        // Extract text content
        let text = data.text;
        
        // Basic Markdown formatting
        // Replace multiple newlines with double newlines for Markdown paragraphs
        text = text.replace(/\n{2,}/g, '\n\n');
        
        // Simple header detection (lines that are all caps could be headers)
        text = text.replace(/^([A-Z\s]{2,})$/gm, '# $1');
        
        // Convert to Markdown format
        const markdownContent = `# Document from ${pdfPath.split('/').pop()}\n\n${text}`;
        
        // Write to output file

        const outputPath = path.join(__dirname, '..', 'public', 'telegram_files');

        if (!existsSync(outputPath)) {
            console.log('[DEBUG ALT 4] Creating download directory');
            mkdirSync(outputPath, { recursive: true });
        }

        const outputFilePath = path.join(outputPath, `${path.basename(pdfPath, '.pdf')}.md`);
        writeFileSync(outputFilePath, markdownContent);

        console.log(`Successfully converted ${pdfPath} to ${outputFilePath}`);
        return outputFilePath;
    } catch (error) {
        console.error('Error converting PDF to Markdown:', error);
        throw error;
    }
}

export { convertPdfToMarkdown };