
// Import necessary modules
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import User from '../models/User.js';
import bodyParser from 'body-parser';



dotenv.config();
const router = Router();


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const JWT_SECRET = process.env.JWT_SECRET;

function isAuthenticated(req, res, next) {
  try {
    const token = req.cookies.jwtToken;
    if (!token) {
      return res.status(401).json({ status: 'error', message: 'No token provided. Please log in.' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (ex) {
    return res.status(401).json({ status: 'error', message: 'Token verification failed. Please log in.' });
  }
}

// Configure multer for file storage and file type validation
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../images/6667e42bddb09a11a9f4046e');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir); // Set the destination for file uploads
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)); // Set the filename
  }
});

// File type validation
const fileFilter = (req, file, cb) => {
  const filetypes = /jpeg|jpg|png/;
  const mimetype = filetypes.test(file.mimetype);
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Images Only!'));
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 1024 * 1024 * 5 } // Limit file size to 5MB
});



// Define route to upload an image
router.post('/upload', isAuthenticated, upload.single('image'), (req, res) => {
  if (req.file) {
    res.json({
      status: 'success',
      message: 'File uploaded successfully!',
      file: req.file
    });
  } else {
    res.status(400).json({
      status: 'error',
      message: 'Invalid file type. Only .jpg and .png files are allowed!'
    });
  }
});

// Define route to get list of uploaded images
router.get('/images', isAuthenticated, (req, res) => {
  const uploadDir = path.join(__dirname, '../images/6667e42bddb09a11a9f4046e');
  fs.readdir(uploadDir, (err, files) => {
    if (err) {
      return res.status(500).json({ status: 'error', message: 'Error reading upload directory' });
    }
    res.json(files);
  });
});

// Define route to delete an image by filename
router.delete('/images/:filename', isAuthenticated, (req, res) => {
  const uploadDir = path.join(__dirname, '../images/6667e42bddb09a11a9f4046e');
  const filename = req.params.filename;
  const filePath = path.join(uploadDir, filename);

  fs.unlink(filePath, (err) => {
    if (err) {
      return res.status(500).json({ status: 'error', message: 'Error deleting the file' });
    }
    res.json({ status: 'success', message: 'File deleted successfully' });
  });
});

router.post('/save-image', (req, res) => {
  const imageData = req.body.image;
  const textContent = req.body.text;

  if (!imageData) {
      return res.status(400).send('Image data is required');
  }

  if (!textContent) {
      return res.status(400).send('Text content is required');
  }

  const base64Data = imageData.replace(/^data:image\/png;base64,/, "");
  const timestamp = Date.now();
  const imageFilePath = path.join(__dirname, '../images/imageswithquotes/', `image_${timestamp}.png`);
  const textFilePath = path.join(__dirname, '../images/imageswithquotes/', `image_${timestamp}.md`);

  // Ensure the directory exists
  fs.mkdir(path.join(__dirname, '../images/imageswithquotes/'), { recursive: true }, (err) => {
      if (err) {
          console.error('Error creating directory:', err);
          return res.status(500).send('Failed to create directory');
      }

      // Save the image file
      fs.writeFile(imageFilePath, base64Data, 'base64', (err) => {
          if (err) {
              console.error('Error saving image:', err);
              return res.status(500).send('Failed to save image');
          }

          // Save the text file
          fs.writeFile(textFilePath, textContent, (err) => {
              if (err) {
                  console.error('Error saving text:', err);
                  return res.status(500).send('Failed to save text');
              }

              res.status(200).send({ message: 'Image and text saved successfully', imageFilePath, textFilePath });
          });
      });
  });
});


export default router;