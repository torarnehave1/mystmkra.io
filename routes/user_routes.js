// routes/auth.js
import express from 'express';
import User from '../models/User.js'; // Import the User model
import mongoose from 'mongoose';
import crypto from 'crypto';
import emailTemplates from '../public/languages/nb.json' with { type: 'json' };
import nodemailer from 'nodemailer';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';
import { join } from 'path';
import fs from 'fs';

// /test
// A simple test endpoint to verify that the route is working.

// /users/:id
// Deletes a user by their ID.

// /register2
// Registers a new user with predefined details for testing purposes.

// /registerbak
// Registers a new user using the provided username and password (backup version).

// /register
// Registers a new user with full details, including full name, username, and password, and sends a verification email.

// /verify-email
// Verifies a user's email address using a token sent to their email.

// /login-bak
// Logs in a user using their username and password (backup version).

// /login
// Logs in a user, sets a JWT token in a cookie, and redirects based on the domain.

// /forgot
// Sends a password reset email to a user if they have forgotten their password.

// /reset-password/:token
// Renders a page for the user to reset their password using a token from the email.

// /save-new-password
// Saves a new password for the user after they have reset it using the token.

// /search/:name
// Searches for users by full name or username and returns matching results.

// /me
// Returns the full name of the currently authenticated user.

dotenv.config()


const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const filePath = path.resolve(__dirname, '..', '..');
const JWT_SECRET = process.env.JWT_SECRET; // Replace with your secret key

// In your Node.js routes file


//create a test endpoint

//Create an endpoint to list all users

router.get('/users-list', async (req, res) => {
    
    try {
        const users = await User.find();
        res.json(users);
        
    } catch (error) {
        //console.error('Failed to fetch users:', error);
        res.status(500).send({ error: 'Error fetching users' });
    }
});



router.get('/test', (req, res) => {
    res.send('Test endpoint is working!');
});

router.get('/register-form', (req, res) => {
    const tag = req.query.tag;  // Capture the custom tag from the query parameter

    // Serve the registration form with Bootstrap styling and information message div
    res.send(`
        <link href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css" rel="stylesheet">

        <div class="container mt-5">
            <h2 class="mb-4">Registration Form</h2>
            <form id="registrationForm">
                <div class="form-group">
                    <label for="name">Name:</label>
                    <input type="text" class="form-control" id="name" name="name" placeholder="Enter your name" required>
                </div>
                
                <div class="form-group">
                    <label for="email">Email:</label>
                    <input type="email" class="form-control" id="email" name="email" placeholder="Enter your email" required>
                </div>
                
                <button type="submit" class="btn btn-primary">Submit</button>
            </form>
            
            <!-- Information message div to display the result -->
            <div id="infoMessage" class="mt-3"></div>
        </div>

        <script>
            document.getElementById('registrationForm').addEventListener('submit', async function(event) {
                event.preventDefault();

                const formData = {
                    name: document.getElementById('name').value,
                    email: document.getElementById('email').value,
                    tag: '${tag}'  // Send the custom tag with the form submission
                };

                const response = await fetch('/submit-registration', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData),
                });

                const infoMessageDiv = document.getElementById('infoMessage');

                if (response.ok) {
                    // Show success message in the information div
                    infoMessageDiv.innerHTML = '<div class="alert alert-success">Registration successful!</div>';
                } else {
                    // Show error message in the information div
                    infoMessageDiv.innerHTML = '<div class="alert alert-danger">Error in registration! Please try again.</div>';
                }
            });
        </script>
    `);
});



// Route to serve the comment form
router.get('/comment-form', (req, res) => {
    const tag = req.query.tag;  // Capture the custom tag from the query parameter (represents the blog post/article)

    // Serve the comment form with Bootstrap styling
    res.send(`
        <link href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css" rel="stylesheet">

        <div class="container mt-5">
            <h2 class="mb-4">Leave a Comment</h2>
            <form id="commentForm">
                <div class="form-group">
                    <label for="name">Name:</label>
                    <input type="text" class="form-control" id="name" name="name" placeholder="Enter your name" required>
                </div>

                <div class="form-group">
                    <label for="email">Email:</label>
                    <input type="email" class="form-control" id="email" name="email" placeholder="Enter your email" required>
                </div>

                <div class="form-group">
                    <label for="comment">Comment:</label>
                    <textarea class="form-control" id="comment" name="comment" rows="4" placeholder="Write your comment..." required></textarea>
                </div>

                <button type="submit" class="btn btn-primary">Submit Comment</button>
            </form>
            
            <!-- Information message div to display the result -->
            <div id="infoMessage" class="mt-3"></div>
        </div>

        <script>
            document.getElementById('commentForm').addEventListener('submit', async function(event) {
                event.preventDefault();

                const formData = {
                    name: document.getElementById('name').value,
                    email: document.getElementById('email').value,
                    comment: document.getElementById('comment').value,
                    tag: '${tag}'  // Send the custom tag with the form submission (to identify the blog post)
                };

                const response = await fetch('/submit-comment', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData),
                });

                const infoMessageDiv = document.getElementById('infoMessage');

                if (response.ok) {
                    // Show success message in the information div
                    infoMessageDiv.innerHTML = '<div class="alert alert-success">Comment submitted successfully!</div>';
                } else {
                    // Show error message in the information div
                    infoMessageDiv.innerHTML = '<div class="alert alert-danger">Error in submitting comment! Please try again.</div>';
                }
            });
        </script>
    `);
});

