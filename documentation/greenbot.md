# GreenBot Documentation

Welcome to the GreenBot documentation. This document provides an overview of the GreenBot project, with a focus on the latest changes to UserState management and process navigation. These updates are designed to centralize and streamline how GreenBot handles user processes, ensuring a consistent and maintainable codebase.

---

ghdfhdfg

## Overview

GreenBot is a Telegram bot that guides users through various processes—such as creating, editing, viewing, and resetting processes—by leveraging a modular architecture. The key components of GreenBot include:

- **UserState Management:**  
  A centralized approach to initialize, reset, and update user-specific state data using the `processInitializer` module. This ensures that each user’s process-related data (e.g., process ID, current step index, answers) is consistently managed.

- **Process Navigation:**  
  The `processNavigator` module provides functions to navigate through process steps, including going to the first step, moving to the next step, and returning to a previous step. Navigation is integrated with UserState so that the bot accurately tracks the user’s progress.

- **Process Presentation:**  
  The `viewProcessHeader` module is responsible for presenting the process header (title, description, and optional image) to the user. This is typically the first view that users see when they begin a process via a deep-link.

---

## Latest Changes

The recent updates introduce a new centralized module—**processInitializer.js**—to handle all UserState operations. This change helps to avoid duplicating UserState logic across different parts of the bot (such as in the `/start`, `/view`, and `/reset` handlers). The key points include:

1. **Centralized Initialization:**  
   - The `initializeProcess` function resets and initializes the UserState for various process types:
     - `'create_process_manual'`
     - `'create_process_ai'`
     - `'edit_process'`
     - `'view_process'`
     - `'reset'`
   - For process types that require a process ID (e.g., editing or viewing an existing process), the function validates and sets the processId in the UserState.

2. **Consistent User Flow:**  
   - When a user clicks a deep-link (e.g., `/start view_process_<processId>`), the bot extracts the process ID, calls `initializeProcess` with the type `'view_process'`, and then displays the process header.
   - For commands like `/view`, after listing finished processes, `initializeProcess` is called to reset the UserState for a fresh start.
   - The `/reset` callback now uses the `'reset'` process type in `initializeProcess` to clear any lingering state.

3. **Integrated Navigation:**  
   - The process navigation functionality (handled by the `processNavigator` module) remains intact. Once the process header is presented and the UserState is set, users can navigate through process steps using "Next" and "Previous" buttons.
   - The "Start" button in the process header now triggers a callback that calls `goToFirstStep`, initiating the step-by-step navigation.
   - Subsequent navigation actions—"Next" and "Previous"—update the UserState’s `currentStepIndex` accordingly.

---

## Example Usage

Below are examples demonstrating how to initialize a process using the new `initializeProcess` function:

```javascript
// Import the module
import { initializeProcess } from './services/greenbot/processInitializer.js';

// To start a manual process creation:
await initializeProcess(bot, chatId, 'create_process_manual');

// To start an AI-based process creation:
await initializeProcess(bot, chatId, 'create_process_ai');

// To edit an existing process (processId is required):
await initializeProcess(bot, chatId, 'edit_process', processId);

// To view an existing process (processId is required):
await initializeProcess(bot, chatId, 'view_process', processId);

// To reset the current process:
await initializeProcess(bot, chatId, 'reset');
```

For deep-linking, when a user clicks a link like:  
```
https://t.me/<botUsername>?start=view_process_<processId>
```
The `/start` command handler will extract `<processId>`, call `initializeProcess` with the `'view_process'` type, and then use the `viewProcessHeader` module to display the process header.

---

## Additional Resources

For more details on individual modules:
- **processInitializer.js:** Centralizes all UserState operations.
- **processNavigator.js:** Manages navigation through process steps (first step, next, and previous).
- **viewProcessHeader.js:** Presents the process header to the user.

For complete usage instructions and developer guidelines, please refer to the GreenBot repository and the accompanying developer guide.

---

This documentation provides a high-level overview of the latest changes. If you have any questions or need further clarification on any component, please feel free to ask!