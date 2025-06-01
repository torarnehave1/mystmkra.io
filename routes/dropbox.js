import express from 'express';
import { Dropbox } from 'dropbox';

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
import ENVconfig from '../config/config.js';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import User from '../models/User.js';

import config from '../config/config.js';
import {isAuthenticated} from '../auth/auth.js';
import OpenAI from 'openai';
import fetch from 'node-fetch';
import { validateApiToken } from '../auth/apiAuth.js';

console.log(`The application is running in ${config.NODE_ENV} mode.`);
console.log(`REDIR = ${config.REDIRECT_URI}`)

let accessToken = process.env.DROPBOX_ACCESS_TOKEN;
let refreshToken = process.env.DROPBOX_REFRESH_TOKEN;
let expiryTime = 0;

const app = express();
app.use(cookieParser());

dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

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




// Endpoint to create a property template for tagging files in Dropbox


// Endpoint to get the current access token using the refresh token




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


router.get('/select-md-files', ensureValidToken, async (req, res) => {
  try {
      const dbx = new Dropbox({
          accessToken: accessToken,
          fetch: fetch,
      });

      // Define the folder path where Markdown files are stored
      const folderPath = '/mystmkra';

      // Fetch the list of Markdown files from Dropbox
      const response = await dbx.filesListFolder({ path: folderPath });
      const mdFiles = response.result.entries
          .filter(file => file['.tag'] === 'file' && file.name.endsWith('.md'))
          .map(file => ({
              name: file.name,
              path_lower: file.path_lower,
          }));

      // Serve the selection page
      res.send(`
          <!DOCTYPE html>
          <html>
          <head>
              <title>Select Markdown File</title>
              <script>
                  async function previewFile(filePath) {
                      const response = await fetch('/dropbox/preview-md-file?path=' + encodeURIComponent(filePath));
                      const content = await response.text();
                      document.getElementById('preview').innerHTML = content;
                  }
              </script>
          </head>
          <body>
              <h1>Select a Markdown File</h1>
              <ul>
                  ${mdFiles
                      .map(
                          file =>
                              `<li>
                                  <button onclick="previewFile('${file.path_lower}')">${file.name}</button>
                              </li>`
                      )
                      .join('')}
              </ul>
              <div id="preview" style="border: 1px solid #ccc; margin-top: 20px; padding: 10px;">
                  <h2>Preview</h2>
                  <p>Select a file to view its content here.</p>
              </div>
          </body>
          </html>
      `);
  } catch (error) {
      console.error('Error fetching markdown files:', error);
      res.status(500).json({
          message: 'Error fetching markdown files',
          error: error.message,
      });
  }
});



router.get('/preview-md-file', ensureValidToken, async (req, res) => {
  const filePath = req.query.path;

  if (!filePath) {
      return res.status(400).send('File path is required.');
  }

  try {
      const dbx = new Dropbox({
          accessToken: accessToken,
          fetch: fetch,
      });

      // Download the Markdown file content
      const response = await dbx.filesDownload({ path: filePath });
      const fileContent = response.result.fileBinary.toString('utf-8');

      // Convert Markdown to HTML
      const htmlContent = marked(fileContent);

      // Sanitize the HTML for safe rendering
      const sanitizedContent = sanitizeHtml(htmlContent);

      res.send(sanitizedContent);
  } catch (error) {
      console.error('Error fetching markdown file:', error);
      res.status(500).send('Error fetching markdown file.');
  }
});




router.get('/current-access-token', async (req, res) => {
  try {
    // Refresh the access token using the existing function
    const currentAccessToken = await refreshAccessToken();

    // Respond with the current access token
    res.status(200).json({
      message: 'Access token refreshed successfully',
      access_token: currentAccessToken,
    });
  } catch (error) {
    console.error('Error refreshing access token:', error);
    res.status(500).json({
      message: 'Failed to refresh access token',
      error: error.message,
    });
  }
});



