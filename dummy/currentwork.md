 <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/styles/default.min.css" />
  <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet" />
  <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css" />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />
  <link rel="stylesheet" href="https://cdn.materialdesignicons.com/6.5.95/css/materialdesignicons.min.css" />
  <link rel="stylesheet" href="dev.css" />

   <script type="module">
    import { initializeUser, logout } from './js/userService.js';
    import { initializeAssistant } from './js/assistantService.js';
    import { initializeAssistantInputHandler } from './js/assistantInputHandler.js';
    import { initializeSaveToMarkdownHandler, showSaveSuccess } from './js/saveToMarkdownHandler.js';
    import { initializeNewFileHandler } from './js/newFileHandler.js';

    initializeUser();
    initializeNewFileHandler();
  </script>
  <script src="https://code.jquery.com/jquery-3.5.1.slim.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@popperjs/core@2.9.3/dist/umd/popper.min.js"></script>
  <script src="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/js/bootstrap.min.js"></script>

   <li class="nav-item">
              <a class="nav-link active" href="/dashboard.html">Dashboard</a>
            </li>
            <li class="nav-item">
              <a class="nav-link" href="/knowledgeriver.html">KnowledgeRiver</a>
            </li>
            <li class="nav-item">
              <a class="nav-link" href="/systemendpoints.html">Configuration</a>
            </li>