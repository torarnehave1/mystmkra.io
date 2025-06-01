import dotenv from 'dotenv';

dotenv.config();

// Get the list of approved tokens from environment variable
// Format in .env: API_TOKENS=token1,token2,token3
const API_TOKENS = process.env.API_TOKENS ? process.env.API_TOKENS.split(',') : [];

console.log('Available API tokens:', API_TOKENS); // Debug log

export function validateApiToken(req, res, next) {
  const apiToken = req.header('X-API-Token');
  
  console.log('Received API token:', apiToken); // Debug log
  console.log('Headers:', req.headers); // Debug log

  if (!apiToken) {
    console.log('No API token provided'); // Debug log
    return res.status(401).json({
      success: false,
      error: 'No API token provided'
    });
  }

  if (!API_TOKENS.includes(apiToken)) {
    console.log('Invalid API token. Available tokens:', API_TOKENS); // Debug log
    return res.status(401).json({
      success: false,
      error: 'Invalid API token'
    });
  }

  // Add the token to the request for logging or tracking purposes
  req.apiToken = apiToken;
  next();
} 