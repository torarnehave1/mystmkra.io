const fs = require('fs');
const pdf = require('pdf-parse');

// Function to convert PDF to Markdown
async function convertPdfToMarkdown(pdfPath, outputPath) {
    try {
        // Read the PDF file
        const dataBuffer = fs.readFileSync(pdfPath);
        
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
        fs.writeFileSync(outputPath, markdownContent);
        
        console.log(`Successfully converted ${pdfPath} to ${outputPath}`);
    } catch (error) {
        console.error('Error converting PDF to Markdown:', error);
    }
}

// Example usage
const pdfPath = 'input.pdf';      // Replace with your PDF file path
const outputPath = 'output.md';   // Output Markdown file

convertPdfToMarkdown(pdfPath, outputPath);