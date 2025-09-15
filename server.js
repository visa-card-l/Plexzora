const express = require('express');
const bodyParser = require('body-parser');
const ejs = require('ejs');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here';

// File paths
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const submissionsFile = path.join(DATA_DIR, 'submissions.json');
const formConfigsFile = path.join(DATA_DIR, 'formConfigs.json');
const usersFile = path.join(DATA_DIR, 'users.json');
const adminSettingsFile = path.join(DATA_DIR, 'adminSettings.json');

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

// Initialize admin settings file
async function initializeAdminSettingsFile() {
  try {
    await fs.access(adminSettingsFile);
    console.log(`Admin settings file exists: ${adminSettingsFile}`);
  } catch {
    await fs.writeFile(adminSettingsFile, JSON.stringify({
      restrictionsEnabled: false,
      formsPerDay: 5,
      linkLifespanSeconds: 3600
    }));
    console.log('Created adminSettings.json');
  }
}

// Load admin settings
async function loadAdminSettings() {
  try {
    const data = await fs.readFile(adminSettingsFile, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error loading admin settings:', err.message);
    return {
      restrictionsEnabled: false,
      formsPerDay: 5,
      linkLifespanSeconds: 3600
    };
  }
}

// Save admin settings
async function saveAdminSettings(settings) {
  try {
    await fs.writeFile(adminSettingsFile, JSON.stringify(settings, null, 2));
    console.log('Saved admin settings to file');
  } catch (err) {
    console.error('Error saving admin settings:', err.message, err.stack);
    throw err;
  }
}

// JWT verification middleware
function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('No token provided in request');
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
(async () => {
  try {
    await ensureDataDir();
    await initializeSubmissionsFile();
    await initializeFormConfigsFile();
    await initializeUsersFile();
    await initializeAdminSettingsFile();
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

// Admin page template
const adminTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Dashboard</title>
  <style>
    body {
      font-family: 'Inter', Arial, sans-serif;
      background: #f8f9fa;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      padding: 20px;
    }
    .admin-container {
      background: white;
      padding: 24px;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      width: 400px;
      max-width: 100%;
      text-align: center;
    }
    h2 {
      font-size: 1.8rem;
      margin-bottom: 20px;
    }
    .error {
      color: red;
      font-size: 0.9rem;
      margin: 10px 0;
      display: none;
    }
    .user-count {
      font-size: 1rem;
      margin: 10px 0;
      color: #333;
    }
    input[type="password"], input[type="number"], select {
      width: 100%;
      padding: 10px;
      margin: 8px 0;
      border-radius: 6px;
      border: 1px solid #ccc;
      font-size: 0.95rem;
    }
    .toggle-container {
      margin: 20px 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .toggle-switch {
      position: relative;
      display: inline-block;
      width: 50px;
      height: 24px;
    }
    .toggle-switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }
    .slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: #ccc;
      transition: 0.4s;
      border-radius: 24px;
    }
    .slider:before {
      position: absolute;
      content: "";
      height: 20px;
      width: 20px;
      left: 2px;
      bottom: 2px;
      background-color: white;
      transition: 0.4s;
      border-radius: 50%;
    }
    input:checked + .slider {
      background-color: #0078ff;
    }
    input:checked + .slider:before {
      transform: translateX(26px);
    }
    button {
      width: 100%;
      padding: 12px;
      background: #0078ff;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 0.95rem;
      cursor: pointer;
      margin-top: 10px;
    }
    button:hover {
      background: #005bb5;
    }
    .form-group {
      margin-bottom: 15px;
    }
  </style>
</head>
<body>
  <div class="admin-container">
    <h2>Admin Dashboard</h2>
    <div id="login-section" <%= isAuthenticated ? 'style="display:none;"' : '' %>>
      <div class="form-group">
        <input type="password" id="admin-password" placeholder="Enter admin password">
        <div id="error-message" class="error"></div>
        <button onclick="login()">Login</button>
      </div>
    </div>
    <div id="settings-section" <%= !isAuthenticated ? 'style="display:none;"' : '' %>>
      <div class="user-count">Total Users: <span id="user-count"><%= userCount %></span></div>
      <div class="toggle-container">
        <label>Enable Restrictions</label>
        <label class="toggle-switch">
          <input type="checkbox" id="restrictions-toggle" <%= restrictionsEnabled ? 'checked' : '' %>>
          <span class="slider"></span>
        </label>
      </div>
      <div class="form-group">
        <label>Forms Per Day</label>
        <input type="number" id="forms-per-day" value="<%= formsPerDay %>" min="1">
      </div>
      <div class="form-group">
        <label>Link Lifespan</label>
        <input type="number" id="link-lifespan" value="<%= linkLifespanValue %>" min="1">
        <select id="link-lifespan-unit">
          <option value="seconds" <%= linkLifespanUnit === 'seconds' ? 'selected' : '' %>>Seconds</option>
          <option value="minutes" <%= linkLifespanUnit === 'minutes' ? 'selected' : '' %>>Minutes</option>
          <option value="hours" <%= linkLifespanUnit === 'hours' ? 'selected' : '' %>>Hours</option>
        </select>
      </div>
      <button onclick="saveSettings()">Save Settings</button>
    </div>
  </div>

  <script>
    async function login() {
      const password = document.getElementById('admin-password').value;
      const errorMessage = document.getElementById('error-message');
      try {
        const response = await fetch('/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });
        const result = await response.json();
        if (response.ok) {
          document.getElementById('login-section').style.display = 'none';
          document.getElementById('settings-section').style.display = 'block';
        } else {
          errorMessage.textContent = result.error || 'Invalid password';
          errorMessage.style.display = 'block';
        }
      } catch (error) {
        errorMessage.textContent = 'An error occurred';
        errorMessage.style.display = 'block';
      }
    }

    async function saveSettings() {
      const restrictionsEnabled = document.getElementById('restrictions-toggle').checked;
      const formsPerDay = parseInt(document.getElementById('forms-per-day').value);
      const linkLifespan = parseInt(document.getElementById('link-lifespan').value);
      const linkLifespanUnit = document.getElementById('link-lifespan-unit').value;
      const errorMessage = document.getElementById('error-message');

      if (isNaN(formsPerDay) || formsPerDay < 1) {
        errorMessage.textContent = 'Forms per day must be at least 1';
        errorMessage.style.display = 'block';
        return;
      }
      if (isNaN(linkLifespan) || linkLifespan < 1) {
        errorMessage.textContent = 'Link lifespan must be at least 1';
        errorMessage.style.display = 'block';
        return;
      }

      try {
        const response = await fetch('/admin/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ restrictionsEnabled, formsPerDay, linkLifespan, linkLifespanUnit })
        });
        const result = await response.json();
        if (response.ok) {
          alert('Settings saved successfully');
          errorMessage.style.display = 'none';
        } else {
          errorMessage.textContent = result.error || 'Failed to save settings';
          errorMessage.style.display = 'block';
        }
      } catch (error) {
        errorMessage.textContent = 'An error occurred while saving settings';
        errorMessage.style.display = 'block';
      }
    }
  </script>
</body>
</html>
`;

// Form template (unchanged)
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
      if (url.match(/^https?:\\/\\//)) return url;
      if (url.match(/\\.[a-z]{2,}$/i)) return 'https://' + url;
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

// Utility to count forms created by a user today
async function countUserFormsToday(userId) {
  const today = new Date().toISOString().split('T')[0];
  let formCount = 0;
  Object.values(formConfigs).forEach(config => {
    if (config.userId === userId && config.createdAt.startsWith(today)) {
      formCount++;
    }
  });
  return formCount;
}

// Utility to check if a form link has expired
function isFormExpired(createdAt, lifespanSeconds) {
  if (!lifespanSeconds) return false;
  const created = new Date(createdAt);
  const now = new Date();
  const elapsedSeconds = (now - created) / 1000;
  return elapsedSeconds > lifespanSeconds;
}

// Auth Route: Get current user info
app.get('/user', verifyToken, async (req, res) => {
  try {
    const user = await loadUserById(req.user.userId);
    if (!user) {
      console.error(`User not found for ID: ${req.user.userId}`);
      return res.status(404).json({ error: 'User not found' });
    }
    const { id, username, email, createdAt } = user;
    res.json({ 
      user: { id, username, email, createdAt },
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

    const users = await loadUsers();
    const existingUser = users.find(u => u.email === email);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists with this email' });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const newUser = {
      id: Date.now().toString(),
      username: username || '',
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

// Admin login route
app.post('/admin/login', async (req, res) => {
  const { password } = req.body;
  const ADMIN_PASSWORD = 'midas';
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid admin password' });
  }
  const adminToken = jwt.sign({ isAdmin: true }, JWT_SECRET, { expiresIn: '1h' });
  res.json({ message: 'Admin login successful', adminToken });
});

// Admin route to render dashboard
app.get('/admin', async (req, res) => {
  try {
    const adminSettings = await loadAdminSettings();
    const users = await loadUsers();
    const userCount = users.length;
    const linkLifespanSeconds = adminSettings.linkLifespanSeconds || 3600;
    let linkLifespanValue = linkLifespanSeconds;
    let linkLifespanUnit = 'seconds';

    if (linkLifespanSeconds >= 3600) {
      linkLifespanValue = Math.floor(linkLifespanSeconds / 3600);
      linkLifespanUnit = 'hours';
    } else if (linkLifespanSeconds >= 60) {
      linkLifespanValue = Math.floor(linkLifespanSeconds / 60);
      linkLifespanUnit = 'minutes';
    }

    const isAuthenticated = !!req.headers['authorization'];
    const html = ejs.render(adminTemplate, {
      isAuthenticated,
      userCount,
      restrictionsEnabled: adminSettings.restrictionsEnabled,
      formsPerDay: adminSettings.formsPerDay || 5,
      linkLifespanValue,
      linkLifespanUnit
    });
    res.set('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    console.error('Error rendering admin page:', error.message, error.stack);
    res.status(500).send('Error rendering admin page');
  }
});

// Admin settings update route
app.post('/admin/settings', async (req, res) => {
  try {
    const { restrictionsEnabled, formsPerDay, linkLifespan, linkLifespanUnit } = req.body;

    if (typeof restrictionsEnabled !== 'boolean') {
      return res.status(400).json({ error: 'restrictionsEnabled must be a boolean' });
    }
    if (!Number.isInteger(formsPerDay) || formsPerDay < 1) {
      return res.status(400).json({ error: 'formsPerDay must be an integer >= 1' });
    }
    if (!Number.isInteger(linkLifespan) || linkLifespan < 1) {
      return res.status(400).json({ error: 'linkLifespan must be an integer >= 1' });
    }
    if (!['seconds', 'minutes', 'hours'].includes(linkLifespanUnit)) {
      return res.status(400).json({ error: 'Invalid linkLifespanUnit' });
    }

    let linkLifespanSeconds = linkLifespan;
    if (linkLifespanUnit === 'minutes') {
      linkLifespanSeconds *= 60;
    } else if (linkLifespanUnit === 'hours') {
      linkLifespanSeconds *= 3600;
    }

    const adminSettings = {
      restrictionsEnabled,
      formsPerDay,
      linkLifespanSeconds
    };

    await saveAdminSettings(adminSettings);
    res.json({ message: 'Admin settings updated successfully' });
  } catch (error) {
    console.error('Error updating admin settings:', error.message, error.stack);
    res.status(500).json({ error: 'Failed to update admin settings', details: error.message });
  }
});

// Dashboard route (MODIFIED to handle expired forms and improve error handling)
app.get('/get', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    let submissions = [];
    try {
      const data = await fs.readFile(submissionsFile, 'utf8');
      submissions = JSON.parse(data);
    } catch (error) {
      console.error(`Error reading or parsing submissions file: ${error.message}`);
      submissions = []; // Fallback to empty array
    }

    // Filter submissions by user
    const userSubmissions = submissions.filter(s => s.userId === userId);

    // Filter form configs by user and check for expiration
    const adminSettings = await loadAdminSettings();
    const userFormConfigs = {};
    Object.entries(formConfigs).forEach(([formId, config]) => {
      if (config.userId === userId) {
        if (adminSettings.restrictionsEnabled && config.expiresAt && isFormExpired(config.createdAt, adminSettings.linkLifespanSeconds)) {
          console.log(`Form ${formId} excluded from dashboard for user ${userId} due to expiration`);
          return;
        }
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
      userId,
      message: 'Dashboard data retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching data for /get:', error.message, error.stack);
    res.status(500).json({ error: 'Failed to fetch dashboard data', details: error.message });
  }
});

// Create new form
app.post('/create', verifyToken, async (req, res) => {
  try {
    console.log('Received /create request:', req.body);
    const userId = req.user.userId;
    const adminSettings = await loadAdminSettings();

    if (adminSettings.restrictionsEnabled) {
      const formsToday = await countUserFormsToday(userId);
      if (formsToday >= adminSettings.formsPerDay) {
        return res.status(403).json({ error: `Form creation limit reached (${adminSettings.formsPerDay} forms per day)` });
      }
    }

    const templateId = req.body.template || 'sign-in';
    const formId = generateShortCode();
    const validActions = ['url', 'message'];
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
      expiresAt: adminSettings.restrictionsEnabled ? new Date(Date.now() + adminSettings.linkLifespanSeconds * 1000).toISOString() : null
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

// Update existing form
app.put('/api/form/:id', verifyToken, async (req, res) => {
  try {
    console.log('Received /api/form/:id PUT request:', req.body);
    const formId = req.params.id;
    const userId = req.user.userId;
    const updatedConfig = req.body;

    if (!formConfigs[formId] || formConfigs[formId].userId !== userId) {
      console.error(`User ${userId} does not have access to form ${formId}`);
      return res.status(404).json({ error: 'Form not found or access denied' });
    }

    const adminSettings = await loadAdminSettings();
    if (adminSettings.restrictionsEnabled && formConfigs[formId].expiresAt && isFormExpired(formConfigs[formId].createdAt, adminSettings.linkLifespanSeconds)) {
      return res.status(403).json({ error: 'Form has expired and cannot be updated' });
    }

    const validActions = ['url', 'message'];
    const config = {
      userId,
      template: updatedConfig.template || formConfigs[formId].template,
      headerText: updatedConfig.headerText || formConfigs[formId].headerText || 'My Form',
      headerColors: Array.isArray(updatedConfig.headerColors) ? updatedConfig.headerColors.map(sanitizeForJs) : formConfigs[formId].headerColors,
      subheaderText: updatedConfig.subheaderText || formConfigs[formId].subheaderText || 'Fill the form',
      subheaderColor: updatedConfig.subheaderColor || formConfigs[formId].subheaderColor || (updatedConfig.theme === 'dark' ? '#d1d5db' : '#555555'),
      placeholders: Array.isArray(updatedConfig.placeholders) ? updatedConfig.placeholders.map(p => ({
        id: sanitizeForJs(p.id),
        placeholder: sanitizeForJs(p.placeholder)
      })) : formConfigs[formId].placeholders,
      borderShadow: updatedConfig.borderShadow || formConfigs[formId].borderShadow || (updatedConfig.theme === 'dark' ? '0 0 0 2px #ffffff' : '0 0 0 2px #000000'),
      buttonColor: updatedConfig.buttonColor || formConfigs[formId].buttonColor || 'linear-gradient(45deg, #00b7ff, #0078ff)',
      buttonTextColor: updatedConfig.buttonTextColor || formConfigs[formId].buttonTextColor || (updatedConfig.buttonColor === '#ffffff' ? '#000000' : '#ffffff'),
      buttonText: updatedConfig.buttonText || formConfigs[formId].buttonText || 'Sign In',
      buttonAction: validActions.includes(updatedConfig.buttonAction) ? updatedConfig.buttonAction : formConfigs[formId].buttonAction || 'url',
      buttonUrl: updatedConfig.buttonUrl ? normalizeUrl(updatedConfig.buttonUrl) : formConfigs[formId].buttonUrl || '',
      buttonMessage: updatedConfig.buttonMessage || formConfigs[formId].buttonMessage || '',
      theme: updatedConfig.theme === 'dark' ? 'dark' : formConfigs[formId].theme || 'light',
      createdAt: formConfigs[formId].createdAt,
      updatedAt: new Date().toISOString(),
      expiresAt: adminSettings.restrictionsEnabled ? new Date(Date.now() + adminSettings.linkLifespanSeconds * 1000).toISOString() : formConfigs[formId].expiresAt
    };

    if (config.buttonAction === 'url' && config.buttonUrl && !normalizeUrl(config.buttonUrl)) {
      console.error('Invalid URL provided:', config.buttonUrl);
      return res.status(400).json({ error: 'Invalid URL provided' });
    }
    if (config.buttonAction === 'message' && !config.buttonMessage) {
      config.buttonMessage = 'Form submitted successfully!';
    }

    formConfigs[formId] = config;
    console.log(`Updated form config for ${formId} for user ${userId}:`, config);
    await saveFormConfigs();

    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const host = req.headers.host || `localhost:${port}`;
    const url = `${protocol}://${host}/form/${formId}`;
    console.log('Generated URL for updated form:', url);
    res.status(200).json({ url, formId, message: 'Form updated successfully' });
  } catch (error) {
    console.error('Error in /api/form/:id PUT:', error.message, error.stack);
    res.status(500).json({ error: 'Failed to update form', details: error.message });
  }
});

