// config.js
import dotenv from 'dotenv';
import os from 'os';

dotenv.config(); // Load environment variables from .env file

const hostname = os.hostname();
console.log(`Hostname: ${hostname}`);

const readfromenv = process.env.PRODUCTION_HOSTNAME;

if (readfromenv) {
  console.log(`Read from .env: ${readfromenv}`);
}

// Set the environment based on the hostname
const isProduction = hostname === process.env.PRODUCTION_HOSTNAME; // Define your production hostname in .env

// Set NODE_ENV based on the detected environment
const NODE_ENV = isProduction ? 'production' : 'development';
console.log(`Environment: ${NODE_ENV}`);

// Determine the base URL based on the environment
const BASE_URL = NODE_ENV === 'production'
  ? process.env.SYSTEM_PRODUCTION_URL
  : process.env.SYSTEM_DEVELOPMENT_URL;

// Determine the redirect URI based on the environment
const REDIRECT_URI = NODE_ENV === 'production'
  ? process.env.DROPBOX_REDIRECT_URI_PROD
  : process.env.DROPBOX_REDIRECT_URI_DEV;

  //Determin the python version based on the enviroment
  const PYTHON_VERSION = NODE_ENV === 'production'
  ? process.env.PYTHON_VERSION_PROD
  : process.env.PYTHON_VERSION_DEV;


export default {
  PYTHON_VERSION,
  NODE_ENV,
  BASE_URL,
  REDIRECT_URI,
  isProduction,
  accessToken: process.env.DROPBOX_ACCESS_TOKEN,
  refreshToken: process.env.DROPBOX_REFRESH_TOKEN,
  expiryTime: 0,
};
