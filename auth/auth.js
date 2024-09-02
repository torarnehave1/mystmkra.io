// middleware/auth.js
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET; // Ensure this is set in your .env file

// Function to generate JWT token with an expiration time of 24 hours
export function generateToken(user) {
  return jwt.sign(
    {
      id: user._id,
      email: user.username,
    },
    JWT_SECRET,
    {
      expiresIn: '24h', // Token will expire in 24 hours
    }
  );
}

export function isAuthenticated(req, res, next) {
  try {
    // Check for token in cookies or Authorization header
    const token = req.cookies.jwtToken || req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      console.log('No token provided. Returning 401 status.');
      
      // Return 401 Unauthorized if no token is provided
      return res.status(401).json({ message: 'No token provided. Please log in.' });
    }

    // Verify the token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Attach the decoded token (user info) to the request object
    req.user = decoded;
    
    // Proceed to the next middleware or route handler
    next();
  } catch (ex) {
    console.log('Token verification failed:', ex.message);

    // Handle token expiration specifically
    if (ex.name === 'TokenExpiredError') {
      console.log('Token has expired. Returning 401 status with session expired message.');

      // Return 401 Unauthorized with a specific message for expired tokens
      return res.status(401).json({ message: 'Session expired. Please log in again.', redirect: true });
    }

    // Handle other token verification errors
    return res.status(401).json({ message: 'Invalid token. Please log in.' });
  }
}