// Submit form data
app.post('/form/:id/submit', async (req, res) => {
  const formId = req.params.id;
  
  if (!formConfigs[formId]) {
    console.error(`Form not found for ID: ${formId}`);
    return res.status(404).json({ error: 'Form not found' });
  }

  const adminSettings = await loadAdminSettings();
  if (adminSettings.restrictionsEnabled && formConfigs[formId].expiresAt && isFormExpired(formConfigs[formId].createdAt, adminSettings.linkLifespanSeconds)) {
    return res.status(403).json({ error: 'Form link has expired' });
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

    const mappedData = {};
    Object.entries(formData).forEach(([fieldId, value]) => {
      const customField = config.placeholders.find(p => p.id === fieldId);
      const templateField = template.fields.find(f => f.id === fieldId);
      const displayName = customField?.placeholder || templateField?.placeholder || fieldId;
      mappedData[sanitizeForJs(displayName)] = sanitizeForJs(value);
    });

    const submission = {
      userId,
      formId,
      timestamp: new Date().toISOString(),
      data: mappedData
    };

    console.log(`Attempting to save submission for ${formId} by user ${userId}:`, submission);

    const submissions = JSON.parse(await fs.readFile(submissionsFile, 'utf8'));
    submissions.push(submission);
    await fs.writeFile(submissionsFile, JSON.stringify(submissions, null, 2));

    console.log(`Submission saved successfully for form ${formId} by user ${userId}`);
    res.status(200).json({ message: 'Submission saved successfully' });
  } catch (error) {
    console.error('Error saving submission:', error.message, error.stack);
    res.status(500).json({ error: 'Failed to save submission', details: error.message });
  }
});

