import { marked } from 'https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js';

    
    document.addEventListener('DOMContentLoaded', () => {
        fetchUserId();
        updateSaveToPdfButton();
    });

    async function fetchUserId() {
    try {
        const response = await fetch('/dropbox/get-user-id', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('jwtToken')}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            setUserId(data.userId); // Store the user ID using the previously defined function
        } else if (response.status === 401) {
            // Handle unauthorized access, e.g., redirect to login
            window.location.href = '/login.html?message=session_expired';
        } else {
            console.error('Failed to fetch user ID');
        }
    } catch (error) {
        console.error('Error fetching user ID:', error);
    }
}

function setUserId(userId) {
    if (!userId) {
        console.error('No user ID provided');
        return;
    }
    localStorage.setItem('userId', userId);
    console.log(`User ID set to: ${userId}`);
}
   
   
   
   
    

    document.getElementById('DroboxButton').addEventListener('click', function() {
                        window.open('/sharedropboxfolder.html', '_blank');
                    });
   
                    async function updateLoggedInStatus() {
    try {
        const response = await fetch('/dropbox/protected', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('jwtToken')}`
            }
        });

        // Check for 401 status to handle unauthorized access
        if (response.status === 401) {
            const data = await response.json(); // Parse the JSON response

            console.log('Not authenticated:', data);

            // Check if the response has a redirect flag, indicating the session has expired
            if (data.redirect) {
                window.location.href = '/login.html?message=session_expired';
            } else {
                // Handle other unauthorized scenarios
                alert(data.message || 'Unauthorized access.');
            }
            return;
        }

        if (response.ok) {
            const text = await response.text();
            document.getElementById('loggedinas').innerText = text;
        } else {
            // Handle other non-OK responses
            document.getElementById('loggedinas').innerText = 'Failed to retrieve user information.';
        }
    } catch (error) {
        console.error('Error fetching authentication status:', error);
        document.getElementById('loggedinas').innerText = 'Error fetching authentication status.';
    }
}


function logout() {
            // Clear the token from local storage
            localStorage.removeItem('jwtToken');
            
            // Optionally, you might want to clear other user data stored in local storage
            // Redirect to the login page
            window.location.href = '/login.html?message=logged_out';
        }


        document.getElementById('logoutButton').addEventListener('click', logout);

        function dashboard() {
            // Clear the token from local storage
            
            
            // Optionally, you might want to clear other user data stored in local storage
            // Redirect to the login page
            window.location.href = '/dashboard.html?user=userid';
        }


        document.getElementById('DashboardButton').addEventListener('click', dashboard);

// Call this function when the page loads
document.addEventListener('DOMContentLoaded', updateLoggedInStatus);


    async function loadSnippets() {
    const snippetListContainer = document.getElementById('snippetlist');
    const textarea = document.getElementById('markdownTextarea'); // Assuming your textarea has this ID
    
    try {
        // Fetch the snippets from the server
        const response = await fetch('/md/snippets');
        const snippets = await response.json();

        // Clear the existing list items
        snippetListContainer.innerHTML = '';

        // Iterate over the snippets and create list items
        snippets.forEach(snippet => {
            const snippetElement = document.createElement('a');
            snippetElement.className = 'list-item';
            snippetElement.href = '#';
            snippetElement.dataset.snippet = snippet._id; // Use the snippet ID for reference
            snippetElement.textContent = snippet.snippetname;

            // Create a delete button
            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'Delete';
            deleteButton.className = 'btn btn-danger btn-sm ml-2';
            deleteButton.addEventListener('click', function(event) {
                event.preventDefault();
                deleteSnippet(snippet._id);
            });

            // Create an insert button
            const insertButton = document.createElement('button');
            insertButton.textContent = 'Insert ' + snippet.snippetname;
            insertButton.className = 'btn btn-primary btn-sm ml-2';
            insertButton.addEventListener('click', function(event) {
                event.preventDefault();
                insertSnippetIntoTextarea(snippet.content, textarea);
            });

            // Append the snippet element, insert button, and delete button to the list item
            const listItem = document.createElement('li');
            listItem.className = 'list-group-item';
            //listItem.appendChild(snippetElement);
            listItem.appendChild(insertButton);
            listItem.appendChild(deleteButton);

            // Append the list item to the list container
            snippetListContainer.appendChild(listItem);
        });

    } catch (error) {
        console.error('Error loading snippets:', error);
        alert('An error occurred while loading snippets.');
    }
}

function insertSnippetIntoTextarea(snippetContent, textarea) {
    textarea.value += snippetContent;  // Append the snippet content to the textarea
}

async function deleteSnippet(snippetId) {
    try {
        const response = await fetch(`/md/snippet/${snippetId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            alert('Snippet deleted successfully.');
            loadSnippets(); // Reload the list after deletion
        } else {
            alert('Failed to delete snippet.');
        }
    } catch (error) {
        console.error('Error deleting snippet:', error);
        alert('An error occurred while deleting the snippet.');
    }
}

