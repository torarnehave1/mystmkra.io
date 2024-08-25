import express from 'express';
import { Dropbox } from 'dropbox';
import fetch from 'node-fetch';
import axios from 'axios';
import dotenv from 'dotenv';
import os from 'os';
import { marked } from 'marked';
import crypto from 'crypto';
import MDfile from '../models/Mdfiles.js';
import mongoose from 'mongoose';
import sanitizeHtml from 'sanitize-html';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { join } from 'path';
import { mkdirSync, writeFileSync, readFileSync } from 'fs';
import { appendFile } from 'fs';
import fs from 'fs';

import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import User from '../models/User.js';

import config from '../config/config.js';
import {isAuthenticated} from '../auth/auth.js';


console.log(`The application is running in ${config.NODE_ENV} mode.`);
console.log(`REDIR = ${config.REDIRECT_URI}`)

let accessToken = process.env.DROPBOX_ACCESS_TOKEN;
let refreshToken = process.env.DROPBOX_REFRESH_TOKEN;
let expiryTime = 0;

const app = express();
app.use(cookieParser());

dotenv.config();


//Root for this endpoint are /w/endpointname app.use('/w', webpagesroutes);

const JWT_SECRET = process.env.JWT_SECRET;

dotenv.config();

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const filePath = path.resolve(__dirname, '..', '..');


// 1. GET /auth - Endpoint to start the OAuth flow
// 2. GET /auth/callback - Callback endpoint to handle the authorization code
// 3. GET /list-image-files - Endpoint to list image files in a folder
// 4. GET /list-image-collection-links - Endpoint to list image collection links from a markdown file
// 5. GET /list-markdown-files - Endpoint to list markdown files in a folder
// 6. GET /md/:filename - Endpoint to fetch and render a markdown file
// 7. GET /blog/:filename - Endpoint to fetch and render a markdown file for a blog post
// 8. GET /project/:filename - Endpoint to fetch and render a markdown file for a project
// 9. GET /offer/:filename - Endpoint to fetch and render a markdown file for an offer
// 10. GET /imgcollection/:filename - Endpoint to fetch and render a markdown file for an image collection
// 11. POST /save-markdown - Endpoint to save a hashed file to Dropbox


// Get the hostname of the current machine

dotenv.config(); // Load environment variables from .env file






// Protected route app.use('/prot', protectedRoutes);
router.get('/protected', isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('username');
    res.send(`Innlogget Bruker: ${user.username} ${user.id}`);
  } catch (ex) {
    console.error(ex);
    res.status(500).send('An error occurred while processing your request.');
  }
});



// Function to refresh the access token
async function refreshAccessToken() {
  const params = new URLSearchParams();
  params.append('grant_type', 'refresh_token');
  params.append('refresh_token', refreshToken);

  try {
    const response = await axios.post('https://api.dropboxapi.com/oauth2/token', params, {
      auth: {
        username: process.env.DROPBOX_APP_KEY,
        password: process.env.DROPBOX_APP_SECRET,
      },
    });

    const newAccessToken = response.data.access_token;
    const expiresIn = response.data.expires_in; // Expiry time in seconds
    expiryTime = Date.now() + expiresIn * 1000; // Current time + expiry duration in ms

    // Update the global access token
    accessToken = newAccessToken;

    return newAccessToken;
  } catch (error) {
    console.error('Error refreshing access token:', error);
    throw error;
  }
}

// Middleware to refresh the access token if expired
async function ensureValidToken(req, res, next) {
  if (!accessToken || Date.now() >= expiryTime) {
    try {
      accessToken = await refreshAccessToken();
    } catch (error) {
      return res.status(500).json({
        message: 'Error refreshing access token',
        error: error.message,
      });
    }
  }
  next();
}

