import handleTextProcessStep from './textProcess.js';
import handleConnectProcessStep from './connectProcess.js';

// ...existing code...

const stepHandlers = {
  text: handleTextProcessStep,
  connect: handleConnectProcessStep,
  // ...other step handlers...
};

// ...existing code...
