import dotenv from 'dotenv';

dotenv.config();

// Get the list of approved tokens from environment variable
// Format in .env: API_TOKENS=token1,token2,token3
const API_TOKENS = process.env.API_TOKENS ? process.env.API_TOKENS.split(',') : [];

export function validateApiToken(req, res, next) {
  const apiToken = req.header('X-API-Token');

  if (!apiToken) {
    return res.status(401).json({
      success: false,
      error: 'No API token provided'
    });
  }

  if (!API_TOKENS.includes(apiToken)) {
    return res.status(401).json({
      success: false,
      error: 'Invalid API token'
    });
  }

  // Add the token to the request for logging or tracking purposes
  req.apiToken = apiToken;
  next();
} 