// Call loadSnippets to initially load the snippets
loadSnippets();




    document.getElementById('saveSnippetButton').addEventListener('click', saveSnippet);
    
    function saveSnippet() {
    // Get the textarea element where the markdown content is written
    const textarea = document.getElementById('markdownTextarea');

    // Retrieve the entire content from the textarea
    const contentText = textarea.value;
    console.log('Textarea Content:', contentText);

    // Extract the snippet name using a regular expression
    const snippetNameMatch = contentText.match(/^snippetname: (.*)$/m);
    if (!snippetNameMatch) {
        console.warn('Snippet name not found in the textarea content.');
        alert('No snippet name found in the textarea content.');
        return;
    }
    const snippetname = snippetNameMatch[1];
    console.log('Snippet Name:', snippetname);

    // Extract the author name using a regular expression
    const authorMatch = contentText.match(/^Author: (.*)$/m);
    if (!authorMatch) {
        console.warn('Author not found in the textarea content.');
        alert('No author found in the textarea content.');
        return;
    }
    const author = authorMatch[1];
    console.log('Author:', author);


    // Remove the snippet name and author lines from the content
    const content = contentText.replace(/^snippetname: .*$/m, '').replace(/^Author: .*$/m, '').trim();
    console.log('Content to be saved:', content);

    // Define the endpoint URL for saving the snippet
    const url = '/md/save/';
    console.log('Saving snippet to URL:', url);

    // Send the data to the server using a POST request
    fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ snippetname, content, author })
    })
    .then(response => {
        console.log('Server response status:', response.status);
        if (response.ok) {
            console.info('Snippet saved successfully.');
            alert('Snippet saved successfully.');
        } else {
            console.error('Failed to save snippet. Server returned status:', response.status);
            alert('Failed to save snippet.');
        }
    })
    .catch(error => {
        console.error('Error occurred while saving the snippet:', error);
        alert('An error occurred while saving the snippet.');
    });
}






    function updateSaveToPdfButton() {
        const saveToPdfButton = document.getElementById('SaveasPDFButton');
        const filename = saveToPdfButton.getAttribute('data-filename');
        saveToPdfButton.disabled = !filename;
    }

    // Add event listener to the savetopdf button
    document.getElementById('SaveasPDFButton').addEventListener('click', saveToPdf);


    async function saveToPdf() {
        const saveToPdfButton = document.getElementById('SaveasPDFButton');
        const filename = saveToPdfButton.getAttribute('data-filename');

        if (!filename) {
            alert('No current file to save as PDF.');
            return;
        }

        try {
            const response = await fetch(`/md/topdf/${filename}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                alert('PDF saved successfully to Dropbox.');
            } else {
                const errorData = await response.json();
                console.error('Error saving PDF:', errorData.message);
                alert('Error saving PDF.');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred while saving the PDF.');
        }
    }


document.querySelectorAll('.list-item').forEach(item => {
    item.addEventListener('click', event => {
        event.preventDefault();
        const snippetKey = event.target.getAttribute('data-snippet');
        insertTextAtCursor(snippets[snippetKey]);
    });
});



async function deleteContent(id) {
    if (!id) {
        console.error('No id provided');
        alert('No document id provided');
        return;
    }

    try {
        const response = await fetch(`/dropbox/filedelete/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (response.ok) {
            alert('File deleted successfully to Dropbox.');
            location.href = '/index.html';
        } else {
            const errorData = await response.json();
            console.error('Error deleting file:', errorData.message);
            alert('Error deleting file.');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred while deleting the file.');
    }
}



    // Ensure this function is at the top level
    function insertContent(id) {
        if (!id) {
            console.error('No id provided');
            alert('No document id provided');
            return;
        }

        fetch(`/dropbox/file/${id}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            const textarea = document.getElementById('markdownTextarea');
            if (textarea) {
                textarea.value += data.content;
                textarea.focus();
              
                // FileListfromSearch display hidden
                document.getElementById('FileListfromSearch').style.display = 'none';

                //paginationControls hide
                document.getElementById('paginationControls').style.display = 'none';


                
            } else {
                console.error('Textarea element not found');
                alert('Textarea element not found');
            }
        })
        .catch(error => {
            console.error('Error fetching document:', error);
            alert('Error fetching document');
        });
    }

    // Remaining code...

    const markdownTextarea = document.getElementById('markdownTextarea');
    const previewGrid = document.getElementById('previewgrid');
    const saveButton = document.getElementById('saveButton');
    let isChanged = false;


// Custom renderer to avoid wrapping images in paragraphs
const renderer = new marked.Renderer();

// Helper function to extract text from nested tokens
function extractText(token) {
    if (typeof token === 'string') {
        return token;
    }
    if (token && typeof token === 'object' && token.text) {
        return token.text;
    }
    return String(token);
}

// Custom renderer for headings
renderer.heading = (token) => {
    const text = extractText(token);
    const level = token.depth || 1;
    console.log(`Rendering heading level ${level}: ${text}`);
    return `<div class="griditem"><h${level}>${text}</h${level}></div>`;
};

// Custom renderer for paragraphs
renderer.paragraph = (text) => {
    // Check if text is an array of tokens and handle accordingly
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





renderer.list = (token) => {
    const type = token.ordered ? 'ol' : 'ul';
    const body = token.items.map(item => renderer.listitem(item)).join('');
    console.log('Rendering list:', body);
    return `<div class="griditem"><${type}>${body}</${type}></div>`;
};

// Custom renderer for list items
renderer.listitem = (token) => {
    const text = token.tokens.map(t => extractText(t)).join('');
    console.log('Rendering list item:', text);
    return `<li>${text}</li>`;
};


renderer.code = (token) => {
    const text = token.text || '';
    const lang = token.lang || '';
    console.log(`Rendering code block: ${text}`);
    return `<div class="griditemcode"><pre><code class="language-${lang}">${text}</code></pre></div>`;
};

renderer.hr = () => {
    console.log('Rendering horizontal rule');
    return `<div class="griditem"><hr></div>`;
};


renderer.image = (token) => {
    const href = token.href || '';
    const alt = token.text || '';
    const title = token.title || '';
    console.log(`Rendering image: alt='${alt}', src='${href}', title='${title}'`);
    return `
        <img src="${href}" alt="${alt}" title="${title}">
    `;
};

renderer.blockquote = (token) => {
    // If the token has tokens (children), render their text
    const text = token.tokens.map(t => extractText(t)).join('');
    console.log(`Rendering blockquote: ${text}`);
    return `<div class="griditem"><blockquote>${text}</blockquote></div>`;
};

renderer.table = (token) => {
    // Check if header and rows are present
    if (!token.header || !token.rows) {
        console.error('Invalid table token structure:', token);
        return '<div class="error">Invalid table structure</div>'; // Return some error HTML
    }

    // Helper function to extract text from tokens
    const extractText = (tokens) => tokens.map(token => token.text).join('');

    // Render the table header
    const header = token.header.map(cell => `<th>${extractText(cell.tokens)}</th>`).join('');

    // Render the table rows
    const body = token.rows.map(row => {
        return `<tr>${row.map(cell => `<td>${extractText(cell.tokens)}</td>`).join('')}</tr>`;
    }).join('');

    console.log('Rendering table:', header, body);

    // Return the constructed HTML for the table
    return `
        <div class="griditem">
            <table>
                <thead>${header}</thead>
                <tbody>${body}</tbody>
            </table>
        </div>
    `;
};






marked.use({ renderer });

// Function to update the preview
function updatePreviewFromInput() {
    const markdownTextarea = document.getElementById('markdownTextarea');
    const previewGrid = document.getElementById('previewgrid');
    const markdownContent = markdownTextarea.value;

    console.log('Markdown input:', markdownContent);

    const tokens = marked.lexer(markdownContent);
    console.log('Parsed tokens:', tokens);

    const htmlContent = marked.parser(tokens);
    console.log('Rendered HTML:', htmlContent);

    previewGrid.innerHTML = htmlContent;
    applyGridClasses();
}

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
            const matchNIBIQuestion = value.match(/^\s*\/\/\s*SYOU\s*(.+?)\s*\?$/im); // New pattern for NIBI questions
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
                // Handle //NIBI command: Ask the assistant a question
                else if (matchNIBIQuestion && matchNIBIQuestion[1].trim()) {
                    const question = matchNIBIQuestion[1].trim();
                    if (question) {
                        if (progressBarContainer) {
                            progressBarContainer.style.display = 'block';
                        }

                        const response = await fetch('/openai/ask-assistant', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ question })
                        });

                        const data = await response.json();

                        if (progressBarContainer) {
                            progressBarContainer.style.display = 'none';
                        }

                        if (data.response) {
                            const beforeQuestion = value.substring(0, matchNIBIQuestion.index);
                            const afterQuestion = value.substring(matchNIBIQuestion.index + matchNIBIQuestion[0].length);
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
                // Handle //TAG:TAGNAME! command
                else if (matchTag && matchTag[1].trim()) {
                    const tagName = matchTag[1].trim(); // Extracted tag name
                    console.log(`Detected documentid: ${currentDocumentId}`);
                    console.log(`Detected tag: ${tagName}`); // You can use this to trigger further actions or API calls

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












        function updatePreviewFromButtonClick() {
    const markdownTextarea = document.getElementById('markdownTextarea');
    const previewGrid = document.getElementById('previewgrid');
    const markdownContent = markdownTextarea.value;
    const htmlContent = marked(markdownContent);
    previewGrid.innerHTML = htmlContent;
    applyGridClasses();
}

function applyGridClasses() {
    const previewGrid = document.getElementById('previewgrid');
    const images = previewGrid.querySelectorAll('img');
    const idCount = {};

    images.forEach((img) => {
        const url = img.src;
        const idMatch = url.match(/\/([^\/]+)\/[^\/]+$/);
        const baseId = idMatch ? idMatch[1].replace(/\s+/g, '-').toLowerCase() : '';

        if (!idCount[baseId]) {
            idCount[baseId] = 0;
        }
        idCount[baseId] += 1;

        const uniqueId = `${baseId}-${idCount[baseId]}`;
        img.id = uniqueId;
    });
}

        function insertTextAtCursor(text) {
    const markdownTextarea = document.getElementById('markdownTextarea');
    const start = markdownTextarea.selectionStart;
    const end = markdownTextarea.selectionEnd;
    const currentText = markdownTextarea.value;

    const before = currentText.substring(0, start);
    const after = currentText.substring(end);

    markdownTextarea.value = before + text + after;

    markdownTextarea.selectionStart = markdownTextarea.selectionEnd = start + text.length;
    markdownTextarea.focus();
    updatePreviewFromButtonClick(); // Update the preview
}


        function insertHashTaglist() {
            insertTextAtCursor('\n```markdown\n#SlowYou #SelfCare #AI #Nature #Aliveness #AlivenssLAB\n```\n');
        }

        function insertHeading1() {
            console.log('insertHeading1 called');
            insertTextAtCursor('\n\n# This is heading one\n');
        }

        function insertHeading2() {
            console.log('insertHeading2 called');
            insertTextAtCursor('\n\n## This is heading two\n');
        }

        function insertHeading3() {
            console.log('insertHeading3 called');
            insertTextAtCursor('\n\n### This is heading three\n');
        }

        function insertHeading4() {
            console.log('insertHeading4 called');
            insertTextAtCursor('\n\n#### This is heading four\n');
        }
 
        function insertBold() {
            console.log('insertBold called');
            insertTextAtCursor('**bold text**');
        }

        function insertItalic() {
            console.log('insertItalic called');
            insertTextAtCursor('*italic text*');
        }

        function insertLink() {
            console.log('insertLink called');
            insertTextAtCursor('[link text](url)');
        }

        function insertImage() {
            console.log('insertImage called');
            insertTextAtCursor('![alt text](https://cdn.midjourney.com/bd7b3b48-777a-4013-9ed0-25accc6a090b/0_0.png)');
        }

        function insertOrderedList() {
            console.log('insertOrderedList called');
            insertTextAtCursor('\n1. First item\n2. Second item\n3. Third item\n');
        }

        function insertUnorderedList() {
            console.log('insertUnorderedList called');
            insertTextAtCursor('\n- First item\n- Second item\n- Third item\n');
        }

        function insertCode() {
            console.log('insertCode called');
            insertTextAtCursor('\n```markdown\n#SlowYou #SelfCare #AI #Nature #Aliveness #AlivenssLAB\n```\n');
        }

        function insertHorizontalRule() {
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
            document.getElementById('saveButton').addEventListener('click', saveMarkdownContent);
        }

        let currentDocumentId = null; // Store the current document ID

        async function saveMarkdownContent() {
    const content = markdownTextarea.value;
    const documentId = currentDocumentId;

    if (!content.trim()) {
        alert('Textarea is empty. Please enter some content.');
        return;
    }

    if (!isChanged) {
        alert('No changes detected.');
        return;
    }

    // Retrieve the user ID from local storage
    const userId = localStorage.getItem('userId');
    if (!userId) {
        alert('User ID not found. Please log in again.');
        return;
    }

    saveButton.disabled = true;

    try {
        const response = await fetch('/dropbox/save-markdown', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ content, documentId })
        });

        if (response.ok) {
            const result = await response.json();
            console.log('File saved successfully:', result.id, result.filePath);
            alert('File saved successfully');
            currentDocumentId = result.id; // Update the current document ID

            // Construct the file URL with the user ID
            const fileUrl = `https://mystmkra.io/dropbox/blog/${userId}/${result.id}.md`;

            // Update the return file URL in the DOM
            const returnfileURL = document.querySelector('.ReturnfileURL');
            returnfileURL.href = fileUrl;
            returnfileURL.text = fileUrl;
            returnfileURL.setAttribute('data-url', fileUrl);
            isChanged = false;

            // Update the PDF save button with the correct file name
            const saveToPdfButton = document.getElementById('SaveasPDFButton');
            saveToPdfButton.setAttribute('data-filename', `${result.id}.md`);
            updateSaveToPdfButton();
        } else {
            const errorText = await response.text();
            console.error('Error saving file:', errorText);
            alert('Error saving file');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred while saving the file');
    } finally {
        saveButton.disabled = false;
    }
}



        // Update preview when user inputs text directly
        markdownTextarea.addEventListener('input', () => {
            updatePreviewFromInput();
            isChanged = true;
            saveButton.disabled = false;
        });

        // Attach event listeners once
        attachEventListeners();

        // Initial preview update
        console.log('Initial preview update');
        updatePreviewFromInput();

        document.addEventListener('DOMContentLoaded', () => {
            const searchInput = document.querySelector('.form-control[type="search"]');
            const searchButton = document.querySelector('.btn[type="submit"]');
            const fileListfromSearch = document.querySelector('#FileListfromSearch');
            const paginationControls = document.querySelector('#paginationControls');
            let currentPage = 1;
            const itemsPerPage = 3;
            let searchResults = [];

            searchButton.addEventListener('click', async (event) => {
                event.preventDefault();
                const query = searchInput.value.trim();

                if (!query) {
                    alert('Please enter a search term');
                    return;
                }

                try {
                    const response = await fetch(`/dropbox/search?query=${encodeURIComponent(query)}`);
                    const results = await response.json();

                    if (response.ok) {
                        searchResults = results;
                        currentPage = 1;  // Reset to first page on new search
                        displaySearchResults(searchResults);
                        setupPagination(searchResults.length);
                    } else {
                        console.error('Error searching files:', results.message);
                        alert('Error searching files');
                    }
                } catch (error) {
                    console.error('Error:', error);
                    alert('An error occurred while searching for files');
                }
            });

            function displaySearchResults(results) {
    fileListfromSearch.innerHTML = ''; // Clear previous results

    // Retrieve the user ID from local storage
    const userId = localStorage.getItem('userId');
    if (!userId) {
        alert('User ID not found. Please log in again.');
        return;
    }

    if (results.length === 0) {
        fileListfromSearch.innerHTML = '<p>No results found.</p>';
        paginationControls.innerHTML = '';
        return;
    }

    const pageResults = paginateResults(results, currentPage, itemsPerPage);
    pageResults.forEach(result => {
        const card = document.createElement('div');
        card.classList.add('card', 'mb-3');
        card.style.width = '18rem';
        card.innerHTML = `
            <div class="card-body">
                <p class="card-text"><a href="https://mystmkra.io/dropbox/blog/${userId}/${result.id}.md" target="_blank">${result.abs}</a></p>
                <button class="btn btn-primary open-content-button" data-id="${result.id}">Open</button>
                <button class="btn btn-primary insert-content-button" data-id="${result.id}">Insert Content</button>
                <button class="btn btn-primary delete-content-button" data-id="${result.id}">Delete Content</button>
            </div>
        `;
        fileListfromSearch.appendChild(card);
    });

    // Add event listeners to the new buttons
    document.querySelectorAll('.open-content-button').forEach(button => {
        button.addEventListener('click', function() {
            const id = this.getAttribute('data-id');
            openContent(id);
        });
    });

    document.querySelectorAll('.insert-content-button').forEach(button => {
        button.addEventListener('click', function() {
            const id = this.getAttribute('data-id');
            insertContent(id);
        });
    });

    document.querySelectorAll('.delete-content-button').forEach(button => {
        button.addEventListener('click', function() {
            const id = this.getAttribute('data-id');
            deleteContent(id);
        });
    });
}


async function openContent(id) {
    if (!id) {
        console.error('No id provided');
        alert('No document id provided');
        return;
    }

    // Retrieve the user ID from local storage
    const userId = localStorage.getItem('userId');
    if (!userId) {
        alert('User ID not found. Please log in again.');
        return;
    }

    try {
        const response = await fetch(`/dropbox/file/${id}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const data = await response.json();
        const textarea = document.getElementById('markdownTextarea');
        if (textarea) {
            textarea.value = data.content; // Load content into the textarea
            textarea.focus();

            // Hide the search results display
            document.getElementById('FileListfromSearch').style.display = 'none';
            document.getElementById('paginationControls').style.display = 'none';

            // Update the current document ID
            currentDocumentId = id;
            
            // Construct the file URL with the user ID
            const fileUrl = `https://mystmkra.io/dropbox/blog/${userId}/${currentDocumentId}.md`;

            const returnfileURL = document.querySelector('.ReturnfileURL');
            returnfileURL.href = fileUrl;
            returnfileURL.text = fileUrl;
            returnfileURL.setAttribute('data-url', fileUrl);
            isChanged = true;

            alert('Document loaded successfully.');
        } else {
            console.error('Textarea element not found');
            alert('Textarea element not found');
        }
    } catch (error) {
        console.error('Error fetching document:', error);
        alert('Error fetching document');
    }
}




            function paginateResults(results, page, itemsPerPage) {
                const start = (page - 1) * itemsPerPage;
                const end = start + itemsPerPage;
                return results.slice(start, end);
            }

            function setupPagination(totalItems) {
                paginationControls.innerHTML = '';
                const totalPages = Math.ceil(totalItems / itemsPerPage);

                for (let i = 1; i <= totalPages; i++) {
                    const pageItem = document.createElement('li');
                    pageItem.classList.add('page-item');
                    const pageLink = document.createElement('a');
                    pageLink.classList.add('page-link');
                    pageLink.href = '#';
                    pageLink.textContent = i;

                    if (i === currentPage) {
                        pageItem.classList.add('active');
                    }

                    pageLink.addEventListener('click', (event) => {
                        event.preventDefault();
                        currentPage = i;
                        displaySearchResults(searchResults);
                        setupPagination(totalItems);
                    });

                    pageItem.appendChild(pageLink);
                    paginationControls.appendChild(pageItem);
                }
            }
        });



