import { marked } from 'https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js';
//import hljs from 'https://cdn.jsdelivr.net/npm/highlight.js@11.7.0/es/highlight.min.js';



// Custom renderer for Markdown
const renderer = new marked.Renderer();

function extractText(token) {
    if (typeof token === 'string') {
        return token;
    }
    if (token && typeof token === 'object' && token.text) {
        return token.text;
    }
    return String(token);
}

// Rendering headings
renderer.heading = (token) => {
    const text = extractText(token);
    const level = token.depth || 1;
    console.log(`Rendering heading level ${level}: ${text}`);
    return `<div class="griditem"><h${level}>${text}</h${level}></div>`;
};

// Rendering paragraphs
renderer.paragraph = (text) => {
    if (Array.isArray(text.tokens)) {
        text = text.tokens.map(t => {
            if (t.type === 'strong') {
                return `<strong>${extractText(t)}</strong>`;
            } else if (t.type === 'image') {
                return `<img src="${t.href}" alt="${t.text}" title="${t.title || ''}">`;
            }
            return extractText(t);
        }).join('');
    } else {
        text = extractText(text);
    }

    console.log('Rendering paragraph:', text);
    if (text.includes('<img')) {
        return `<div class="griditemimg">${text}</div>`;
    } else {
        return `<div class="griditem">${text}</div>`;
    }
};

// Rendering code blocks with syntax highlighting


renderer.code = (token) => {
    const code = token.text;
    const lang = token.lang || '';

    if (typeof code !== 'string') {
        console.error('Expected code to be a string but received:', token);
        return '';
    }

    const lines = code.split('\n');
    const result = lines.map(line => {
        const lineTrimmed = line.trim();
        if (lineTrimmed.startsWith('function') || lineTrimmed.startsWith('class')) {
            return `<div class="code-line function">${line}</div>`;
        } else if (lineTrimmed.startsWith('//')) {
            return `<div class="code-line comment">${line}</div>`;
        } else if (lineTrimmed.startsWith('const') || lineTrimmed.startsWith('let') || lineTrimmed.startsWith('var')) {
            return `<div class="code-line variable">${line}</div>`;
        } else {
            return `<div class="code-line">${line}</div>`;
        }
    }).join('');

    // Generate a unique ID for each code block
    const uniqueId = `copy-button-${Math.random().toString(36).substr(2, 9)}`;

    return `
        <div class="code-block">
            <button class="copy-button" id="${uniqueId}">Copy</button>
            <pre><code class="language-${lang}">${result}</code></pre>
        </div>
    `;
};




// Set up marked with the custom renderer
marked.use({ renderer });

// Initialize the Markdown editor
document.addEventListener('DOMContentLoaded', function() {
    const textarea = document.getElementById('markdownTextarea');
    const preview = document.getElementById('previewContent');

    function updatePreview() {
        const markdownText = textarea.value;
        const htmlContent = marked(markdownText);
        preview.innerHTML = htmlContent;

        // Attach event listeners to all copy buttons after rendering
        document.querySelectorAll('.copy-button').forEach(button => {
            button.addEventListener('click', () => {
                // Find the code block associated with the copy button
                const codeBlock = button.nextElementSibling.querySelector('code');
                
                // Create a temporary textarea element to copy the text content
                const tempTextarea = document.createElement('textarea');
                tempTextarea.value = codeBlock.innerText; // Get the text content of the code block
                document.body.appendChild(tempTextarea);
                
                // Select the text inside the textarea and copy it
                tempTextarea.select();
                document.execCommand('copy');
                
                // Remove the temporary textarea element
                document.body.removeChild(tempTextarea);

                // Provide feedback to the user that the content has been copied
                button.textContent = 'Copied!';
                setTimeout(() => {
                    button.textContent = 'Copy';
                }, 2000); // Reset the button text after 2 seconds
            });
        });
    }

    textarea.addEventListener('input', updatePreview);
    updatePreview(); // Initial render
});
