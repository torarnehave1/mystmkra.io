import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import pdf from 'pdf-parse';
import path from 'path';
import { fileURLToPath } from 'url';

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