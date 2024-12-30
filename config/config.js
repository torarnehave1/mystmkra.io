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

const botUsername = NODE_ENV === 'production' ? process.env.BOT2_USERNAME_PROD : process.env.BOT2_USERNAME_DEV;
console.log(`Selected bot username: ${botUsername}`);

const botToken1 = NODE_ENV === 'production' ? process.env.TELEGRAM_BOT1_TOKEN_PROD : process.env.TELEGRAM_BOT1_TOKEN_DEV;
const botToken2 = NODE_ENV === 'production' ? process.env.TELEGRAM_BOT2_TOKEN_PROD : process.env.TELEGRAM_BOT2_TOKEN_DEV;
const botToken3 = NODE_ENV === 'production' ? process.env.TELEGRAM_BOT3_TOKEN_PROD : process.env.TELEGRAM_BOT3_TOKEN_DEV;

const webhookBaseUrl1 = process.env.WEBHOOK_BASE_URL1 || 'https://mystmkra.io/blue';
const webhookBaseUrl2 = process.env.WEBHOOK_BASE_URL2 || 'https://mystmkra.io/green';
const webhookBaseUrl3 = process.env.WEBHOOK_BASE_URL3 || 'https://mystmkra.io/kruth';
const webhookBaseUrl4 = process.env.WEBHOOK_BASE_URL4 || 'https://mystmkra.io/mystmkra';

export default {
  PYTHON_VERSION,
  NODE_ENV,
  BASE_URL,
  REDIRECT_URI,
  isProduction,
  accessToken: process.env.DROPBOX_ACCESS_TOKEN,
  refreshToken: process.env.DROPBOX_REFRESH_TOKEN,
  expiryTime: 0,
  botUsername,
  botToken1,
  botToken2,
  webhookBaseUrl1,
  webhookBaseUrl2,
  webhookBaseUrl3,
  webhookBaseUrl4,
  botToken3,

};