router.get('/list-user-folder', isAuthenticated, ensureValidToken, async (req, res) => {
  try {
      const userId = req.user.id; // Assuming the folder name is the user ID
      const folderPath = `/${userId}`; // Use the correct path

      const dbx = new Dropbox({
          accessToken: accessToken, // Use the valid access token
          fetch: fetch,
      });

      // List the contents of the user's folder
      const response = await dbx.filesListFolder({ path: folderPath });

      if (response.result.entries && response.result.entries.length > 0) {
          const contents = response.result.entries.map(entry => ({
              name: entry.name,
              path_lower: entry.path_lower,
              tag: entry['.tag'],
          }));

          res.status(200).json({
              message: `Contents of folder ${folderPath} listed successfully.`,
              folderPath: folderPath,
              contents: contents
          });
      } else {
          res.status(404).json({
              message: 'Folder is empty or not found',
              folderPath: folderPath,
              contents: []
          });
      }
  } catch (error) {
      console.error('Error listing folder contents:', error);
      res.status(500).json({
          message: 'Failed to list folder contents.',
          details: error.message
      });
  }
});


router.get('/list-root-folders', isAuthenticated, ensureValidToken, async (req, res) => {
  try {
      const dbx = new Dropbox({
          accessToken: accessToken, // Use the valid access token
          fetch: fetch,
      });

      // Define the path as an empty string to list from the root of the App's directory
      const folderPath = '';

      // List the contents of the root folder
      const response = await dbx.filesListFolder({ path: folderPath });

      // Check if the folder contains any entries
      if (response.result.entries && response.result.entries.length > 0) {
          const folders = response.result.entries.map(entry => ({
              name: entry.name,
              path_lower: entry.path_lower,
              tag: entry['.tag'],
          }));

          res.status(200).json({
              message: 'Folders listed successfully.',
              folders: folders
          });
      } else {
          res.status(404).json({
              message: 'No folders found in the root directory.',
              folders: []
          });
      }
  } catch (error) {
      console.error('Error listing folders from the root directory:', error);
      res.status(500).json({
          message: 'Failed to list folders from the root directory.',
          details: error.message
      });
  }
});




router.get('/verify-folder', isAuthenticated, ensureValidToken, async (req, res) => {
  try {
      // Find the user and select their ID
      const user = await User.findById(req.user.id).select('username');
      if (!user) {
          return res.status(404).json({
              message: 'User not found'
          });
      }

      // Define the full path to the user's folder
      const folderPath = `/${user.id}`;

      const dbx = new Dropbox({
          accessToken: accessToken,
          fetch: fetch,
      });

      // Try to get metadata for the folder
      const metadata = await dbx.filesGetMetadata({ path: folderPath });

      res.status(200).json({
          message: `Folder metadata retrieved successfully.`,
          metadata: metadata
      });
  } catch (error) {
      console.error('Error retrieving folder metadata:', error);

      let errorMessage = 'Failed to retrieve folder metadata.';
      if (error.error && error.error.error_summary && error.error.error_summary.includes('not_found')) {
          errorMessage = 'Folder not found.';
      }

      res.status(500).json({ message: errorMessage, details: error.message });
  }
});



