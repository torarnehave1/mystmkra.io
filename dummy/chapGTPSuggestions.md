async function handleInput(event) {
    const cursorPosition = textarea.selectionStart;
    const textBeforeCursor = textarea.value.substring(0, cursorPosition);
    const lastSpaceIndex = textBeforeCursor.lastIndexOf(' ');
    const textAfterLastSpace = textBeforeCursor.substring(lastSpaceIndex + 1);

    console.log('Cursor Position:', cursorPosition);
    console.log('Text Before Cursor:', textBeforeCursor);
    console.log('Last Space Index:', lastSpaceIndex);
    console.log('Text After Last Space:', textAfterLastSpace);

    const textFromTextarea = textAfterLastSpace.slice(-4);
    
    // Check if a new endpoint is already set in the cookie
    const storedEndpoint = getCookie('CurrentEndPoint');
    if (storedEndpoint) {
        console.log('Stored Endpoint detected, skipping further input handling.');
        return;
    }

    if (textAfterLastSpace === '') {
        mentionPopup.style.display = 'none';
        return;
    }

    try {
        const url = `/system/endpoint-url/${textFromTextarea}`;
        console.log('Fetching:', url);
        const response = await fetch(url);

        if (!response.ok) {
            if (response.status === 404) {
                console.error('Endpoint URL not found for input:', textFromTextarea);
                mentionPopup.style.display = 'none';
                return;
            }
            throw new Error('Failed to fetch the URL of the endpoint');
        }

        const data = await response.json();
        console.log('Fetched Data:', data);

        const { trigger, Typeof, parameters, url: endpointUrl } = data;
        
        if (!isPromptEntered) {
            NewEndpoint = endpointUrl;
            document.cookie = `CurrentEndPoint=${NewEndpoint}; path=/; max-age=31536000`;
            console.log('Stored NewEndpoint in cookie:', NewEndpoint);
        }

        let matchedType = null;
        let listResponse = null;

        if (parameters.length === 0) {
            console.log('No parameters found');
            const EndPointResponse = await fetch(NewEndpoint);
            console.log('Fetching:', NewEndpoint);
            if (EndPointResponse.ok) {
                listResponse = await EndPointResponse.json();
            } else {
                throw new Error('Failed to fetch data from second endpoint');
            }
            const endpointTypes = await fetch('/system/endpoint-types');
            const typesData = await endpointTypes.json();
            matchedType = typesData.types.find(type => type === data.Typeof);
        } else if (parameters.length === 1) {
            const testPrompt = 'Write something about the principles in SlowYou';
            if (!isPromptEntered) {
                NewEndpoint = `${endpointUrl}?${parameters[0]}=${testPrompt}`;
                textarea.placeholder = testPrompt;
                document.cookie = `CurrentEndPoint=${NewEndpoint}; path=/; max-age=31536000`;
                console.log('New URL set with placeholder:', NewEndpoint);
            }
            isPromptEntered = false;
        }

        console.log('Matched Type:', matchedType);

        if (!trigger || !textAfterLastSpace.endsWith(trigger)) {
            mentionPopup.style.display = 'none';
            return;
        }
    } catch (error) {
        console.error('Error fetching data:', error);
        mentionPopup.style.display = 'none';
    }
}