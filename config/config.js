import dotenv from 'dotenv';
import os from 'os';

dotenv.config();

const hostname = os.hostname();
console.log(`Hostname: ${hostname}`);
console.log(`Read from .env: ${process.env.PRODUCTION_HOSTNAME}`);

const NODE_ENV = process.env.NODE_ENV || (hostname === process.env.PRODUCTION_HOSTNAME ? 'production' : 'development');
const isProduction = NODE_ENV === 'production';

console.log(`Environment: ${NODE_ENV}`);

const BASE_URL = NODE_ENV === 'production' ? process.env.SYSTEM_PRODUCTION_URL : process.env.SYSTEM_DEVELOPMENT_URL;
const REDIRECT_URI = NODE_ENV === 'production' ? process.env.DROPBOX_REDIRECT_URI_PROD : process.env.DROPBOX_REDIRECT_URI_DEV;

const PYTHON_VERSION = NODE_ENV === 'production' ? process.env.PYTHON_VERSION_PROD : process.env.PYTHON_VERSION_DEV;

const botUsername = NODE_ENV === 'production' ? process.env.BOT1_USERNAME_PROD : process.env.BOT2_USERNAME_DEV;
console.log(`Selected bot username: ${botUsername}`);

const botToken = NODE_ENV === 'production' ? process.env.TELEGRAM_BOT2_TOKEN_PROD : process.env.TELEGRAM_BOT2_TOKEN_DEV;

export default {
  PYTHON_VERSION,
  NODE_ENV,
  BASE_URL,
  REDIRECT_URI,
  isProduction,
  accessToken: process.env.DROPBOX_ACCESS_TOKEN,
  refreshToken: process.env.DROPBOX_REFRESH_TOKEN,
  expiryTime: 0,
  botUsername: botUsername , // Replace with your actual bot username
  botToken,
};