router.post('/share-folder', isAuthenticated, ensureValidToken, async (req, res) => {
  const { email } = req.body;

  try {
      // Find the user and select their ID
      const user = await User.findById(req.user.id).select('username');
      if (!user) {
          return res.status(404).json({
              message: 'User not found'
          });
      }

      // Define the full path to the user's folder
      const folderPath = `/mystmkra/${user.id}`;

      const dbx = new Dropbox({
          accessToken: accessToken,
          fetch: fetch,
      });

      // Get the metadata to ensure the folder exists and retrieve its ID
      const metadata = await dbx.filesGetMetadata({ path: folderPath });

      let folderId;

      // Check if the folder is already shared
      if (metadata.result['.tag'] === 'folder' && !metadata.result.shared_folder_id) {
          // Share the folder if it is not shared yet
          const shareResponse = await dbx.sharingShareFolder({ path: folderPath });

          if (!shareResponse.result || !shareResponse.result.shared_folder_id) {
              throw new Error('Failed to share folder.');
          }

          folderId = shareResponse.result.shared_folder_id;
      } else {
          folderId = metadata.result.shared_folder_id;
      }

      // Share the folder using its ID
      await dbx.sharingAddFolderMember({
          shared_folder_id: folderId,
          members: [{
              member: {
                  '.tag': 'email',
                  email: email
              },
              access_level: {
                  '.tag': 'viewer'  // Use 'editor' if you want to grant edit access
              }
          }],
          quiet: false  // Set to true if you don't want to send an email notification
      });

      res.status(200).json({ message: 'Folder shared successfully.' });
  } catch (error) {
      console.error('Error sharing folder:', error);

      let errorMessage = 'Failed to share folder.';
      if (error.error && error.error.error_summary && error.error.error_summary.includes('not_found')) {
          errorMessage = 'Folder not found.';
      } else if (error.error && error.error.error_summary && error.error.error_summary.includes('email_unverified')) {
          errorMessage = 'The email address is not verified with Dropbox.';
      }

      res.status(500).json({ message: errorMessage, details: error.message });
  }
});





router.get('/get-shared-folder-id', isAuthenticated, ensureValidToken, async (req, res) => {
  try {
      // Find the user and select their ID
      const user = await User.findById(req.user.id).select('username');
      if (!user) {
          return res.status(404).json({
              message: 'User not found'
          });
      }

      // Define the full path to the user's folder
      const folderPath = `/${user.id}`;

      const dbx = new Dropbox({
          accessToken: accessToken,
          fetch: fetch,
      });

      // Try to list shared folders and see if the user's folder is already shared
      const sharedFoldersList = await dbx.sharingListFolders();

      const sharedFolder = sharedFoldersList.result.entries.find(folder => folder.path_lower === folderPath.toLowerCase());

      if (sharedFolder) {
          // Folder is already shared, return the shared folder ID
          return res.status(200).json({
              message: 'Shared folder ID retrieved successfully.',
              shared_folder_id: sharedFolder.shared_folder_id,
          });
      } else {
          // Folder is not shared, attempt to share it
          try {
              const shareFolderResponse = await dbx.sharingShareFolder({
                  path: folderPath
              });

              return res.status(200).json({
                  message: 'Folder shared successfully.',
                  shared_folder_id: shareFolderResponse.result.shared_folder_id,
              });
          } catch (shareError) {
              console.error('Error sharing folder:', shareError);
              res.status(500).json({
                  message: 'Failed to share the folder.',
                  details: shareError.message,
              });
          }
      }

  } catch (error) {
      console.error('Error retrieving or creating shared folder ID:', error);

      let errorMessage = 'Failed to retrieve or create shared folder ID.';
      if (error.status === 409) {
          if (error.error.error_summary.includes('not_found')) {
              errorMessage = 'Folder not found.';
          } else if (error.error.error_summary.includes('not_a_folder')) {
              errorMessage = 'Specified path is not a folder.';
          } else if (error.error.error_summary.includes('invalid_shared_folder_id')) {
              errorMessage = 'The folder is not shared and cannot be accessed as a shared folder.';
          }
      }

      res.status(500).json({ message: errorMessage, details: error.message });
  }
});


// Protected route app.use('/prot', protectedRoutes);
router.get('/protected', isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('fullName username');
    res.send(`${user.fullName}`);
  } catch (ex) {
    console.error(ex);
    res.status(500).send('An error occurred while processing your request.');
  }
});

//Write a end poin called test
router.get('/test', ensureValidToken, async (req, res) => {
  res.json('Test av Endpoints');
});


router.get('/get-user-id', isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('_id'); // Only select the user ID
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ userId: user._id });
  } catch (ex) {
    console.error(ex);
    res.status(500).json({ message: 'An error occurred while processing your request.' });
  }
});


