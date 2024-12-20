// script.js
const editor = document.getElementById('editor');
const keyboard = document.querySelector('.keyboard');

keyboard.addEventListener('click', (event) => {
    if (event.target.tagName === 'BUTTON') {
        const value = event.target.dataset.value;
        insertAtCursor(value);
    }
});

function insertAtCursor(text) {
    const selection = window.getSelection();
    if (!selection.rangeCount) {
        const buttonDiv = document.createElement('div');
        buttonDiv.className = 'inline-button';
        buttonDiv.textContent = text;
        buttonDiv.contentEditable = 'false';
        editor.appendChild(buttonDiv); //If no selection, just append
        return;
    }

    const range = selection.getRangeAt(0);
    range.deleteContents(); //Delete any selected content

    const buttonDiv = document.createElement('div');
    buttonDiv.className = 'inline-button';
    buttonDiv.textContent = text;
    buttonDiv.contentEditable = 'false';
    range.insertNode(buttonDiv);

    range.setStartAfter(buttonDiv); // Move cursor to the end of inserted text
    range.collapse(true); // Collapse the range (no selection)
    selection.removeAllRanges();
    selection.addRange(range);

    editor.focus();
}

// Handle initial placeholder text
editor.addEventListener('focus', () => {
    if (editor.textContent === "Type here...") {
        editor.textContent = "";
    }
});

editor.addEventListener('blur', () => {
    if (editor.textContent === "") {
        editor.textContent = "Type here...";
    }
});