// Route to handle comment submission (save to database)
router.post('/submit-comment', async (req, res) => {
    const { name, email, comment, tag } = req.body;

    try {
        // Simulate database insert operation (replace with actual database logic)
        const newComment = { name, email, comment, tag, timestamp: new Date() };

        // Insert the comment into your database (e.g., MongoDB, PostgreSQL, etc.)
        // await CommentModel.create(newComment);  // Example using a MongoDB model

        console.log('New Comment:', newComment); // Log the comment for debugging

        // Respond with a success message
        res.status(200).json({ message: 'Comment submitted successfully' });
    } catch (error) {
        console.error('Error submitting comment:', error);
        res.status(500).json({ message: 'Error submitting comment' });
    }
});


router.get('/download-excel', async (req, res) => {
    try {
        // Step 1: Fetch data from MongoDB
        const users = await User.find();

        // Step 2: Create a new workbook and worksheet
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Users');

        // Step 3: Add column headers
        worksheet.columns = [
            { header: 'Full Name', key: 'fullName', width: 30 },
            { header: 'Email', key: 'email', width: 30 },
          
        ];

        // Step 4: Add rows of data
        users.forEach(user => {
            worksheet.addRow({
                fullName: user.fullName,
                email: user.username,
            
            });
        });

        // Step 5: Set file path to save the Excel file temporarily
        const filePath = path.join(__dirname, 'users.xlsx');

        // Step 6: Write the Excel file to disk
        await workbook.xlsx.writeFile(filePath);

        // Step 7: Send the file for download
        res.download(filePath, 'users.xlsx', err => {
            if (err) {
                console.error('Error downloading the file:', err);
            }
            // Optionally, delete the file after sending it
            fs.unlinkSync(filePath);
        });

    } catch (err) {
        res.status(500).send('Error generating Excel file');
        console.error(err);
    }
});


router.delete('/users/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        const user = await User.findById(userId);
       
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        await User.deleteOne({ _id: userId });
        res.status(200).json({ message: 'User deleted successfully.' });
    } catch (error) {
        //console.error(error);
        res.status(500).json({ message: 'An error occurred while deleting the user.' });
    }
});


async function createUser(userData) {
    const user = new User(userData);
    try {
        await user.save();
        //console.log('User saved successfully');
    } catch (err) {
        //console.error('Error saving user: ', err);
    }
}

router.get('/register2', async (req, res) => {
    try {
        const token = crypto.randomBytes(20).toString('hex');
        const hashedPassword = await bcrypt.hash('Mandala1.', 10);

        const user = {
            _id: new mongoose.Types.ObjectId(),
            fullName: 'SlowYou Experten',
            username: 'torarnehave@gmail.com',
            password: hashedPassword,
            dateOfBirth: new Date('1990-01-01'),
            createdAt: new Date(),
            emailVerificationToken: token,
            emailVerificationTokenExpires: Date.now() + 3600000,
        };

        await createUser(user);

        res.send('User registration completed');
    } catch (error) {
        //console.error('Error during user registration:', error);
        res.status(500).send('An error occurred during user registration');
    }
});

router.post('/registerbak', async (req, res) => {
    const { username, password } = req.body;
    const emailVerificationToken = crypto.randomBytes(20).toString('hex');
    const emailVerificationTokenExpires = Date.now() + 3600000;

    try {
        // Check if a user with the same email already exists
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ message: 'A user with this email already exists.' });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create a new user
        const user = new User({ username, password: hashedPassword, emailVerificationToken, emailVerificationTokenExpires });

        // Save the user to the database
        await user.save();

        res.status(201).json({ message: 'User registered successfully.' });
    } catch (error) {
        //console.error(error); // Log the error
        res.status(500).json({ message: 'An error occurred while registering the user.' });
    }
});

