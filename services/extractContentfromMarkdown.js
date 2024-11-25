export default function extractContentElements(markdown) {
    // Ensure the input is a valid string
    if (typeof markdown !== 'string') {
      throw new Error('Invalid input: markdown content must be a string.');
    }
  
    // Regular expression to find the first image URL in markdown format
    const imageRegex = /!\[.*?\]\((.*?)\)/;
    const imageMatch = markdown.match(imageRegex);
    // Extract the first image URL or assign null if no image is found
    const imageUrl = imageMatch ? imageMatch[1] : null;
  
    // Regular expression to find the first-level heading in markdown format
    const titleRegex = /^# (.*)$/m;
    const titleMatch = markdown.match(titleRegex);
    // Extract the title or use a default value if no title is found
    const title = titleMatch ? titleMatch[1] : 'Untitled';
  
    // Split the markdown content into an array of lines
    const lines = markdown.split('\n');
  
    // Initialize a variable to hold the first paragraph
    let firstParagraph = '';
    // Loop through the lines to find the first valid paragraph
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim(); // Remove leading and trailing whitespace
      // Check if the line is not empty, not a heading, and not an image
      if (line && !line.startsWith('#') && !imageRegex.test(line)) {
        firstParagraph = line;
        break;
      }
    }
  
    // Extract the first 50 characters from the paragraph and append ellipsis if needed
    const excerpt = firstParagraph.length > 50 ? firstParagraph.substring(0, 50) + '...' : firstParagraph;
  
    // Return an object containing the extracted elements
    return {
      imageUrl, // The URL of the first image found
      title,    // The first-level heading in the markdown
      excerpt,  // The first 50 characters of the first paragraph
    };
  }
  