// Endpoint to start the OAuth flow
router.get('/auth', (req, res) => {
  const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${process.env.DROPBOX_APP_KEY}&response_type=code&redirect_uri=${REDIRECT_URI}&token_access_type=offline`;
  //res.redirect(authUrl);
  console.log(authUrl);

});

// Callback endpoint to handle the authorization code
router.get('/auth/callback', async (req, res) => {
  const { code } = req.query;
  const params = new URLSearchParams();
  params.append('code', code);
  params.append('grant_type', 'authorization_code');
  params.append('client_id', process.env.DROPBOX_APP_KEY);
  params.append('client_secret', process.env.DROPBOX_APP_SECRET);
  params.append('redirect_uri', config.REDIRECT_URI);


  try {
    const response = await axios.post('https://api.dropboxapi.com/oauth2/token', params);
    accessToken = response.data.access_token;
    refreshToken = response.data.refresh_token;
    const expiresIn = response.data.expires_in; // Expiry time in seconds
    expiryTime = Date.now() + expiresIn * 1000; // Current time + expiry duration in ms

    res.json({
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: response.data.expires_in,
    });
  } catch (error) {
    console.error('Error obtaining tokens:', error);
    res.status(500).send('Error obtaining tokens');
  }
});

// Endpoint to list files in a folder
router.get('/list-image-files', ensureValidToken, async (req, res) => {
    const folderPath = '/Slowyou.net/Images'; // Root directory
    console.log(`Requesting path: ${folderPath}`); // Log the path being requested
  
    const dbx = new Dropbox({
      accessToken: accessToken,
      fetch: fetch,
    });
  
    try {
      const response = await dbx.filesListFolder({ path: folderPath });
      const entries = response.result.entries;
  
      // Generate temporary links for each file
      const fileEntriesWithLinks = await Promise.all(entries.map(async (entry) => {
        if (entry['.tag'] === 'file') {
          try {
            const linkResponse = await dbx.filesGetTemporaryLink({ path: entry.path_lower });
            return {
              name: entry.name,
              type: entry['.tag'],
              size: entry.size,
              modified: entry.server_modified,
              url: linkResponse.result.link
            };
          } catch (error) {
            console.error('Error getting temporary link for file:', entry.name, error);
            return null;
          }
        } else {
          return null;
        }
      }));
  
      // Filter out any null entries (failed to get temporary link)
      const validEntries = fileEntriesWithLinks.filter(entry => entry !== null);
  
      res.json(validEntries);
    } catch (error) {
      console.error('Error fetching files from Dropbox:', error);
      res.status(500).json({
        message: 'Error fetching files from Dropbox',
        error: error.error ? error.error.error_summary : error.message
      });
    }
  });
  

  router.get('/list-image-collection-links', ensureValidToken, async (req, res) => {
    const folderPath = '/Slowyou.net/markdown'; // Folder path
    console.log(`Requesting path: ${folderPath}`); // Log the path being requested
  
    const dbx = new Dropbox({
      accessToken: accessToken,
      fetch: fetch,
    });
  
    const filename = 'ImgCollection.md';
    const filePath = `${folderPath}/${filename}`;
  
    try {
      const response = await dbx.filesDownload({ path: filePath });
      const fileContent = response.result.fileBinary.toString('utf-8');

      // Extract image URL from the markdown content
      const imageRegex = /!\[(.*?)\]\((.*?)\)/g;
      const imageMatches = fileContent.matchAll(imageRegex);
      const imageLinksAndNames = Array.from(imageMatches).map(match => ({
        name: match[1],
        url: match[2]
      }));
  
      res.json(imageLinksAndNames);
    } catch (error) {
      console.error('Error fetching markdown file from Dropbox:', error);
      res.status(500).json({
        message: 'Error fetching markdown file from Dropbox',
        error: error.error ? error.error.error_summary : error.message
      });
    }
  });

  // Image Collection Grounding

  router.get('/list-markdown-files', ensureValidToken, async (req, res) => {
    const folderPath = '/Slowyou.net/markdown'; // Folder path
    console.log(`Requesting path: ${folderPath}`); // Log the path being requested
  
    const dbx = new Dropbox({
      accessToken: accessToken,
      fetch: fetch,
    });
  
    try {
      const response = await dbx.filesListFolder({ path: folderPath });
      const entries = await Promise.all(response.result.entries.map(async entry => {
        if (entry['.tag'] === 'file' && entry.name.endsWith('.md')) {
          const linkResponse = await dbx.filesGetTemporaryLink({ path: entry.path_lower });
          return {
            name: entry.name,
            type: entry['.tag'],
            size: entry.size,
            modified: entry.server_modified,
            url: linkResponse.result.link
          };
        }
        return null;
      }));
  
      const validEntries = entries.filter(entry => entry !== null);
      res.json(validEntries);
    } catch (error) {
      console.error('Error fetching files from Dropbox:', error);
      res.status(500).json({
        message: 'Error fetching files from Dropbox',
        error: error.error ? error.error.error_summary : error.message
      });
    }
  });


  // Endpoint to get all documents from mongodb mdfile
  
  router.get('/mdfiles', async (req, res) => {
    try {
  const mdfiles = await MDfile.find({ $or: [ { locked: { $exists: false } }, { locked: false } ] });
 
      res.json(mdfiles);
    } catch (error) {
      console.error('Error fetching mdfiles from MongoDB:', error);
      res.status(500).json({
        message: 'Error fetching mdfiles from MongoDB',
        error: error.message
      });
    }
  });
  
  // Endpoint to fetch and render a markdown file
  router.get('/md/:filename', ensureValidToken, async (req, res) => {
    const filename = req.params.filename;
    const filePath = `/Slowyou.net/markdown/${filename}`;
  
    const dbx = new Dropbox({
      accessToken: accessToken,
      fetch: fetch,
    });
  
    try {
      const response = await dbx.filesDownload({ path: filePath });
      const fileContent = response.result.fileBinary.toString('utf-8');

      // Extract image URL from the markdown content
      const imageRegex = /!\[.*?\]\((.*?)\)/;
      const imageMatch = fileContent.match(imageRegex);
      const imageUrlFromMarkdown = imageMatch ? imageMatch[1] : '';
      const imageTag = `<img src="${imageUrlFromMarkdown}" alt="${filename}" class="img-fluid header-image">`;
      const contentWithoutImage = fileContent.replace(imageRegex, '');

      const htmlContent = marked(contentWithoutImage);

      // Ensure the URL is HTTPS
      const protocol = req.protocol === 'https' ? 'https' : 'http';
      const host = req.get('host');
      const fullUrl = `https://${host}${req.originalUrl}`;
  
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>SlowYou™ Blog</title>
            <link href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css" rel="stylesheet">
            <link rel="stylesheet" href="../../markdown/markdown.css">
        </head>
        <body>
        
        <div id="menu-container"></div> 
        <div style="text-align: center;">
            ${imageTag}
        </div>
        <div class="container">
            ${htmlContent}

            <!-- Facebook Share Button -->
            <div style="text-align: center; margin-top: 20px;">
                <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(fullUrl)}" target="_blank" class="btn btn-primary">
                    Share on Facebook
                </a>
            </div>
        </div>
            
        </body>
        <script>
        function loadMenu() {
            fetch('/menu.html')
                .then(response => response.text())
                .then(data => {
                    document.getElementById('menu-container').innerHTML = data;
                    initializeLanguageSelector(); // Initialize the language selector after loading the menu
                    checkAuthStatus(); // Check auth status after loading the menu
                })
                .catch(error => console.error('Error loading menu:', error));
        }

        document.addEventListener('DOMContentLoaded', () => {
            console.log("DOM fully loaded and parsed");
            loadMenu();
        });
        </script>
        </html>
      `;
  
      res.send(html);
    } catch (error) {
      console.error('Error fetching file from Dropbox:', error);
      res.status(500).json({
        message: 'Error fetching file from Dropbox',
        error: error.error ? error.error.error_summary : error.message
      });
    }
});


router.get('/md-test/:filename', isAuthenticated, ensureValidToken, async (req, res) => {
  const filename = req.params.filename;

  // Assuming that the user has their own directory in Dropbox based on their user ID
  const userId = req.user.id;
  const filePath = `/${userId}/${filename}`;

  const dbx = new Dropbox({
      accessToken: accessToken,
      fetch: fetch,
  });

  try {
      const response = await dbx.filesDownload({ path: filePath });
      const fileContent = response.result.fileBinary.toString('utf-8');

      // Extract image URL from the markdown content
      const imageRegex = /!\[.*?\]\((.*?)\)/;
      const imageMatch = fileContent.match(imageRegex);
      const imageUrlFromMarkdown = imageMatch ? imageMatch[1] : '';
      const imageTag = `<img src="${imageUrlFromMarkdown}" alt="${filename}" class="img-fluid header-image">`;
      const contentWithoutImage = fileContent.replace(imageRegex, '');

      const htmlContent = marked(contentWithoutImage);

      // Ensure the URL is HTTPS
      const protocol = req.protocol === 'https' ? 'https' : 'http';
      const host = req.get('host');
      const fullUrl = `${protocol}://${host}${req.originalUrl}`;

      const html = `
          <!DOCTYPE html>
          <html>
          <head>
              <title>SlowYou™ Blog</title>
              <link href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css" rel="stylesheet">
              <link rel="stylesheet" href="../../markdown/markdown.css">
          </head>
          <body>
          
          <div id="menu-container"></div> 
          <div style="text-align: center;">
              ${imageTag}
          </div>
          <div class="container">
              ${htmlContent}

              <!-- Facebook Share Button -->
              <div style="text-align: center; margin-top: 20px;">
                  <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(fullUrl)}" target="_blank" class="btn btn-primary">
                      Share on Facebook
                  </a>
              </div>
          </div>
              
          </body>
          <script>
          function loadMenu() {
              fetch('/menu.html')
                  .then(response => response.text())
                  .then(data => {
                      document.getElementById('menu-container').innerHTML = data;
                      initializeLanguageSelector(); // Initialize the language selector after loading the menu
                      checkAuthStatus(); // Check auth status after loading the menu
                  })
                  .catch(error => console.error('Error loading menu:', error));
          }

          document.addEventListener('DOMContentLoaded', () => {
              console.log("DOM fully loaded and parsed");
              loadMenu();
          });
          </script>
          </html>
      `;

      res.send(html);
  } catch (error) {
      console.error('Error fetching file from Dropbox:', error);
      res.status(500).json({
          message: 'Error fetching file from Dropbox',
          error: error.error ? error.error.error_summary : error.message
      });
  }
});




