const express = require('express');
const bodyParser = require('body-parser');
const ejs = require('ejs');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Enable CORS for frontend requests
app.use(bodyParser.json());
app.use(express.static('public')); // Optional: for static files
app.set('view engine', 'ejs');

// In-memory storage for form configurations (replace with database in production)
const formConfigs = {};

// EJS template as a string
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
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      padding: 40px 20px;
      box-sizing: border-box;
    }
    .login-container {
      background: <%= theme === 'dark' ? '#2f3b5a' : 'white' %>;
      padding: 20px;
      border-radius: 16px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, <%= theme === 'dark' ? '0.3' : '0.1' %>);
      width: 320px;
      min-height: <%= minHeight %>;
      text-align: center;
      transition: transform 0.3s ease, box-shadow 0.3s ease;
    }
    .login-container:hover {
      transform: scale(1.02);
      box-shadow: 0 8px 24px rgba(0, 0, 0, <%= theme === 'dark' ? '0.4' : '0.15' %>);
    }
    .login-container h2 {
      font-size: 1.8rem;
      font-weight: 700;
      color: <%= theme === 'dark' ? '#ffffff' : '#000000' %>;
      margin: 0 0 10px;
    }
    .login-container p {
      font-size: 0.9rem;
      color: <%= subheaderColor %>;
      margin: 0 0 10px;
    }
    .login-container input, .login-container button {
      width: 100%;
      padding: 14px;
      margin: 10px 0;
      border-radius: 8px;
      font-size: 0.95rem;
      box-sizing: border-box;
    }
    .login-container input {
      border: none;
      box-shadow: <%= borderShadow %>;
      background: <%= theme === 'dark' ? '#3b4a6b' : '#f8f9fa' %>;
      color: <%= theme === 'dark' ? '#f8f9fa' : '#333333' %>;
    }
    .login-container input::placeholder {
      color: <%= theme === 'dark' ? '#b0b8cc' : '#999999' %>;
    }
    .login-container input:focus {
      outline: none;
      box-shadow: 0 0 0 3px rgba(0, 183, 255, 0.3);
    }
    .login-container button {
      background: <%= buttonColor %>;
      color: <%= buttonTextColor %>;
      border: none;
      cursor: pointer;
      font-weight: 500;
      box-shadow: 0 2px 8px rgba(0, 183, 255, 0.3);
      padding: 16px;
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
      transform: translate(-50%, -50%);
      background: <%= theme === 'dark' ? '#2f3b5a' : '#ffffff' %>;
      padding: 20px;
      border-radius: 12px;
      box-shadow: 0 6px 20px rgba(0, 0, 0, <%= theme === 'dark' ? '0.4' : '0.15' %>);
      z-index: 1000;
      max-width: 300px;
      width: 90%;
    }
    .popup.show {
      display: block;
    }
    .popup h4 {
      font-size: 1rem;
      color: <%= theme === 'dark' ? '#f8f9fa' : '#333333' %>;
      margin-bottom: 12px;
    }
    .popup p {
      font-size: 0.85rem;
      color: <%= theme === 'dark' ? '#d1d5db' : '#555555' %>;
      margin-bottom: 12px;
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
    }
    .overlay.show {
      display: block;
    }
    @media (max-width: 768px) {
      .login-container {
        width: 100%;
        max-width: 300px;
        padding: 16px;
      }
      .login-container h2 { font-size: 1.6rem; }
      .login-container p { font-size: 0.8rem; }
      .login-container input, .login-container button { padding: 12px; font-size: 0.9rem; }
      .login-container button { padding: 14px; }
      .popup { max-width: 280px; }
    }
    @media (max-width: 480px) {
      .login-container { max-width: 280px; }
      .login-container h2 { font-size: 1.4rem; }
      .login-container input, .login-container button { font-size: 0.85rem; padding: 10px; }
      .popup { max-width: 260px; }
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
  <div class="popup" id="message-popup">
    <button class="popup-close" id="message-popup-close">&times;</button>
    <h4>Message</h4>
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
          showMessagePopup('Please fill all required fields.');
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

    try {
      loginButton.addEventListener('click', () => {
        if (!checkFormFilled()) return;
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

// Route to save form configuration and generate shareable link
app.post('/create', (req, res) => {
  try {
    console.log('Received /create request:', req.body);
    const formId = generateShortCode();
    const validActions = ['url', 'message'];
    const config = {
      template: req.body.template || 'sign-in',
      headerText: req.body.headerText || 'My Form',
      headerColors: Array.isArray(req.body.headerColors) ? req.body.headerColors.map(sanitizeForJs) : [],
      subheaderText: req.body.subheaderText || 'Fill the form',
      subheaderColor: req.body.subheaderColor || '#555555',
      placeholders: Array.isArray(req.body.placeholders) ? req.body.placeholders.map(p => ({
        id: sanitizeForJs(p.id),
        placeholder: sanitizeForJs(p.placeholder)
      })) : [],
      borderShadow: req.body.borderShadow || '0 0 0 2px #000000',
      buttonColor: req.body.buttonColor || 'linear-gradient(45deg, #00b7ff, #0078ff)',
      buttonTextColor: req.body.buttonTextColor || '#ffffff',
      buttonText: req.body.buttonText || 'Sign In',
      buttonAction: validActions.includes(req.body.buttonAction) ? req.body.buttonAction : 'url',
      buttonUrl: req.body.buttonUrl ? normalizeUrl(req.body.buttonUrl) : '',
      buttonMessage: req.body.buttonMessage || '',
      theme: req.body.theme === 'dark' ? 'dark' : 'light'
    };

    // Validate button configuration
    if (config.buttonAction === 'url' && config.buttonUrl && !normalizeUrl(config.buttonUrl)) {
      console.error('Invalid URL provided:', config.buttonUrl);
      return res.status(400).json({ error: 'Invalid URL provided' });
    }
    if (config.buttonAction === 'message' && !config.buttonMessage) {
      config.buttonMessage = 'Form submitted successfully!';
    }

    formConfigs[formId] = config;
    console.log(`Stored form config for ${formId}:`, config);

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
  console.log(`Server running on port ${port} at ${new Date().toLocaleString('en-US', { timeZone: 'Africa/Lagos' })}`);
});
