import { fetchAssistantDetails, setCurrentAssistantId, getCookie } from './assistantService.js';

let assistantsCache = null; // Cache assistants to avoid repeated fetches

async function fetchAssistants() {
    if (assistantsCache) return assistantsCache; // Return cached data if available

    try {
        const response = await fetch('/adb/names-ids');
        if (!response.ok) {
            throw new Error('Failed to fetch assistants');
        }
        const data = await response.json();
        assistantsCache = data; // Cache the data
        return data;
    } catch (error) {
        console.error('Error fetching assistants:', error);
        return [];
    }
}

function getCaretCoordinates(element, position) {
    const div = document.createElement('div');
    const style = getComputedStyle(element);
    for (const prop of style) {
        div.style[prop] = style[prop];
    }
    div.style.position = 'absolute';
    div.style.visibility = 'hidden';
    div.style.whiteSpace = 'pre-wrap';
    div.style.wordWrap = 'break-word';
    div.textContent = element.value.substring(0, position);
    document.body.appendChild(div);
    const span = document.createElement('span');
    span.textContent = element.value.substring(position) || '.';
    div.appendChild(span);
    const { offsetTop: top, offsetLeft: left } = span;
    document.body.removeChild(div);

    const textareaRect = element.getBoundingClientRect();
    return {
        top: textareaRect.top + top + window.scrollY, // Adjust for scroll
        left: textareaRect.left + left + window.scrollX, // Adjust for scroll
    };
}

function showPopup(items, cursorPosition, Typeof) {
    const mentionPopup = document.getElementById('mentionPopup');
    mentionPopup.innerHTML = ''; // Clear previous items
    items.forEach((item) => {
        const div = document.createElement('div');
        div.className = 'mention-popup-item';
        div.textContent = item.name;
        div.dataset.id = item.id || ''; // Ensure id is not undefined
        div.dataset.Typeof = Typeof; // Add Typeof to dataset
        mentionPopup.appendChild(div);
    });

    // Calculate position dynamically
    const { top, left } = getCaretCoordinates(document.getElementById('assistantTextarea'), cursorPosition);
    mentionPopup.style.left = `${left}px`;
    mentionPopup.style.top = `${top}px`;
    mentionPopup.style.display = 'block';
}

function selectItem(name, cursorPosition, typeOf, id) {
    const textarea = document.getElementById('assistantTextarea');
    const textBeforeCursor = textarea.value.substring(0, cursorPosition);
    const textAfterCursor = textarea.value.substring(cursorPosition);

    const newTextBeforeCursor = textBeforeCursor + name;
    textarea.value = newTextBeforeCursor + textAfterCursor;
    textarea.selectionStart = textarea.selectionEnd = newTextBeforeCursor.length;
    textarea.focus();
    document.getElementById('mentionPopup').style.display = 'none';

    if (typeOf === 'Assistants') {
        document.getElementById('assistantDiv').classList.remove('hidden'); // Make assistantDiv visible
        document.getElementById('assistantTextarea').value = ''; // Remove placeholder text
        document.getElementById('assistantTextarea').placeholder = `Write your prompt for @${name} here...`;
        
        // Call the endpoint to get the assistant image
        fetch(`/adb/assistant-image/${id}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to fetch assistant image');
                }
                return response.json();
            })
            .then(data => {
                document.getElementById('assistantImage').src = data.imageUrl;
            })
            .catch(error => {
                console.error('Error fetching assistant image:', error);
            });

        // Set the assistant ID to a cookie
        setCurrentAssistantId(id);
    }
}

async function handleInput(event) {

    const storedEndpoint = getCookie('CurrentEndPoint')?.trim();
    
    if (storedEndpoint && storedEndpoint !== 'undefined' && storedEndpoint !== 'null') {
        
        return;
    }

    const textarea = document.getElementById('assistantTextarea');
    const cursorPosition = textarea.selectionStart;
    const textBeforeCursor = textarea.value.substring(0, cursorPosition);
    const lastSpaceIndex = textBeforeCursor.lastIndexOf(' ');
    const textAfterLastSpace = textBeforeCursor.substring(lastSpaceIndex + 1);

    const textFromTextarea = textAfterLastSpace;

    if (textFromTextarea === 'ass@') {
        const assistants = await fetchAssistants();
        showPopup(assistants, cursorPosition, 'Assistants');
        return;
    } else {
        document.getElementById('mentionPopup').style.display = 'none';
    }

    if (!textFromTextarea.trim()) {
        return; // Do not fetch if the input is empty
    }

    try {
        const url = `/system/endpoint-url/${textFromTextarea}`;
        const response = await fetch(url);

        if (!response.ok) {
            if (response.status === 404) {
                document.getElementById('mentionPopup').style.display = 'none';
                return;
            }
            throw new Error('Failed to fetch the URL of the endpoint');
        }

        const data = await response.json();
        const { trigger, Typeof, parameters, url: endpointUrl } = data;

        const storedEndpoint = getCookie('CurrentEndPoint')?.trim();
        


        if (!storedEndpoint || storedEndpoint === 'undefined' || storedEndpoint === 'null') {
            document.cookie = `CurrentEndPoint=${endpointUrl}; path=/; max-age=31536000`;
           
        } else {
            return;
        }
    } catch (error) {
        console.error('Error fetching endpoint URL:', error);
        document.getElementById('mentionPopup').style.display = 'none';
    }
}

async function handleEnterKey(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        const prompt = event.target.value.trim();
        if (!prompt) {
            alert('Please enter a prompt');
            return;
        }

        try {
            let assistantId = getCookie('currentAssistantId');
            const storedEndpoint = getCookie('CurrentEndPoint');

            if (!storedEndpoint || storedEndpoint === 'undefined' || storedEndpoint === 'null') {
                if (assistantId) {
                    const response = await fetch(`/assistants/askwithid?assistantId=${assistantId}&question=${encodeURIComponent(prompt)}`);
                    if (response.ok) {
                        const data = await response.json();
                        event.target.value = data.response;
                    } else {
                        console.error('Failed to send prompt:', response.status);
                    }
                } else {
                    alert('No endpoint or assistant selected. Please enter a valid command.');
                }
            } else {
                assistantId = ""; // Reset assistantId to ensure it does not use this endpoint
                
                
                const response = await fetch(storedEndpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ message: prompt })
                });

                console.log(response);

                if (response.ok) {
                    const data = await response.json();
                    console.log(data);

                    event.target.value = data.svar;
                    document.cookie = `CurrentEndPoint=; path=/; max-age=0`;
                } else {
                    console.error('Failed to send prompt:', response.status);
                }
            }
        } catch (error) {
            console.error('Error sending prompt:', error);
        }
    }
}

export function initializeAssistantInputHandler() {
    document.addEventListener('DOMContentLoaded', () => {
        const textarea = document.getElementById('assistantTextarea');
        const mentionPopup = document.getElementById('mentionPopup');

        if (textarea && mentionPopup) {
            textarea.addEventListener('input', handleInput);
            textarea.addEventListener('blur', () => setTimeout(() => (mentionPopup.style.display = 'none'), 200));
            textarea.addEventListener('keydown', handleEnterKey);

            mentionPopup.addEventListener('click', (event) => {
                if (event.target.classList.contains('mention-popup-item')) {
                    const name = event.target.textContent;
                    const cursorPosition = textarea.selectionStart;
                    const Typeof = event.target.dataset.Typeof;
                    const id = event.target.dataset.id;

                    selectItem(name, cursorPosition, Typeof, id);
                }
            });
        } else {
            console.error('Textarea or mentionPopup element not found.');
        }
    });
}