router.get('/md/price/:filename', ensureValidToken, async (req, res) => {
  const filename = req.params.filename;
  const filePath = `/Slowyou.net/markdown/${filename}`;

  const dbx = new Dropbox({
    accessToken: accessToken,
    fetch: fetch,
  });

  try {
    const response = await dbx.filesDownload({ path: filePath });
    const fileContent = response.result.fileBinary.toString('utf-8');

    // Extract image URL from the markdown content
    const imageRegex = /!\[.*?\]\((.*?)\)/;
    const imageMatch = fileContent.match(imageRegex);
    const imageUrlFromMarkdown = imageMatch ? imageMatch[1] : '';
    const imageTag = `<img src="${imageUrlFromMarkdown}" alt="${filename}" class="img-fluid header-image">`;
    const contentWithoutImage = fileContent.replace(imageRegex, '');

    const htmlContent = marked(contentWithoutImage);

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
          <title>Blog Post</title>
          <link href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css" rel="stylesheet">
          <style>
              body { font-family: Arial, sans-serif; margin: 2em; }
              pre { background: #f4f4f4; padding: 1em; }
              code { background: #f4f4f4; padding: 0.2em; }
              .header-image { width: 100%; max-height: 300px; object-fit: cover; margin-bottom: 20px; }
          </style>
      </head>
      <body>
      
      <div id="menu-container"></div> 
      <div style="text-align: center;">
          ${imageTag}
      </div>
          <div class="container">
              ${htmlContent}
              <div><script async src="https://js.stripe.com/v3/pricing-table.js"></script>
<stripe-pricing-table pricing-table-id="prctbl_1PkUfcFf3ByP0X11Q3sMzQph"
publishable-key="pk_live_51OnmWsFf3ByP0X11XDQuCtB7QdS2IMaHap97i9gWcZT9G4xEz0WAX5asIzCe1jEbVK3UU8OnZ1ZxLN0Ky2P2ktVo00IKtQqKDH">
</stripe-pricing-table><div>
          </div>
          
      </body>
      <script>
      function loadMenu() {
              fetch('/menu.html')
                  .then(response => response.text())
                  .then(data => {
                      document.getElementById('menu-container').innerHTML = data;
                      initializeLanguageSelector(); // Initialize the language selector after loading the menu
                      checkAuthStatus(); // Check auth status after loading the menu
                  })
                  .catch(error => console.error('Error loading menu:', error));
          }

          document.addEventListener('DOMContentLoaded', () => {
              console.log("DOM fully loaded and parsed");
              loadMenu();
          });
      </script>
      </html>
    `;

    res.send(html);
  } catch (error) {
    console.error('Error fetching file from Dropbox:', error);
    res.status(500).json({
      message: 'Error fetching file from Dropbox',
      error: error.error ? error.error.error_summary : error.message
    });
  }
});




router.get('/md/topdf/:filename', ensureValidToken, async (req, res) => {
  const filename = req.params.filename;
  const filePath = `/Slowyou.net/markdown/${filename}`;
  const tempDir = './public/tempdir';

  const dbx = new Dropbox({
    accessToken: accessToken,
    fetch: fetch,
  });

  try {
    const response = await dbx.filesDownload({ path: filePath });
    const fileContent = response.result.fileBinary.toString('utf-8');

    // Extract image URL from the markdown content
    const imageRegex = /!\[.*?\]\((.*?)\)/;
    const imageMatch = fileContent.match(imageRegex);
    const imageUrlFromMarkdown = imageMatch ? imageMatch[1] : '';
    const contentWithoutImage = fileContent.replace(imageRegex, '');
    const htmlContent = marked(contentWithoutImage);

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
          <title>${filename}</title>
          <link href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css" rel="stylesheet">
          <style>
              body { font-family: Arial, sans-serif; margin: 2em; }
              pre { background: #f4f4f4; padding: 1em; }
              code { background: #f4f4f4; padding: 0.2em; }
          </style>
      </head>
      <body>
          <div class="container">
              ${htmlContent}
          </div>
      </body>
      </html>
    `;

    const outputPdfPath = join(tempDir, `${filename.replace('.md', '')}.pdf`);
    const pythonProcess = spawn('python', [join(__dirname, '..', 'modules', 'micro', 'htmltopdf.py'), outputPdfPath]);

    // Send the HTML content to the Python process via stdin
    pythonProcess.stdin.write(html);
    pythonProcess.stdin.end();

    pythonProcess.stdout.on('data', (data) => {
      //console.log(`${data}`);
    });

    pythonProcess.stderr.on('data', (data) => {
      console.error(`${data}`);
    });

    pythonProcess.on('close', async (code) => {
      console.log(`Python script exited with code ${code}`);

      if (code === 0) {
        // Read the generated PDF file
        const pdfContent = readFileSync(outputPdfPath);

        // Upload the PDF to Dropbox
        const pdfDropboxPath = `/Slowyou.net/pdf/${filename.replace('.md', '')}.pdf`;
        await dbx.filesUpload({
          path: pdfDropboxPath,
          contents: pdfContent,
          mode: 'overwrite',
        });

        // Send a success response
        res.status(200).json({
          message: 'PDF generated and uploaded successfully',
          pdfPath: pdfDropboxPath,
        });
      } else {
        res.status(500).json({
          message: 'Error converting HTML to PDF',
        });
      }
    });

  } catch (error) {
    console.error('Error fetching file from Dropbox:', error);
    res.status(500).json({
      message: 'Error fetching file from Dropbox',
      error: error.error ? error.error.error_summary : error.message,
    });
  }
});



router.get('/project/:filename', ensureValidToken, async (req, res) => {
  const filename = req.params.filename;
  const filePath = `/Slowyou.net/projects/${filename}`;

  const dbx = new Dropbox({
    accessToken: accessToken,
    fetch: fetch,
  });

  try {
    const response = await dbx.filesDownload({ path: filePath });
    const fileContent = response.result.fileBinary.toString('utf-8');

    // Extract image URL from the markdown content
    const imageRegex = /!\[.*?\]\((.*?)\)/;
    const imageMatch = fileContent.match(imageRegex);
    const imageUrlFromMarkdown = imageMatch ? imageMatch[1] : '';
    const imageTag = `<img src="${imageUrlFromMarkdown}" alt="${filename}" class="img-fluid header-image">`;
    const contentWithoutImage = fileContent.replace(imageRegex, '');

    const htmlContent = marked(contentWithoutImage);

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
          <title>Project Suggestion</title>
          <link href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css" rel="stylesheet">
          <style>
              body { font-family: Arial, sans-serif; margin: 2em; }
              pre { background: #f4f4f4; padding: 1em; }
              code { background: #f4f4f4; padding: 0.2em; }
              .header-image { width: 100%; max-height: 300px; object-fit: cover; margin-bottom: 20px; }
          </style>
      </head>
      <body>
      
      <div id="menu-container"></div> 
      <div style="text-align: center;">
          ${imageTag}
      </div>
          <div class="container">
              ${htmlContent}
          </div>
      </body>
      <script>
      function loadMenu() {
              fetch('/menu.html')
                  .then(response => response.text())
                  .then(data => {
                      document.getElementById('menu-container').innerHTML = data;
                      initializeLanguageSelector(); // Initialize the language selector after loading the menu
                      checkAuthStatus(); // Check auth status after loading the menu
                  })
                  .catch(error => console.error('Error loading menu:', error));
          }

          document.addEventListener('DOMContentLoaded', () => {
              console.log("DOM fully loaded and parsed");
              loadMenu();
          });
      </script>
      </html>
    `;

    res.send(html);
  } catch (error) {
    console.error('Error fetching file from Dropbox:', error);
    res.status(500).json({
      message: 'Error fetching file from Dropbox',
      error: error.error ? error.error.error_summary : error.message
    });
  }
});


router.get('/offer/:filename', ensureValidToken, async (req, res) => {
  const filename = req.params.filename;
  const filePath = `/Slowyou.net/offers/${filename}`;

  const dbx = new Dropbox({
    accessToken: accessToken,
    fetch: fetch,
  });

  try {
    const response = await dbx.filesDownload({ path: filePath });
    const fileContent = response.result.fileBinary.toString('utf-8');

    // Extract image URL from the markdown content
    const imageRegex = /!\[.*?\]\((.*?)\)/;
    const imageMatch = fileContent.match(imageRegex);
    const imageUrlFromMarkdown = imageMatch ? imageMatch[1] : '';
    const imageTag = `<img src="${imageUrlFromMarkdown}" alt="${filename}" class="img-fluid header-image">`;
    const contentWithoutImage = fileContent.replace(imageRegex, '');

    const htmlContent = marked(contentWithoutImage);

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
          <title>Project Suggestion</title>
          <link href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css" rel="stylesheet">
          <style>
              body { font-family: Arial, sans-serif; margin: 2em; }
              pre { background: #f4f4f4; padding: 1em; }
              code { background: #f4f4f4; padding: 0.2em; }
              .header-image { width: 100%; max-height: 300px; object-fit: cover; margin-bottom: 20px; }
          </style>
      </head>
      <body>
      
      <div id="menu-container"></div> 
      <div style="text-align: center;">
          ${imageTag}
      </div>
          <div class="container">
              ${htmlContent}
          </div>
      </body>
      <script>
      function loadMenu() {
              fetch('/menu.html')
                  .then(response => response.text())
                  .then(data => {
                      document.getElementById('menu-container').innerHTML = data;
                      initializeLanguageSelector(); // Initialize the language selector after loading the menu
                      checkAuthStatus(); // Check auth status after loading the menu
                  })
                  .catch(error => console.error('Error loading menu:', error));
          }

          document.addEventListener('DOMContentLoaded', () => {
              console.log("DOM fully loaded and parsed");
              loadMenu();
          });
      </script>
      </html>
    `;

    res.send(html);
  } catch (error) {
    console.error('Error fetching file from Dropbox:', error);
    res.status(500).json({
      message: 'Error fetching file from Dropbox',
      error: error.error ? error.error.error_summary : error.message
    });
  }
});



router.get('/imgcollection/:filename', ensureValidToken, async (req, res) => {
  const filename = req.params.filename;
  const filePath = `/Slowyou.net/projects/${filename}`;

  const dbx = new Dropbox({
    accessToken: accessToken,
    fetch: fetch,
  });

  try {
    const response = await dbx.filesDownload({ path: filePath });
    const fileContent = response.result.fileBinary.toString('utf-8');

    // Extract image URL from the markdown content
    
    const htmlContent = marked(fileContent);

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
          <title>Project Suggestion</title>
          <link href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css" rel="stylesheet">
          <style>
              body { font-family: Arial, sans-serif; margin: 2em; }
              pre { background: #f4f4f4; padding: 1em; }
              code { background: #f4f4f4; padding: 0.2em; }
              .header-image { width: 100%; max-height: 300px; object-fit: cover; margin-bottom: 20px; }
          </style>
      </head>
      <body>
      
      <div id="menu-container"></div> 
  
          <div class="container">
              ${htmlContent}
          </div>
      </body>
      <script>
      function loadMenu() {
              fetch('/menu.html')
                  .then(response => response.text())
                  .then(data => {
                      document.getElementById('menu-container').innerHTML = data;
                      initializeLanguageSelector(); // Initialize the language selector after loading the menu
                      checkAuthStatus(); // Check auth status after loading the menu
                  })
                  .catch(error => console.error('Error loading menu:', error));
          }

          document.addEventListener('DOMContentLoaded', () => {
              console.log("DOM fully loaded and parsed");
              loadMenu();
          });
      </script>
      </html>
    `;

    res.send(html);
  } catch (error) {
    console.error('Error fetching file from Dropbox:', error);
    res.status(500).json({
      message: 'Error fetching file from Dropbox',
      error: error.error ? error.error.error_summary : error.message
    });
  }
});






router.post('/save-markdown', isAuthenticated, ensureValidToken, async (req, res) => {
  console.log('Request received to save markdown');

  const { content, documentId } = req.body;  // Use documentId here

  if (!content) {
      console.log('No content provided');
      return res.status(400).json({
          message: 'Content is required to save the file'
      });
  }

  console.log('Content is provided');

  try {
      const userId = req.user.id;
      console.log('User ID:', userId);

      // Get the current user from the database
      const user = await User.findById(userId).select('username');

      if (!user) {
          console.log('User not found');
          return res.status(404).json({
              message: 'User not found'
          });
      }

      console.log('User found:', user);

      let fileDoc;

      if (documentId) {  // Use documentId instead of id
          console.log('Finding existing document by ID:', documentId);
          // If a document ID is provided, find the document and update it
          fileDoc = await MDfile.findById(documentId);
          if (!fileDoc) {
              console.log('Document not found');
              return res.status(404).json({
                  message: 'Document not found'
              });
          }
          fileDoc.content = content;
      } else {
          console.log('Creating new document');
          // If no document ID is provided, create a new document
          fileDoc = new MDfile({
              _id: new mongoose.Types.ObjectId(),
              content: content
          });
      }

      console.log('Saving document to MongoDB');
      // Save to MongoDB
      await fileDoc.save();

      // Define the file path in the user's folder
      const foldername = user.id; // Use the user's ID as the folder name
      const filename = `${fileDoc._id}.md`;
      const filePath = `/${foldername}/${filename}`;

      console.log('FilePath is:', filePath);  // This should output the file path

      // Initialize Dropbox with the refreshed access token
      const dbx = new Dropbox({
          accessToken: accessToken, // Use the refreshed access token from middleware
          fetch: fetch,
      });

      console.log('Uploading file to Dropbox');
      // Upload the file to Dropbox
      await dbx.filesUpload({
          path: filePath,
          contents: content,
          mode: 'overwrite'
      });

      console.log('File uploaded successfully to Dropbox');

      res.status(200).json({
          message: 'File saved successfully',
          id: fileDoc._id,
          filePath: filePath  // Ensure this variable is correctly passed
      });
  } catch (error) {
      console.error('Error saving file to Dropbox or MongoDB:', error);
      res.status(500).json({
          message: 'Error saving file',
          error: error.message
      });
  }
});





router.delete('/filedelete/:id', ensureValidToken, async (req, res) => {
  const id = req.params.id;

  if (!id) {
      return res.status(400).json({
          message: 'Document id is required'
      });
  }

  try {
      const fileDoc = await MDfile.findById(id);
      if (!fileDoc) {
          return res.status(404).json({
              message: 'Document not found'
          });
      }

      const dbx = new Dropbox({
          accessToken: accessToken,
          fetch: fetch,
      });

      const filename = `${fileDoc._id}.md`;
      const filePath = `/Slowyou.net/markdown/${filename}`;

      // Delete the file from Dropbox
      await dbx.filesDeleteV2({ path: filePath });

      // Delete the document from MongoDB
      await MDfile.findByIdAndDelete(id);

      res.status(200).json({
          message: 'File deleted successfully',
      });
  } catch (error) {
      console.error('Error deleting file from Dropbox or MongoDB:', error);
      res.status(500).json({
          message: 'Error deleting file',
          error: error.message
      });
  }
});

router.get('/search', ensureValidToken, async (req, res) => {
    const { query } = req.query;

    if (!query) {
        return res.status(400).json({
            message: 'Search query is required'
        });
    }

    try {
        // Search the MDfile collection for documents containing the query in their content
        const results = await MDfile.find({
            content: { $regex: query, $options: 'i' }
        });

        // Generate an array of results with id and a plain text abstract
        const resultsAbs = results.map(result => {
            // Strip markdown syntax and limit to the first 100 characters for the abstract
            const plainTextContent = sanitizeHtml(marked(result.content), {
                allowedTags: [],
                allowedAttributes: {}
            });
            const abstract = plainTextContent.substring(0, 100) + (plainTextContent.length > 100 ? '...' : '');

            return {
                id: result._id,
                abs: abstract
            };
        });

        // Send the search results as the response
        res.status(200).json(resultsAbs);
    } catch (error) {
        console.error('Error searching for files:', error);
        res.status(500).json({
            message: 'Error searching for files',
            error: error.message
        });
    }
});



// Endpoint to get the content of the document by id
router.get('/file/:id', async (req, res) => {
    const id = req.params.id;

    if (!id) {
        return res.status(400).json({
            message: 'Document id is required'
        });
    }

    try {
        const fileDoc = await MDfile.findById(id);
        if (!fileDoc) {
            return res.status(404).json({
                message: 'Document not found'
            });
        }

        res.status(200).json({
            content: fileDoc.content
        });
    } catch (error) {
        console.error('Error fetching document:', error);
        res.status(500).json({
            message: 'Error fetching document',
            error: error.message
        });
    }
});

//Create a endpoint that is createing a new folder in dropbox with the name of the current user.is

router.get('/createfolder', isAuthenticated, ensureValidToken, async (req, res) => {
  try {
      // Find the user and select their username and ID
      const user = await User.findById(req.user.id).select('username');

      if (!user) {
          return res.status(404).json({
              message: 'User not found'
          });
      }

      // Use the user's ID as the folder name
      const foldername = user.id;

      // Initialize Dropbox with the refreshed access token
      const dbx = new Dropbox({
          accessToken: accessToken, // Use the refreshed access token
          fetch: fetch,
      });

      // Define the folder path in Dropbox
      const folderPath = `/${foldername}`;

      // Create the folder in Dropbox
      const response = await dbx.filesCreateFolderV2({ path: folderPath });

      if (response.result.metadata) {
          // Respond with success if folder was created
          res.status(200).json({
              message: `Folder created successfully for user ID: ${foldername}`,
              folderPath: response.result.metadata.path_display,
          });
      } else {
          res.status(500).json({
              message: 'Failed to create folder in Dropbox',
          });
      }

  } catch (ex) {
      // Log the error and respond with a 500 status code
      console.error('Error creating folder in Dropbox:', ex);
      res.status(500).send('An error occurred while processing your request.');
  }
});



export default router;
