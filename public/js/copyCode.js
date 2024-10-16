function copyCode(button) {
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
}