router.post('/register', async (req, res) => {
  const { fromPage,fullName, username, password } = req.body;
  //console.log(req.body);

  const emailVerificationToken = crypto.randomBytes(20).toString('hex');
  const emailVerificationTokenExpires = Date.now() + 3600000;

  try {
      const existingUser = await User.findOne({ username });
      if (existingUser) {
          return res.status(400).send({ message: 'A user with this email already exists.' });
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      //console.log('New Hashed Password:', hashedPassword);

      // Compare the plain text password with the hashed password to ensure correctness
      const isMatch = await bcrypt.compare(password, hashedPassword);
      if (!isMatch) {
          //console.error('Error comparing passwords: Passwords do not match');
          return res.status(500).json({ message: 'Error hashing password' });
      } else {
          //console.log('Password match:', isMatch); // Should print: true
      }

      const user = new User({
          fullName: fullName,
        username: username,
          password: hashedPassword,
          emailVerificationToken,
          emailVerificationTokenExpires,
          webpage: fromPage
      });

      await user.save();
      //console.log('User saved successfully');

      const transporter = nodemailer.createTransport({
          service: 'Gmail',
          auth: {
            user: process.env.EMAIL_USERNAME,
            pass: process.env.EMAIL_PASSWORD,
          },
      });

      const mailOptions = {
          from: 'slowyou.net@gmail.com',
          to: user.username,
          subject: emailTemplates.email.verification.subject,
          text: emailTemplates.email.verification.body.replace('{verificationLink}', `https://slowyou.net/a/verify-email?token=${emailVerificationToken}`)
      };

      try {
          const info = await transporter.sendMail(mailOptions);
          //console.log('Email sent: ' + info.response);
      } catch (mailError) {
          //console.error('Error sending email:', mailError);
      }

      res.status(201).send({ message: `User registered successfully. Verification email sent to:${username}`});
  } catch (error) {
      //console.error(error);
      res.status(500).send({ message: 'An error occurred while registering the user.' });
  }


});


router.post('/reg-user-vegvisr', async (req, res) => {
    const { email, token } = req.body;
    //console.log(req.body);

    // Check for the token that is sent to the endpoint with the process token VEGVISR_API_TOKEN in the .env file
    if (token !== process.env.VEGVISR_API_TOKEN) {
        return res.status(401).send('Unauthorized');
    }

    const emailVerificationToken = crypto.randomBytes(20).toString('hex');
    // const emailVerificationTokenExpires = Date.now() + 3600000;

    const transporter = nodemailer.createTransport({
        service: 'Gmail',
        auth: {
            user: process.env.EMAIL_USERNAME,
            pass: process.env.EMAIL_PASSWORD,
        },
    });

    const mailOptions = {
        from: 'vegvisr.org@gmail.com',
        to: email,
        subject: emailTemplates.emailvegvisrorg.verification.subject,
        text: emailTemplates.emailvegvisrorg.verification.body.replace('{verificationLink}', `https://slowyou.net/a/verify-email?token=${emailVerificationToken}`)
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        //console.log('Email sent: ' + info.response);
        res.status(200).send({ message: 'Verification email sent successfully.' });
    } catch (mailError) {
        //console.error('Error sending email:', mailError);
        res.status(500).send({ message: 'Error sending verification email.' });
    }
});


router.get("/verify-email", async (req, res) => {
    const { token } = req.query;

    try {
        // Find a user with the verification token
        const user = await User.findOne({
            emailVerificationToken: token,
            emailVerificationTokenExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).send('Invalid or expired token.');
        }

        // Mark the user as verified
        //user.emailVerificationToken = null;
        //user.emailVerificationTokenExpires = null;
        user.isVerified = true;

        // Save the user
        await user.save();

        //res.send('Your account has been verified.');
        res.redirect('../login.html',);  

    } catch (err) {
        //console.error(err);
        res.status(500).send('Server error.');
    }
});

//user route prefix = 
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await User.findOne({ username });

        if (!user) {
            //console.log('User not found');
            return res.status(400).send('Invalid username or password.');
        }

        //console.log('User found:', user);

        // Check if the user's email has been verified
        if (!user.isVerified) {
            //console.log('User email not verified');
            return res.status(400).send('Please verify your email before logging in.');
        }

        const isMatch = await bcrypt.compare(password, user.password);

        

        if (!isMatch) {
            //console.log('Password does not match');
            return res.status(400).send('Invalid username or password.');
        }

        const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '1h' });
       
        // Set the token as a cookie with SameSite attribute
        res.cookie('jwtToken', token, {
            httpOnly: false,
            sameSite: 'Strict', // or 'Lax' or 'Strict', based on your needs
            secure: false // make sure to use HTTPS
        });

        // Send a redirect response
        res.status(200).json({ message: 'Login successful', redirectUrl: '/index.html' });
    } catch (err) {
        //console.error(err);
        res.status(500).send('Server error.');
    }
});


