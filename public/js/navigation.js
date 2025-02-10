// menu.js

document.addEventListener("DOMContentLoaded", function() {
  // Select the key elements
  var searchMenuItem = document.getElementById("searchMenuItem");
  var searchContent = document.getElementById("searchContent");
  var editorContent = document.getElementById("editorContent");
  var backButton = document.getElementById("backButton");
  const infoBox = document.getElementById('information');

  // When the Search menu item is clicked, hide editor content and show the search panel.
  if (searchMenuItem && searchContent && editorContent) {
    searchMenuItem.addEventListener("click", function(event) {
      event.preventDefault();
      editorContent.style.display = "none";
      searchContent.style.display = "block";
    });
  }

  // When the Back button is clicked, hide the search panel and show the editor content.
  if (backButton && searchContent && editorContent) {
    backButton.addEventListener("click", function(event) {
      event.preventDefault();
      searchContent.style.display = "none";
      editorContent.style.display = "block";
    });
  }

  function showInfo(message) {
    infoBox.innerHTML = `<p>${message}</p>`;
    infoBox.style.display = 'block';
  }

  function hoverInfo(message) {
    infoBox.innerHTML = `<p>${message}</p>`;
    infoBox.style.display = 'block';
  }

  document.getElementById('newFileButton').addEventListener('click', function() {
    showInfo('Create a new file');
  });

  document.getElementById('saveButton').addEventListener('click', function() {
    showInfo('Save the current file');
  });

  document.getElementById('searchMenuItem').addEventListener('click', function() {
    showInfo('Search through your files');
  });

  document.getElementById('newFileButton').addEventListener('mouseover', function() {
    hoverInfo('Create a new file');
  });

  document.getElementById('saveButton').addEventListener('mouseover', function() {
    hoverInfo('Save the current file');
  });

  document.getElementById('searchMenuItem').addEventListener('mouseover', function() {
    hoverInfo('Search through your files');
  });

  document.getElementById('returnFileURL').addEventListener('mouseover', function() {
    hoverInfo('View the file URL');
  });

  document.getElementById('insertTextButton').addEventListener('mouseover', function() {
    hoverInfo('Insert text from the AI assistant or Generated Codeword response');
  });

  document.getElementById('SavePromtButton').addEventListener('mouseover', function() {
    hoverInfo('Save the AI prompt to the prompt collection');
  });

  document.getElementById('GetHelpButton').addEventListener('mouseover', function() {
    hoverInfo('Get Help about the current AI assistant or current Code Word');
  });

 

  document.getElementById('LogoutButton').addEventListener('mouseover', function() {
    hoverInfo('Logout from mystmkra.io');
  });

  
  document.getElementById('SystemSettings').addEventListener('mouseover', function() {
    hoverInfo('Open System settings panel');
  });

  document.getElementById('SystemHelpButton').addEventListener('mouseover', function() {
    hoverInfo('View help page');
  });

  document.getElementById('markdownTextarea').addEventListener('mouseover', function() {
    hoverInfo('In this text area you can write your markdown content, and the preview will be shown on the bottom of the page');
  });

  document.getElementById('assistantTextarea').addEventListener('mouseover', function() {
    hoverInfo('In this text area you can write in codewords like ass@ and get a pop-up with the list of available AI assistants. You can also write prompts to the AI assistant and get the response. In this box, you can write codewords that are configured to call different API endpoints. To see what codewords are available, click on the Get Help button.');
  });

  document.getElementById('tags').addEventListener('mouseover', function() {
    hoverInfo('In this text area you can write in tags like #projectname #subject # etc. to categorize your document');
  });

  // Add more event listeners as needed
});