// Delete a submission
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

// Delete a form and its submissions
app.delete('/form/:id', verifyToken, async (req, res) => {
  const formId = req.params.id;
  const userId = req.user.userId;

  try {
    if (!formConfigs[formId] || formConfigs[formId].userId !== userId) {
      console.error(`User ${userId} does not have access to form ${formId}`);
      return res.status(404).json({ error: 'Form not found or access denied' });
    }

    const adminSettings = await loadAdminSettings();
    if (adminSettings.restrictionsEnabled && formConfigs[formId].expiresAt && isFormExpired(formConfigs[formId].createdAt, adminSettings.linkLifespanSeconds)) {
      return res.status(403).json({ error: 'Form has expired and cannot be deleted' });
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

// Get user submissions
app.get('/submissions', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    let submissions = [];
    try {
      const data = await fs.readFile(submissionsFile, 'utf8');
      submissions = JSON.parse(data);
    } catch (error) {
      console.error(`Error reading or parsing submissions file: ${error.message}`);
      submissions = [];
    }

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
      userId,
      message: 'Submissions retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching submissions:', error.message, error.stack);
    res.status(500).json({ error: 'Failed to fetch submissions', details: error.message });
  }
});

// Render form page
app.get('/form/:id', async (req, res) => {
  const formId = req.params.id;
  const config = formConfigs[formId];
  
  if (!config) {
    console.error(`Form not found for ID: ${formId}`);
    return res.status(404).send('Form not found');
  }

  const adminSettings = await loadAdminSettings();
  if (adminSettings.restrictionsEnabled && config.expiresAt && isFormExpired(config.createdAt, adminSettings.linkLifespanSeconds)) {
    return res.status(403).send('Form link has expired');
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

// Fetch form configuration for editing
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

    const adminSettings = await loadAdminSettings();
    if (adminSettings.restrictionsEnabled && config.expiresAt && isFormExpired(config.createdAt, adminSettings.linkLifespanSeconds)) {
      return res.status(403).json({ error: 'Form link has expired' });
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

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
}).on('error', (error) => {
  console.error('Server startup error:', error.message, error.stack);
  process.exit(1);
});