router.post('/login-bak', async (req, res) => {
    const { username, password } = req.body;
    const host = req.headers.host; // Get the Host header to determine the source

    try {
        const user = await User.findOne({ username });

        if (!user) {
            return res.status(400).send('Invalid username or password.');
        }

        if (!user.isVerified) {
            return res.status(400).send('Please verify your email before logging in.');
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).send('Invalid username or password.');
        }

        const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '1h' });

        // Set the token as a cookie with SameSite attribute
        res.cookie('jwtToken', token, {
            httpOnly: true,  // or false, depending on your requirements
            sameSite: 'Strict', // or 'Lax' or 'None', based on your needs
            secure: host === 'mystmkra.io', // Use HTTPS (secure) only if on mystmkra.io
        });

        let redirectUrl = '/index.html';
        if (host === 'mystmkra.io') {
            redirectUrl = 'https://mystmkra.io/mystmkra.html'; // Custom redirect for mystmkra.io
        }

      
       res.status(200).json({ message: 'Login successful', redirectUrl });
       
        

        //res.status(200).json({ message: 'Login successful', redirectUrl });
    } catch (err) {
        res.status(500).send('Server error.');
    }
});

  

router.get('/forgot', async (req, res) => {
    const { email } = req.query;

    try {
        // Find the user by email
        const user = await User.findOne({ username :email });
        if (!user) {
            return res.status(400).send('User with this email does not exist.');
        }

        // Check if the user's email is verified
        if (!user.isVerified) {
            return res.status(400).send('Email is not verified.');
        }

        // Generate a password reset token
        const token = crypto.randomBytes(20).toString('hex');

        // Associate the token with the user in your database
        user.emailVerificationToken = token;
        await user.save({ validateBeforeSave: false });

        // Send an email to the user with the password reset link
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USERNAME,
                pass: process.env.EMAIL_PASSWORD,
            },
        });

        const mailOptions = {
            from: process.env.EMAIL_USERNAME,
            to: user.username,
            subject: 'Password Reset',
            text: `You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\nPlease click on the following link, or paste this into your browser to complete the process within one hour of receiving it:\n\nhttps://slowyou.net/a/reset-password/${token}\n\nIf you did not request this, please ignore this email and your password will remain unchanged.\n`,
        };

        transporter.sendMail(mailOptions, (err, response) => {
            if (err) {
                //console.error('There was an error sending the recovery email:', err);
                res.status(500).send('An error occurred while sending the recovery email.');
            } else {
                //console.log('Recovery email sent successfully');
                res.status(200).send('Recovery email sent to you email, please check your inbox or spam folder. The recovery email is sent from slowyou.net@gmail.com');
            }
        });
    } catch (error) {
        //console.error('An error occurred while processing the request:', error);
        res.status(500).send('An error occurred while processing your request.');
    }


});

router.get('/reset-password/:token', async (req, res) => {
    try {
        //console.log(req.params.token);
        const user = await User.findOne({ emailVerificationToken: req.params.token });
      
        
        if (!user) {
            return res.status(400).send('Password reset token is invalid or has expired.');
        }

        // Render reset password view
        res.render('reset', { token: req.params.token });
    } catch (error) {
        //console.error(error);
        res.status(500).send('Server error');
    }
});




router.post('/save-new-password', async (req, res) => {
    const { token, password } = req.body;

    try {
        const user = await User.findOne({ emailVerificationToken: token });


        if (!user) {
            return res.status(400).send('Password reset token is invalid or has expired.');
        }

        // Hash the new password and save it to the user
        const hashedPassword = await bcrypt.hash(password, 10);
        user.password = hashedPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        res.send('Your password has been updated.');
        //res.redirect('../login.html',);  
    } catch (error) {
        //console.error(error);
        res.status(500).send('Server error');
    }
});


router.get('/search/:name', async (req, res) => {
    try {
      const users = await User.find({
        $or: [
          { fullName: { $regex: `^${req.params.name}`, $options: 'i' } },
          { username: { $regex: `^${req.params.name}`, $options: 'i' } }
        ]
      });
      if (!users.length) {
        return res.status(404).send({ message: 'User not found' });
      }
      res.json(users);
    } catch (error) {
      //console.error('Failed to fetch user:', error);
      res.status(500).send({ error: 'Error fetching user' });
    }
  });


router.get('/me', async (req, res) => {
    try {
      const user = await User.findById(req.user._id).select('fullName');
      if (!user) {
        return res.status(404).send({ message: 'User not found' });
      }
      res.json({fullName: user.fullName});
    } catch (error) {
      //console.error('Failed to fetch user:', error);
      res.status(500).send({ error: 'Error fetching user' });
    }
  });




export default router;
