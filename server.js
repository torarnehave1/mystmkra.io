import express from 'express';
import bodyParser from 'body-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import userRoutes from './routes/user_routes.js'; // User routes
import dropboxfilesroutes from './routes/dropbox.js'; // Dropbox routes
import mdroute from './routes/markdown_route.js'; // Markdown routes
import blogpost from './routes/blogpost_routes.js'; // Blog post routes
import rateLimit from 'express-rate-limit'; // Security to protect from brute force
import morgan from 'morgan'; // Log functionality
import { isAuthenticated } from './auth/auth.js';
import ChatGPT from './routes/openai.js';
import ENVconfig from './config/config.js';


// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Set up rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2000 // limit each IP to 2000 requests per windowMs
});
app.use(limiter);

// Set up logging
const logger = morgan('combined');
app.use(logger);

console.log(`The application is running in ${ENVconfig.NODE_ENV} mode.`);
console.log(`The base URL is ${ENVconfig.BASE_URL}`);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure body parsers
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Set up cookie parser
app.use(cookieParser());

// Set view engine if needed (e.g., for error handling)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/logo', express.static(path.join(__dirname, 'logo')));
app.use('/images', express.static(path.join(__dirname, '../public/images')));

// Home route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Mystmkra protected HTML page
app.get('/mystmkra/mystmkra.html', isAuthenticated, (req, res) => {
  console.log('The mystmkra.html file was accessed');
  res.sendFile(path.join(__dirname, 'public', 'mystmkra', 'mystmkra.html'));
});

// Core routes for mystmkra.io
app.use('/a', userRoutes); // Authentication routes
app.use('/dropbox', dropboxfilesroutes); // Dropbox routes
app.use('/md', mdroute); // Markdown routes
app.use('/blog', blogpost); // Blog post routes
app.use('/openai', ChatGPT);

// Support page
app.get('/support', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'support.html'));
});

// MongoDB connection (if necessary for the above routes)
import { connect } from 'mongoose';
connect(process.env.MONGO_DB_URL)
  .then(() => console.log('Connected to MongoDB with Mongoose'))
  .catch(err => console.error('Could not connect to MongoDB', err));

// Error handling middleware
app.use((err, req, res, next) => {
  if (err) {
    console.error(err);
    res.status(500).render('error', { message: 'An error occurred during authentication.' });
  } else {
    next();
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

export default app;
