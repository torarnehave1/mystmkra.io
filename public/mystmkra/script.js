import marked from 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';

const markdownTextarea = document.getElementById('markdownTextarea');
const previewGrid = document.getElementById('previewgrid');

// Custom renderer to avoid wrapping images in paragraphs
const renderer = new marked.Renderer();

renderer.paragraph = (text) => {
    if (text.includes('<img')) {
        return `<div class="griditemimg">${text}</div>`;
    } else {
        return `<div class="griditem">${text}</div>`;
    }
};

renderer.heading = (text, level) => {
    return `<div class="griditem"><h${level}>${text}</h${level}></div>`;
};

renderer.list = (body, ordered) => {
    const type = ordered ? 'ol' : 'ul';
    return `<div class="griditem"><${type}>${body}</${type}></div>`;
};

renderer.listitem = (text) => {
    return `<li class="griditem">${text}</li>`;
};

renderer.code = (code, infostring, escaped) => {
    return `<div class="griditem"><pre><code class="language-${infostring}">${code}</code></pre></div>`;
};

renderer.hr = () => {
    return `<div class="griditem"><hr></div>`;
};

marked.use({ renderer });

export function updatePreviewFromButtonClick() {
    console.log('updatePreviewFromButtonClick called');
    const markdownContent = markdownTextarea.value;
    console.log('Markdown content:', markdownContent);
    const htmlContent = marked.parse(markdownContent);
    previewGrid.innerHTML = htmlContent;
    console.log('HTML content:', htmlContent);
    applyGridClasses();
}

export function updatePreviewFromInput() {
    console.log('updatePreviewFromInput called');
    const markdownContent = markdownTextarea.value;
    console.log('Markdown content:', markdownContent);
    const htmlContent = marked.parse(markdownContent);
    previewGrid.innerHTML = htmlContent;
    console.log('HTML content:', htmlContent);
    applyGridClasses();
}

function applyGridClasses() {
    console.log('applyGridClasses called');
    const images = previewGrid.querySelectorAll('img');
    const idCount = {}; // Object to keep track of ID occurrences

    images.forEach((img) => {
        const url = img.src;
        // Extract the part of the URL between the last two slashes
        const idMatch = url.match(/\/([^\/]+)\/[^\/]+$/);
        const baseId = idMatch ? idMatch[1].replace(/\s+/g, '-').toLowerCase() : '';

        // Initialize or increment the ID count
        if (!idCount[baseId]) {
            idCount[baseId] = 0;
        }
        idCount[baseId] += 1;

        // Construct the unique ID with the index
        const uniqueId = `${baseId}-${idCount[baseId]}`;
        img.id = uniqueId;

        console.log('URL:', url);
        console.log('Extracted ID:', baseId);
        console.log('Assigned ID:', img.id);
    });
}

function insertTextAtCursor(text) {
    console.log('insertTextAtCursor called');
    const start = markdownTextarea.selectionStart;
    const end = markdownTextarea.selectionEnd;
    const currentText = markdownTextarea.value;

    console.log('Current text:', currentText);
    console.log('Selection start:', start);
    console.log('Selection end:', end);

    const before = currentText.substring(0, start);
    const after = currentText.substring(end);

    console.log('Text before cursor:', before);
    console.log('Text after cursor:', after);

    markdownTextarea.value = before + text + after;
    console.log('New text:', markdownTextarea.value);

    markdownTextarea.selectionStart = markdownTextarea.selectionEnd = start + text.length;

    console.log('New selection start:', markdownTextarea.selectionStart);
    console.log('New selection end:', markdownTextarea.selectionEnd);

    markdownTextarea.focus();
    updatePreviewFromButtonClick(); // Call the new function
}

export function insertHashTaglist() {
    insertTextAtCursor('\n```markdown\n#SlowYou #SelfCare #AI #Nature #Aliveness #AlivenssLAB\n```\n');
}

export function insertHeading1() {
    console.log('insertHeading1 called');
    insertTextAtCursor('\n\n## This is heading one\n');
}

export function insertHeading2() {
    console.log('insertHeading2 called');
    insertTextAtCursor('\n\n### This is heading two\n');
}

export function insertHeading3() {
    console.log('insertHeading3 called');
    insertTextAtCursor('\n\n#### This is heading three\n');
}

export function insertHeading4() {
    console.log('insertHeading4 called');
    insertTextAtCursor('\n\n##### This is heading four\n');
}

export function insertBold() {
    console.log('insertBold called');
    insertTextAtCursor('**bold text**');
}

export function insertItalic() {
    console.log('insertItalic called');
    insertTextAtCursor('*italic text*');
}

export function insertLink() {
    console.log('insertLink called');
    insertTextAtCursor('[link text](url)');
}

export function insertImage() {
    console.log('insertImage called');
    insertTextAtCursor('![alt text](https://cdn.midjourney.com/bd7b3b48-777a-4013-9ed0-25accc6a090b/0_0.png)');
}

export function insertOrderedList() {
    console.log('insertOrderedList called');
    insertTextAtCursor('\n1. First item\n2. Second item\n3. Third item\n');
}

export function insertUnorderedList() {
    console.log('insertUnorderedList called');
    insertTextAtCursor('\n- First item\n- Second item\n- Third item\n');
}

export function insertCode() {
    console.log('insertCode called');
    insertTextAtCursor('\n```markdown\n#SlowYou #SelfCare #AI #Nature #Aliveness #AlivenssLAB\n```\n');
}

export function insertHorizontalRule() {
    console.log('insertHorizontalRule called');
    insertTextAtCursor('\n---\n');
}

// Ensure event listeners are only added once
function attachEventListeners() {
    console.log('attachEventListeners called');
    document.getElementById('insertHashTaglist').addEventListener('click', insertHashTaglist);
    document.getElementById('insertHeading1').addEventListener('click', insertHeading1);
    document.getElementById('insertHeading2').addEventListener('click', insertHeading2);
    document.getElementById('insertHeading3').addEventListener('click', insertHeading3);
    document.getElementById('insertHeading4').addEventListener('click', insertHeading4);
    document.getElementById('insertBold').addEventListener('click', insertBold);
    document.getElementById('insertItalic').addEventListener('click', insertItalic);
    document.getElementById('insertLink').addEventListener('click', insertLink);
    document.getElementById('insertImage').addEventListener('click', insertImage);
    document.getElementById('insertOrderedList').addEventListener('click', insertOrderedList);
    document.getElementById('insertUnorderedList').addEventListener('click', insertUnorderedList);
    document.getElementById('insertCode').addEventListener('click', insertCode);
    document.getElementById('insertHorizontalRule').addEventListener('click', insertHorizontalRule);
}

// Update preview when user inputs text directly
markdownTextarea.addEventListener('input', updatePreviewFromInput);

// Attach event listeners once
attachEventListeners();

// Initial preview update
console.log('Initial preview update');
updatePreviewFromInput();
