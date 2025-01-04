# System Documentation

## Overview

This documentation provides an overview of the `mystmkra.io` application, including its architecture, key components, and functionality. The application is built using Node.js, Express, and MongoDB, and integrates with various APIs such as OpenAI and Dropbox.

## Table of Contents

1. [Architecture](#architecture)
2. [Environment Setup](#environment-setup)
3. [Endpoints](#endpoints)
4. [Models](#models)
5. [Client-Side Functionality](#client-side-functionality)
6. [Error Handling](#error-handling)
7. [Security](#security)

## Architecture

The application follows a modular architecture with the following key components:

- **Server**: The main server file (`server.js`) sets up the Express application, configures middleware, and defines core routes.
- **Routes**: Separate route files handle different functionalities, such as user authentication, Dropbox integration, and assistant management.
- **Models**: Mongoose models define the schema for MongoDB collections.
- **Client-Side**: HTML and JavaScript files handle the user interface and interactions.

## Environment Setup

The application uses environment variables for configuration. Ensure you have a `.env` file with the following variables:

```
PORT=3001
NODE_ENV=development
MONGO_DB_URL=<your-mongodb-url>
OPENAI_API_KEY=<your-openai-api-key>
DROPBOX_APP_KEY=<your-dropbox-app-key>
DROPBOX_APP_SECRET=<your-dropbox-app-secret>
DROPBOX_ACCESS_TOKEN=<your-dropbox-access-token>
DROPBOX_REFRESH_TOKEN=<your-dropbox-refresh-token>
ASSISTANT_ID=<your-assistant-id>
```

## Endpoints

### Server (`server.js`)

- **Home Route**: Serves the main index.html file.
- **Protected Route**: Serves the `mystmkra.html` file for authenticated users.
- **Support Page**: Serves the support.html file.

### Assistants (`routes/assistants.js`)

- **Create Assistant**: `GET /assistants/create-assistant`
- **Retrieve Assistant Files**: `GET /assistants/assistant-files`
- **Retrieve Vector Stores**: `GET /assistants/assistant-vector-stores`
- **Retrieve Vector Store Files**: `GET /assistants/vector-store-files`
- **Create Thread**: `GET /assistants/create-thread`
- **Interact with Assistant**: `POST /assistants/interact-with-assistant`
- **Ask Assistant**: `POST /assistants/ask-assistant`
- **Retrieve Assistant**: `GET /assistants/retrieve-assistant`
- **Add Assistants to DB**: `GET /assistants/add-assistants`
- **List Models**: `GET /assistants/models`

### Dropbox (`routes/dropbox.js`)

- **List Image Files**: `GET /dropbox/list-image-files`
- **List Markdown Files**: `GET /dropbox/list-markdown-files`
- **Fetch Markdown File**: `GET /dropbox/md/:filename`
- **Save Markdown File**: `POST /dropbox/save-markdown`
- **Delete File**: `DELETE /dropbox/filedelete/:id`
- **Search Files**: `GET /dropbox/search`
- **Get File Content**: `GET /dropbox/file/:id`
- **Create Folder**: `GET /dropbox/createfolder`

### Assistants MongoDB (`routes/assistantsmongodb.js`)

- **Add Assistant**: `POST /assistantsdb/add-assistant`
- **Retrieve All Assistants**: `GET /assistantsdb/assistants`
- **Retrieve Assistant by ID**: `GET /assistantsdb/assistants/:id`
- **Update Assistant by ID**: `PUT /assistantsdb/assistants/:id`
- **Delete Assistant by ID**: `DELETE /assistantsdb/assistants/:id`

## Models

### Assistant (`models/assitants.js`)

Defines the schema for assistants stored in MongoDB, including fields such as `id`, `name`, `description`, `model`, `instructions`, `tools`, and more.

## Client-Side Functionality

### showassistant.html

- **Fetch Assistants**: Retrieves and displays a list of assistants.
- **Show Assistant Details**: Displays details of a selected assistant.
- **Update Assistant**: Allows updating the instructions of an assistant.
- **Fetch Vector Stores**: Retrieves and displays vector stores for an assistant.
- **Fetch Vector Store Files**: Retrieves and displays files for a selected vector store.
- **Show Add Assistant Form**: Displays a form to add a new assistant.

## Error Handling

The application includes error handling middleware to catch and respond to errors. Errors are logged to the console, and a generic error message is sent to the client.

## Security

- **Rate Limiting**: Protects the application from brute force attacks by limiting the number of requests per IP.
- **Authentication**: Uses middleware to protect routes and ensure only authenticated users can access certain endpoints.
- **Environment Variables**: Sensitive information such as API keys and database URLs are stored in environment variables.