router.post('/add-tag-to-file', isAuthenticated, ensureValidToken, async (req, res) => {
  const foldername = req.user.id;
  const templateId = 'ptid:_ujB2H4nu48AAAAAAAE20g';

  const { documentId, tag } = req.body;
  const filePath = `/mystmkra/${foldername}/${documentId}.md`;

  if (!filePath || !tag) {
    return res.status(400).json({
      message: 'File path and tag are required',
    });
  }

  try {
    // Step 1: Fetch existing tags
    const searchPayload = {
      queries: [{
        logical_operator: "or_operator",
        mode: {
          ".tag": "field_name",
          "field_name": "tag"
        },
        query: ""
      }],
      template_filter: {
        ".tag": "filter_none"
      }
    };

    const getResponse = await axios.post('https://api.dropboxapi.com/2/file_properties/properties/search', searchPayload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    let currentTags = '';
    if (getResponse.data.matches && getResponse.data.matches.length > 0) {
      // Assuming the 'tag' field exists and extracting the current value
      const field = getResponse.data.matches[0].properties[0].fields.find(f => f.name === 'tag');
      currentTags = field ? field.value : '';
    }

    // Step 2: Combine the new tag with existing tags
    const updatedTags = currentTags ? `${currentTags}, ${tag}` : tag;

    // Step 3: Overwrite the property with the updated tags
    const overwritePayload = {
      path: filePath,
      property_groups: [
        {
          template_id: templateId,
          fields: [
            {
              name: 'tag',
              value: updatedTags,  // Updated tags
            },
          ],
        },
      ],
    };

    const overwriteResponse = await axios.post('https://api.dropboxapi.com/2/file_properties/properties/overwrite', overwritePayload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    res.status(200).json({
      message: 'Tag updated successfully',
      details: overwriteResponse.data,
    });

  } catch (error) {
    console.error('Error updating tag on file:', error.response?.data || error.message);
    res.status(500).json({
      message: 'Failed to update tag on file',
      error: error.response?.data || error.message,
    });
  }
});





router.post('/test2', ensureValidToken, async (req, res) => {
  const url = 'https://api.dropboxapi.com/2/file_properties/templates/add_for_user';

  // Define the template payload
  const templatePayload = {
    name: 'File Tags',
    description: 'Template for adding tags to files',
    fields: [
      {
        name: 'tag',
        description: 'Tag for categorizing files',
        type: {
          '.tag': 'string',
        },
      },
    ],
  };

  try {
    // Send the POST request to Dropbox API
    const response = await axios.post(url, templatePayload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    // Respond with the Dropbox API response
    res.status(200).json({
      message: 'Template created successfully',
      template_id: response.data.template_id,
      details: response.data,
    });
  } catch (error) {
    console.error('Error creating template:', error.response?.data || error.message);
    res.status(500).json({
      message: 'Failed to create template',
      error: error.response?.data || error.message,
    });
  }
});


// Endpoint to start the OAuth flow
router.get('/auth', (req, res) => {
  const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${process.env.DROPBOX_APP_KEY}&response_type=code&redirect_uri=${process.env.DROPBOX_REDIRECT_URI_DEV}&token_access_type=offline`;
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
 
  

  router.get('/blog/:userFolder/:filename', ensureValidToken, async (req, res) => {
    const userFolder = req.params.userFolder;
    let filename = req.params.filename;

    // Check if the request is for .html and map it to .md
    if (filename.endsWith('.html')) {
        filename = filename.replace('.html', '.md');
    }

    const filePath = `/mystmkra/${userFolder}/${filename}`;

    const dbx = new Dropbox({
        accessToken: accessToken,
        fetch: fetch,
    });

    try {
        const response = await dbx.filesDownload({ path: filePath });
        const fileContent = response.result.fileBinary.toString('utf-8');

        // Extract the first title from the markdown content (o:tittel)
        const titleRegex = /^#\s+(.*)$/m;
        const titleMatch = fileContent.match(titleRegex);
        const title = titleMatch ? titleMatch[1].trim() : 'Default Title';

        // Extract the first paragraph after the title (o:description)
        const descriptionRegex = /(?:^#\s+.*$)\s+([\s\S]+?)(?:\n\s*\n|\n$)/m;
        const descriptionMatch = fileContent.match(descriptionRegex);
        let description = descriptionMatch ? descriptionMatch[1].trim() : 'Default Description';

        // Limit the description to 100 characters
        if (description.length > 100) {
            description = description.substring(0, 100) + '...';
        }

        // Extract image URL from the markdown content (if any)
        const imageRegex = /!\[.*?\]\((.*?)\)/;
        const imageMatch = fileContent.match(imageRegex);
        let imageUrlFromMarkdown = imageMatch ? imageMatch[1] : '';

        // Remove the image markdown to get content without image for rendering
        const contentWithoutImage = fileContent.replace(imageRegex, '');

        // Use the base URL from the configuration
        const baseUrl = ENVconfig.BASE_URL;

        // Ensure image URL is correctly set for production
        if (process.env.NODE_ENV === 'production') {
            if (imageUrlFromMarkdown.includes('localhost')) {
                imageUrlFromMarkdown = imageUrlFromMarkdown.replace('http://localhost:3001', baseUrl);
            }
        }

        // Construct the full image URL
        const fullImageUrl = imageUrlFromMarkdown.startsWith('http')
            ? imageUrlFromMarkdown
            : `${baseUrl}${imageUrlFromMarkdown}`;

        // Construct the full URL of the blog post
        const fullUrl = `${baseUrl}${req.originalUrl}`;

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <!-- Facebook Open Graph Meta Tags -->
                <meta property="og:title" content="${title}" />
                <meta property="og:description" content="${description}" />
                <meta property="og:image" content="${fullImageUrl}" />
                <meta property="og:url" content="${fullUrl}" />
                <meta property="og:type" content="article" />
                <meta property="og:site_name" content="MystMkra.io" />
                <meta property="fb:app_id" content="303190016195319" /> <!-- Replace with your actual Facebook App ID -->
                
                <title>${title}</title>
                <link href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css" rel="stylesheet">
                <link rel="stylesheet" href="/markdown.css">
            </head>
            <body>
            
            <div id="menu-container"></div> 
            <div style="text-align: center;">
                <img src="${fullImageUrl}" alt="${filename}" class="img-fluid header-image">
            </div>
            <div class="container">
                ${marked(contentWithoutImage)}

                <!-- Facebook Share Button -->
                <div style="text-align: center; margin-top: 20px;">
                    <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(fullUrl)}" target="_blank" class="btn btn-primary">
                        Share on Facebook
                    </a>
                </div>
            </div>
            
            <!-- Footer -->
            <footer style="text-align: center; margin-top: 20px;">
                <a href="http://mystmkra.io" target="_blank">
                    <img src="https://cdn.midjourney.com/3fa18eeb-2dd5-4e1d-b801-c71f3b0648e0/0_2.png" alt="Footer Image" class="img-fluid footer-image" style="max-width: 100%; height: auto;">
                </a>
            </footer>

            </body>
            
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


router.get('/chatgpt/:userFolder/:filename', async (req, res) => {
  const userFolder = req.params.userFolder;
  let filename = req.params.filename;

  // Check if the request is for .html and map it to .md
  if (filename.endsWith('.html')) {
      filename = filename.replace('.html', '.md');
  }

  const filePath = `/mystmkra/${userFolder}/${filename}`;

  const dbx = new Dropbox({
      accessToken: accessToken,
      fetch: fetch,
  });

  try {
      const response = await dbx.filesDownload({ path: filePath });
      const fileContent = response.result.fileBinary.toString('utf-8');

      // Extract the first title from the markdown content (o:tittel)
      const titleRegex = /^#\s+(.*)$/m;
      const titleMatch = fileContent.match(titleRegex);
      const title = titleMatch ? titleMatch[1].trim() : 'Default Title';

      // Extract the first paragraph after the title (o:description)
      const descriptionRegex = /(?:^#\s+.*$)\s+([\s\S]+?)(?:\n\s*\n|\n$)/m;
      const descriptionMatch = fileContent.match(descriptionRegex);
      let description = descriptionMatch ? descriptionMatch[1].trim() : 'Default Description';

      // Limit the description to 100 characters
      if (description.length > 100) {
          description = description.substring(0, 100) + '...';
      }

      // Extract image URL from the markdown content (if any)
      const imageRegex = /!\[.*?\]\((.*?)\)/;
      const imageMatch = fileContent.match(imageRegex);
      let imageUrlFromMarkdown = imageMatch ? imageMatch[1] : '';

      // Remove the image markdown to get content without image for rendering
      const contentWithoutImage = fileContent.replace(imageRegex, '');

      // Use the base URL from the configuration
      const baseUrl = ENVconfig.BASE_URL;

      // Ensure image URL is correctly set for production
      if (process.env.NODE_ENV === 'production') {
          if (imageUrlFromMarkdown.includes('localhost')) {
              imageUrlFromMarkdown = imageUrlFromMarkdown.replace('http://localhost:3001', baseUrl);
          }
      }

      // Construct the full image URL
      const fullImageUrl = imageUrlFromMarkdown.startsWith('http')
          ? imageUrlFromMarkdown
          : `${baseUrl}${imageUrlFromMarkdown}`;

      // Construct the full URL of the blog post
      const fullUrl = `${baseUrl}${req.originalUrl}`;

      const html = `
          <!DOCTYPE html>
          <html>
          <head>
              <!-- Facebook Open Graph Meta Tags -->
              <meta property="og:title" content="${title}" />
              <meta property="og:description" content="${description}" />
              <meta property="og:image" content="${fullImageUrl}" />
              <meta property="og:url" content="${fullUrl}" />
              <meta property="og:type" content="article" />
              <meta property="og:site_name" content="MystMkra.io" />
              <meta property="fb:app_id" content="303190016195319" /> <!-- Replace with your actual Facebook App ID -->
              
              <title>${title}</title>
              <link href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css" rel="stylesheet">
              <link rel="stylesheet" href="/markdown.css">
          </head>
          <body>
          
          <div id="menu-container"></div> 
          <div style="text-align: center;">
              <img src="${fullImageUrl}" alt="${filename}" class="img-fluid header-image">
          </div>
          <div class="container">
              ${marked(contentWithoutImage)}

              <!-- Facebook Share Button -->
              <div style="text-align: center; margin-top: 20px;">
                  <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(fullUrl)}" target="_blank" class="btn btn-primary">
                      Share on Facebook
                  </a>
              </div>
          </div>
          
          <!-- Footer -->
          <footer style="text-align: center; margin-top: 20px;">
              <a href="http://mystmkra.io" target="_blank">
                  <img src="https://cdn.midjourney.com/3fa18eeb-2dd5-4e1d-b801-c71f3b0648e0/0_2.png" alt="Footer Image" class="img-fluid footer-image" style="max-width: 100%; height: auto;">
              </a>
          </footer>

          </body>
          
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





  // Endpoint to fetch and render a markdown file
  router.get('/md/:filename', isAuthenticated , ensureValidToken, async (req, res) => {
    const filename = req.params.filename;
    const curUserFolder = req.user.id;

    const filePath = `/mystmkra/${curUserFolder}/${filename}`;
    

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
            <link rel="stylesheet" href="/markdown.css">
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

  const { content, documentId, title } = req.body;  // Use documentId here
  const userid = req.user.id;

  if (!content) {
    console.log('No content provided');
    return res.status(400).json({
      message: 'Content is required to save the file'
    });
  }

  console.log('Content is provided');

  try {
    console.log('User ID:', userid);

    // Get the current user from the database
    const user = await User.findById(userid).select('username');

    if (!user) {
      console.log('User not found');
      return res.status(404).json({
        message: 'User not found'
      });
    }

    console.log('User found:', user);

    let fileDoc;

    console.log('Document ID XXXXX:', documentId);



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
      console.log('Document found:', fileDoc);
      fileDoc.content = content;
      fileDoc.title = title;
    } else {
      console.log('Creating new document');
      // If no document ID is provided, create a new document
      fileDoc = new MDfile({
        _id: new mongoose.Types.ObjectId(),
        content: content,
        User_id: userid,
        title: title,
      });
    }

    console.log('Saving document to MongoDB');
    // Save to MongoDB
    await fileDoc.save();

    // Construct the full URL
    const fullURL = `https://mystmkra.io/dropbox/blog/${userid}/${fileDoc._id}.md`;

    // Update the document with the full URL
    fileDoc.URL = fullURL;
    await fileDoc.save();

    console.log('Full URL saved to document:', fullURL);

    // Define the file path in the user's folder
    const foldername = userid; // Use the user's ID as the folder name
    const filename = `${fileDoc._id}.md`;
    const filePath = `/mystmkra/${foldername}/${filename}`;

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

    // Generate embeddings
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: [content], // Single document embedding
    });

    const embeddings = response.data[0].embedding;

    // Update the document with the new embeddings
    fileDoc.embeddings = embeddings;
    await fileDoc.save();

    console.log('Embeddings generated and saved to document');

    // Return success response
    console.log('Document saved successfully with ID:', fileDoc._id);
    res.json({
      success: true,
      documentId: fileDoc._id,
      fileUrl: fullURL,
      filePath: filePath,
      title: fileDoc.title,
      tags: fileDoc.tags,
      createdAt: fileDoc.createdAt,
      updatedAt: fileDoc.updatedAt
    });
  } catch (error) {
    console.error('Error saving file to Dropbox or MongoDB:', error);
    res.status(500).json({
      message: 'Error saving file',
      error: error.message
    });
  }
});






router.delete('/filedelete/:id', isAuthenticated, ensureValidToken, async (req, res) => {
  const id = req.params.id;
  const foldername = req.user.id;
  
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
      const filePath = `/mystmkra/${foldername}/${filename}`;
      

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

router.get('/search', isAuthenticated, ensureValidToken, async (req, res) => {
    const { query } = req.query;
    const userid = req.user.id;

    if (!query) {
        return res.status(400).json({
            message: 'Search query is required'
        });
    }

    try {
        let results;
        if (query.startsWith('#')) {
            // Search by tags
            console.log('Searching by tag:', query);
            const tag = query.trim(); // Include the full string with '#'
            console.log('Tag:', tag);
            results = await MDfile.find({
                $and: [
                    { tags: tag },
                    { User_id: userid }
                ]
            }).select('title content');
            console.log('Tag search results:', results);
        } else {
            // Search the MDfile collection for documents containing the query in their content
            results = await MDfile.find({
                $and: [
                    { content: { $regex: query, $options: 'i' } },
                    { User_id: userid }
                ]
            });
            console.log('Content search results:', results);
        }

        if (!results || results.length === 0) {
            console.log('No results found for the query:', query);
            return res.status(404).json({
                message: 'No results found'
            });
        }

        // Generate an array of results with id and a plain text abstract
        const resultsAbs = results.map(result => {
            // Ensure result.content is defined before processing
            if (!result.content) {
                return {
                    id: result._id,
                    abs: 'No content available'
                };
            }

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
      content: fileDoc.content,
      title: fileDoc.title,
      tags: fileDoc.tags || [] // Ensure tags are returned as an array of strings
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


router.get('/createfolderws', isAuthenticated, ensureValidToken, async (req, res) => {
  try {
      // Find the user and select their username, ID, and email
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
      const folderPath = `/mystmkra/${foldername}`;

      // Step 1: Create the folder in Dropbox
      const createFolderResponse = await dbx.filesCreateFolderV2({ path: folderPath });

      if (!createFolderResponse.result.metadata) {
          return res.status(500).json({
              message: 'Failed to create folder in Dropbox',
          });
      }

      // Step 2: Make the folder sharable
      const shareFolderResponse = await dbx.sharingShareFolder({ path: folderPath });

      if (!shareFolderResponse.result || !shareFolderResponse.result.shared_folder_id) {
          return res.status(500).json({
              message: 'Failed to share folder in Dropbox',
          });
      }

      const sharedFolderId = shareFolderResponse.result.shared_folder_id;

      // Step 3: Share the folder with the user's email
      await dbx.sharingAddFolderMember({
          shared_folder_id: sharedFolderId,
          members: [{
              member: {
                  '.tag': 'email',
                  email: user.username // Use the user's email
              },
              access_level: {
                  '.tag': 'viewer'  // Can be 'viewer' or 'editor'
              }
          }],
          quiet: false  // Set to true if you don't want to send an email notification
      });

      // Respond with success if everything was successful
      res.status(200).json({
          message: `Folder created and shared successfully for user ID: ${foldername}`,
          folderPath: createFolderResponse.result.metadata.path_display,
          sharedFolderId: sharedFolderId
      });

  } catch (ex) {
      // Log the error and respond with a 500 status code
      console.error('Error creating or sharing folder in Dropbox:', ex);
      res.status(500).send('An error occurred while processing your request.');
  }
});



// API endpoint for saving markdown documents
router.post('/api/markdown/save', validateApiToken, async (req, res) => {
  console.log('API Request received to save markdown');

  const { content, documentId, title, tags, userId } = req.body;

  if (!content) {
    return res.status(400).json({
      success: false,
      error: 'Content is required to save the file'
    });
  }

  if (!userId) {
    return res.status(400).json({
      success: false,
      error: 'User ID is required'
    });
  }

  try {
    // Get the user from the database
    const user = await User.findById(userId).select('username');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    let fileDoc;

    if (documentId) {
      // If a document ID is provided, find the document and update it
      fileDoc = await MDfile.findById(documentId);
      if (!fileDoc) {
        return res.status(404).json({
          success: false,
          error: 'Document not found'
        });
      }
      fileDoc.content = content;
      fileDoc.title = title || fileDoc.title;
      if (tags) fileDoc.tags = tags;
    } else {
      // If no document ID is provided, create a new document
      fileDoc = new MDfile({
        _id: new mongoose.Types.ObjectId(),
        content: content,
        User_id: userId,
        title: title || 'Untitled Document',
        tags: tags || []
      });
    }

    // Save to MongoDB
    await fileDoc.save();

    // Construct the full URL
    const fullURL = `https://mystmkra.io/dropbox/blog/${userId}/${fileDoc._id}.md`;

    // Update the document with the full URL
    fileDoc.URL = fullURL;
    await fileDoc.save();

    // Refresh Dropbox access token
    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', process.env.DROPBOX_REFRESH_TOKEN);

    const tokenResponse = await axios.post('https://api.dropboxapi.com/oauth2/token', params, {
      auth: {
        username: process.env.DROPBOX_APP_KEY,
        password: process.env.DROPBOX_APP_SECRET,
      },
    });

    const newAccessToken = tokenResponse.data.access_token;

    // Upload to Dropbox with new access token
    const dbx = new Dropbox({
      accessToken: newAccessToken,
      fetch: fetch
    });

    const filePath = `/mystmkra/${userId}/${fileDoc._id}.md`;
    await dbx.filesUpload({
      path: filePath,
      contents: content,
      mode: 'overwrite'
    });

    // Return success response
    res.json({
      success: true,
      data: {
        documentId: fileDoc._id,
        fileUrl: fullURL,
        filePath: filePath,
        title: fileDoc.title,
        tags: fileDoc.tags,
        createdAt: fileDoc.createdAt,
        updatedAt: fileDoc.updatedAt
      }
    });

  } catch (error) {
    console.error('Error saving document:', error);
    res.status(500).json({
      success: false,
      error: 'An error occurred while saving the document',
      details: error.message
    });
  }
});



export default router;
