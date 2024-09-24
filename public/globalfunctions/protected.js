import express from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';

const app = express();
app.use(cookieParser());

dotenv.config();


const JWT_SECRET = process.env.JWT_SECRET;

function isAuthenticated(req, res, next) {
    try {
        const token = req.cookies.jwtToken;
        if (!token) {
            return res.status(401).send('Access denied. No token provided.');
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (ex) {
        console.error(ex);
        res.status(500).send('An error occurred while authenticating.');
    }
}


export default isAuthenticated;



