document.addEventListener('DOMContentLoaded', () => {
    const markdownTextarea = document.getElementById('markdownTextarea');
    const progressBarContainer = document.querySelector('.progress-bar-container');

    let debounceTimer;

    markdownTextarea.addEventListener('keydown', function(event) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async function() {
        const value = markdownTextarea.value;

        const matchCreateImage = value.match(/^\s*\/\/\s*CIMG\s*(.+?)\s*\?$/im);
        const matchQuestion = value.match(/^\s*\/\/\s*QTEXT\s*(.+?)\s*\?$/im);
        const matchRewrite = value.match(/^\s*\/\/\s*QRW\s*$/im);
        const matchWriteImgPrompt = value.match(/^\s*\/\/\s*AIMG\s*$/im);
        const matchTag = value.match(/\/\/TAG:(.+)!/); // Updated pattern to handle //TAG:TAGNAME!

        try {
            // Handle //CIMG command: Create an image from the given prompt
            if (matchCreateImage && matchCreateImage[1].trim() && !value.includes('<iframe')) {
                const prompt = matchCreateImage[1].trim();
                if (prompt) {
                    if (progressBarContainer) {
                        progressBarContainer.style.display = 'block';
                    }

                    const response = await fetch('/openai/create-image', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ prompt })
                    });

                    const data = await response.json();

                    if (progressBarContainer) {
                        progressBarContainer.style.display = 'none';
                    }

                    if (data.ReturnimageUrl) {
                        const beforePrompt = value.substring(0, matchCreateImage.index);
                        const afterPrompt = value.substring(matchCreateImage.index + matchCreateImage[0].length);
                        const newText = `${beforePrompt}![Generated Image](${data.ReturnimageUrl})\n${afterPrompt}`;
                        markdownTextarea.value = newText;
                        markdownTextarea.selectionStart = markdownTextarea.selectionEnd = newText.length;
                        markdownTextarea.focus();
                    } else {
                        console.error('No imageUrl returned from API');
                        alert('No image was generated. Please try again.');
                    }
                }
            }
            // Handle //QTEXT command: Generate a response to a question
            else if (matchQuestion && matchQuestion[1].trim()) {
                const prompt = matchQuestion[1].trim();
                if (prompt) {
                    if (progressBarContainer) {
                        progressBarContainer.style.display = 'block';
                    }

                    const response = await fetch('/openai/process-text', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ operation: 'answer-question', prompt: prompt })
                    });

                    const data = await response.json();

                    if (progressBarContainer) {
                        progressBarContainer.style.display = 'none';
                    }

                    if (data.response) {
                        const beforeQuestion = value.substring(0, matchQuestion.index);
                        const afterQuestion = value.substring(matchQuestion.index + matchQuestion[0].length);
                        const newText = `${beforeQuestion}${data.response}\n${afterQuestion}`;
                        markdownTextarea.value = newText;
                        markdownTextarea.selectionStart = markdownTextarea.selectionEnd = newText.length;
                        markdownTextarea.focus();
                    } else {
                        console.error('No response returned from API');
                        alert('No response was generated. Please try again.');
                    }
                }
            }
            // Handle //QRW command: Spellcheck and rewrite the content
            else if (matchRewrite) {
                const prompt = value.trim();
                if (prompt) {
                    if (progressBarContainer) {
                        progressBarContainer.style.display = 'block';
                    }

                    const response = await fetch('/openai/process-text', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ operation: 'spellcheck-rewrite', prompt: prompt })
                    });

                    const data = await response.json();

                    if (progressBarContainer) {
                        progressBarContainer.style.display = 'none';
                    }

                    if (data.rewrittenText) {
                        markdownTextarea.value = data.rewrittenText;
                        markdownTextarea.selectionStart = markdownTextarea.selectionEnd = data.rewrittenText.length;
                        markdownTextarea.focus();
                    } else {
                        console.error('No rewritten text returned from API');
                        alert('No rewrite was generated. Please try again.');
                    }
                }
            }
            // Handle //AIMG command: Generate an image prompt and directly create the image
            else if (matchWriteImgPrompt) {
                const cleanedValue = value.replace(/^\s*\/\/\s*AIMG\s*$/im, '').trim();

                if (cleanedValue) {
                    if (progressBarContainer) {
                        progressBarContainer.style.display = 'block';
                    }

                    // Step 1: Generate the image prompt
                    const promptResponse = await fetch('/openai/process-text', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ operation: 'generate-image-prompt', prompt: cleanedValue })
                    });

                    const promptData = await promptResponse.json();

                    if (promptData.prompt) {
                        // Step 2: Use the generated prompt to create the image
                        const imageResponse = await fetch('/openai/create-image', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ prompt: promptData.prompt })
                        });

                        const imageData = await imageResponse.json();

                        if (progressBarContainer) {
                            progressBarContainer.style.display = 'none';
                        }

                        if (imageData.ReturnimageUrl) {
                            const newText = `![Generated Image](${imageData.ReturnimageUrl})\n\n${cleanedValue}`;
                            markdownTextarea.value = newText;
                            markdownTextarea.selectionStart = markdownTextarea.selectionEnd = newText.length;
                            markdownTextarea.focus();
                        } else {
                            console.error('No imageUrl returned from API');
                            alert('No image was generated. Please try again.');
                        }
                    } else {
                        console.error('No prompt returned from API');
                        alert('No image prompt was generated. Please try again.');
                    }
                }
            }
            // Handle //TAG:TAGNAME! command
            else if (matchTag && matchTag[1].trim()) {
                const tagName = matchTag[1].trim(); // Extracted tag name
                console.log(`Detected documentid: ${currentDocumentId}`);
                console.log(`Detected tag: ${tagName}`); // You can use this to trigger further actions or API calls
                
                // Example of handling the detected tag:
               

// Simple yes/no prompt using confirm()
let userResponse = confirm(`Do you want to add the tag? ${tagName}`);


if (userResponse) {
    console.log("User chose Yes.");

    // Check if documentId is defined and not empty
    if (!currentDocumentId) {
        console.error("No documentId found.");
        alert("No document ID available. Please ensure the document is properly identified before adding a tag.");
        return; // Exit the function early if documentId is missing
    }

    // Define the payload to send to the server
    const payload = {
        documentId: currentDocumentId, // Using the validated document ID
        tag: tagName
    };

    try {
        // Call the add-tag-to-file endpoint
        const response = await fetch('/dropbox/add-tag-to-file', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        // Parse the JSON response
        const data = await response.json();

        if (response.ok) {
            // If the response is successful
            console.log('Tag added successfully:', data);
            alert('Tag added to file successfully.');
        } else {
            // Handle errors returned from the server
            console.error('Failed to add tag:', data);
            alert(`Failed to add tag: ${data.message || 'Unknown error'}`);
        }
    } catch (error) {
        // Handle network or other unexpected errors
        console.error('Error adding tag:', error);
        alert('An error occurred while adding the tag.');
    }
} else {
    console.log("User chose No.");
}



            }
        } catch (error) {
            console.error('Error:', error);
            alert('Failed to process request.');
            if (progressBarContainer) {
                progressBarContainer.style.display = 'none';
            }
        }

        updatePreviewFromInput();
    }, 300);
});

updatePreviewFromInput();

});