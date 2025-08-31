const express = require('express');
const bodyParser = require('body-parser');
const { customAlphabet } = require('nanoid');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 10000; // Render-compatible port

// Middleware
app.use(bodyParser.json({ limit: '10mb' })); // Handle large JSON payloads
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Store for form states with short IDs
const formStates = new Map();
const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 6);

// EJS template as a string
const formEjsTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><%= state && state.template && templates[state.template] ? templates[state.template].name : 'Custom Form' %></title>
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
  <style>
    body {
      font-family: 'Roboto', sans-serif;
      background: <%= state && state.theme === 'dark' ? '#000000' : '#f8f9fa' %>;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      padding: 40px 20px 20px;
      box-sizing: border-box;
      transition: all 0.3s ease;
      position: relative;
    }

    .login-container {
      background: <%= state && state.theme === 'dark' ? '#2f3b5a' : 'white' %>;
      padding: 20px;
      border-radius: 16px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, <%= state && state.theme === 'dark' ? '0.3' : '0.1' %>);
      width: 320px;
      min-height: 300px;
      height: auto;
      text-align: center;
      transition: transform 0.2s ease, box-shadow 0.3s ease;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
    }

    .login-container:hover {
      transform: scale(1.02);
      box-shadow: 0 8px 24px rgba(0, 0, 0, <%= state && state.theme === 'dark' ? '0.4' : '0.15' %>);
    }

    .login-container h2 {
      font-size: 1.8rem;
      font-weight: 700;
      display: block;
      visibility: visible;
      opacity: 1;
      color: <%= state && state.theme === 'dark' ? '#ffffff' : '#000000' %>;
    }

    .login-container p {
      font-family: 'Roboto', sans-serif;
      font-size: 0.9rem;
      color: <%= state && state.theme === 'dark' ? '#ffffff' : '#555555' %>;
      font-weight: 400;
      display: block;
      visibility: visible;
      opacity: 1;
    }

    .login-container input, .login-container button {
      width: 100%;
      margin-left: auto;
      margin-right: auto;
      padding: 14px;
      margin: 10px 0;
      border-radius: 8px;
      font-size: 0.95rem;
      box-sizing: border-box;
      transition: all 0.2s ease;
    }

    .login-container input {
      border: none;
      box-shadow: <%= state && state.borderShadow ? state.borderShadow : (state && state.theme === 'dark' ? '0 0 0 2px #ffffff' : '0 0 0 2px #000000') %>;
      background: <%= state && state.theme === 'dark' ? '#3b4a6b' : '#f8f9fa' %>;
    }

    .login-container input::placeholder {
      color: <%= state && state.theme === 'dark' ? '#ffffff' : '#999999' %>;
      opacity: 1;
    }

    .login-container input:focus {
      outline: none;
      box-shadow: 0 0 0 3px rgba(0, 183, 255, 0.2);
      background: <%= state && state.theme === 'dark' ? '#3b4a6b' : '#ffffff' %>;
    }

    .login-container button {
      background: <%= state && state.buttonColor ? state.buttonColor : 'linear-gradient(45deg, #00b7ff, #0078ff)' %>;
      color: <%= state && state.buttonTextColor ? state.buttonTextColor : (state && state.buttonColor === '#FFFFFF' ? '#000000' : '#ffffff') %>;
      border: none;
      cursor: pointer;
      font-weight: 500;
      box-shadow: 0 2px 8px rgba(0, 183, 255, 0.3);
      padding: 16px;
      touch-action: manipulation;
    }

    .login-container button:hover {
      background: <%= state && state.buttonColor ? state.buttonColor : 'linear-gradient(45deg, #0078ff, #005eff)' %>;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 183, 255, 0.5);
    }

    .close-button {
      display: block;
      position: absolute;
      top: 12px;
      right: 12px;
      width: 32px;
      height: 32px;
      background: none;
      border: none;
      font-size: 1.4rem;
      font-weight: bold;
      color: <%= state && state.theme === 'dark' ? '#f8f9fa' : '#555555' %>;
      cursor: pointer;
      transition: color 0.2s ease;
      z-index: 1000;
      touch-action: manipulation;
    }

    .close-button:hover {
      color: #ff4757;
    }

    .popup {
      display: none;
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: <%= state && state.theme === 'dark' ? '#2f3b5a' : '#ffffff' %>;
      padding: 16px;
      border-radius: 12px;
      box-shadow: 0 6px 20px rgba(0, 0, 0, <%= state && state.theme === 'dark' ? '0.4' : '0.15' %>);
      z-index: 1000;
      text-align: center;
      max-width: 240px;
    }

    .popup.show {
      display: block;
    }

    .popup h4 {
      font-size: 0.85rem;
      font-weight: 600;
      color: <%= state && state.theme === 'dark' ? '#f8f9fa' : '#333333' %>;
      margin-bottom: 8px;
    }

    .popup p {
      font-size: 0.75rem;
      color: <%= state && state.theme === 'dark' ? '#d1d5db' : '#555555' %>;
      margin-bottom: 8px;
      line-height: 1.4;
    }

    .overlay {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.4);
      z-index: 999;
    }

    .overlay.show {
      display: block;
    }

    @media (max-width: 768px) {
      body {
        padding: 30px 16px 16px;
      }

      .login-container {
        width: 100%;
        max-width: 300px;
        padding: 16px;
      }

      .login-container h2 {
        font-size: 1.6rem;
      }

      .login-container input, .login-container button {
        padding: 12px;
        font-size: 0.9rem;
      }

      .login-container button {
        padding: 14px;
      }

      .close-button {
        top: 12px;
        right: 12px;
        width: 32px;
        height: 32px;
        font-size: 1.4rem;
      }

      .popup {
        width: 80%;
        max-width: 240px;
        padding: 12px;
      }
    }

    @media (max-width: 480px) {
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
      }
    }
  </style>
</head>
<body class="saved-mode">
  <div class="login-container">
    <h2 id="login-header">
      <% 
        const headerText = state && state.headerText ? state.headerText : 'my form';
        let colorIndex = 0;
        for (let i = 0; i < headerText.length; i++) {
          if (headerText[i] === ' ') {
      %>
        <span class="space"> </span>
      <% 
          } else {
            const color = state && state.headerColors && state.headerColors[colorIndex] ? state.headerColors[colorIndex] : '';
            colorIndex++;
      %>
        <span style="color: <%= color %>;"><%= headerText[i] %></span>
      <% 
          }
        }
      %>
    </h2>
    <p id="login-subheader" style="color: <%= state && state.subheaderColor ? state.subheaderColor : (state && state.theme === 'dark' ? '#ffffff' : '#555555') %>;">
      <%= state && state.subheaderText ? state.subheaderText : 'fill the form' %>
    </p>
    <div id="input-fields">
      <% 
        const templateFields = state && state.template && templates[state.template] ? templates[state.template].fields : [];
        const placeholders = state && state.placeholders ? state.placeholders : [];
        const allFields = [];
        
        // Merge template fields with custom placeholders
        templateFields.forEach(field => {
          const customField = placeholders.find(p => p.id === field.id);
          allFields.push({
            id: field.id,
            type: field.type,
            placeholder: customField ? customField.placeholder : field.placeholder
          });
        });

        // Add custom fields
        placeholders.forEach(p => {
          if (!templateFields.find(f => f.id === p.id)) {
            allFields.push({
              id: p.id,
              type: 'text',
              placeholder: p.placeholder
            });
          }
        });

        allFields.forEach(field => {
      %>
        <input 
          type="<%= field.type %>" 
          id="login-<%= field.id %>" 
          placeholder="<%= field.placeholder ? field.placeholder : 'Enter text' %>"
          style="box-shadow: <%= state && state.borderShadow ? state.borderShadow : (state && state.theme === 'dark' ? '0 0 0 2px #ffffff' : '0 0 0 2px #000000') %>;"
        >
      <% 
        });
      %>
    </div>
    <button 
      id="login-button" 
      style="background: <%= state && state.buttonColor ? state.buttonColor : 'linear-gradient(45deg, #00b7ff, #0078ff)' %>; color: <%= state && state.buttonTextColor ? state.buttonTextColor : (state && state.buttonColor === '#FFFFFF' ? '#000000' : '#ffffff') %>;"
    >
      <%= state && state.buttonText ? state.buttonText : (state && state.template && templates[state.template] ? templates[state.template].buttonText : 'Submit') %>
    </button>
  </div>
  <button class="close-button" id="close-button">&times;</button>
  <div class="overlay" id="message-overlay"></div>
  <div class="popup" id="message-popup">
    <button class="popup-close" id="message-popup-close">&times;</button>
    <h4>Message</h4>
    <p id="message-text"></p>
  </div>

  <script>
    const templates = {
      "sign-in": {
        name: "Sign In Form",
        fields: [
          { id: "email", placeholder: "Email", type: "email", validation: { required: true, regex: /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/, errorMessage: "Please enter a valid email address." } },
         indent: 1
          { id: "password", placeholder: "Password", type: "password", validation: { required: true } }
        ],
        buttonText: "Sign In",
        buttonAction: "url",
        buttonUrl: "",
        buttonMessage: ""
      },
      "contact": {
        name: "Contact Form",
        fields: [
          { id: "phone", placeholder: "Phone Number", type: "tel", validation: { required: true } },
          { id: "email", placeholder: "Email", type: "email", validation: { required: true, regex: /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/, errorMessage: "Please enter a valid email address." } }
        ],
        buttonText: "Submit",
        buttonAction: "message",
        buttonUrl: "",
        buttonMessage: "Thank you for contacting us!"
      },
      "payment-checkout": {
        name: "Payment Checkout Form",
        fields: [
          { id: "card-number", placeholder: "Card Number", type: "text", validation: { required: true, regex: /^\\d{4}\\s?\\d{4}\\s?\\d{4}\\s?\\d{4}$/, errorMessage: "Please enter a valid 16-digit card number." } },
          { id: "exp-date", placeholder: "Expiration Date (MM/YY)", type: "text", validation: { required: true } },
          { id: "cvv", placeholder: "CVV", type: "text", validation: { required: true } }
        ],
        buttonText: "Pay Now",
        buttonAction: "message",
        buttonUrl: "",
        buttonMessage: "Payment processed successfully!"
      }
    };

    const loginButton = document.getElementById('login-button');
    const messagePopup = document.getElementById('message-popup');
    const messageOverlay = document.getElementById('message-overlay');
    const messagePopupClose = document.getElementById('message-popup-close');
    const messageText = document.getElementById('message-text');
    const closeButton = document.getElementById('close-button');

    function normalizeUrl(url) {
      if (!url) return null;
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
      const inputs = document.getElementById('input-fields').querySelectorAll('input');
      const templateFields = templates['<%= state && state.template ? state.template : "" %>']?.fields || [];

      for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i];
        const value = input.value.trim();
        const fieldId = input.id.replace('login-', '');
        const templateField = templateFields.find(field => field.id === fieldId);

        if (!value) {
          showMessagePopup('Please fill all fields before proceeding.');
          return false;
        }

        if (templateField && templateField.validation && templateField.validation.regex) {
          if (!templateField.validation.regex.test(value)) {
            showMessagePopup(templateField.validation.errorMessage);
            return false;
          }
        }
      }
      return true;
    }

    loginButton.addEventListener('click', () => {
      if (!checkFormFilled()) {
        return;
      }
      const action = '<%= state && state.buttonAction ? state.buttonAction : "message" %>';
      if (action === 'url') {
        const normalizedUrl = normalizeUrl('<%= state && state.buttonUrl ? state.buttonUrl : "" %>');
        if (normalizedUrl) {
          window.location.href = normalizedUrl;
        } else {
          showMessagePopup('Please enter a valid URL (e.g., www.example.com).');
        }
      } else if (action === 'message') {
        showMessagePopup('<%= state && state.buttonMessage ? state.buttonMessage : "Action completed!" %>');
      }
    });

    messagePopupClose.addEventListener('click', hideMessagePopup);
    messageOverlay.addEventListener('click', hideMessagePopup);

    closeButton.addEventListener('click', () => {
      window.location.href = '/';
    });
  </script>
</body>
</html>
`;

// Write EJS template to views/form.ejs on server start
try {
  const viewsDir = path.join(__dirname, 'views');
  if (!fs.existsSync(viewsDir)) {
    console.log('Creating views directory...');
    fs.mkdirSync(viewsDir, { recursive: true });
  }
  fs.writeFileSync(path.join(viewsDir, 'form.ejs'), formEjsTemplate);
  console.log('EJS template written successfully');
} catch (err) {
  console.error('Error writing EJS template:', err.message);
  process.exit(1);
}

// Create a new form with a short URL
app.post('/create', (req, res) => {
  try {
    const state = req.body;
    // Validate state
    if (!state || typeof state !== 'object' || !state.template) {
      console.error('Invalid form state received:', state);
      return res.status(400).json({ error: 'Invalid form state: template is required' });
    }
    // Validate template
    const validTemplates = ['sign-in', 'contact', 'payment-checkout'];
    if (!validTemplates.includes(state.template)) {
      console.error('Invalid template:', state.template);
      return res.status(400).json({ error: 'Invalid template' });
    }
    const id = nanoid();
    formStates.set(id, state);
    const url = `${req.protocol}://${req.get('host')}/form/${id}`;
    console.log(`Form created with ID: ${id}, URL: ${url}`);
    res.json({ url });
  } catch (err) {
    console.error('Error in /create:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Serve a form by its ID using EJS
app.get('/form/:id', (req, res) => {
  try {
    const id = req.params.id;
    if (!id || typeof id !== 'string') {
      console.error('Invalid form ID:', id);
      return res.status(400).send('Invalid form ID');
    }
    const state = formStates.get(id);
    if (!state) {
      console.error(`Form not found for ID: ${id}`);
      return res.status(404).send('Form not found');
    }
    // Validate state structure
    if (!state.template || typeof state !== 'object') {
      console.error(`Invalid state for ID: ${id}`, state);
      return res.status(400).send('Invalid form state');
    }
    console.log(`Rendering form for ID: ${id}`);
    res.render('form', { state });
  } catch (err) {
    console.error(`Error rendering form for ID: ${req.params.id}:`, err.message);
    res.status(500).send(`Internal server error: ${err.message}`);
  }
});

// Handle root route
app.get('/', (req, res) => {
  res.status(200).send('Backend for live forms is running. Use the frontend editor to create forms.');
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unexpected error:', err.message, err.stack);
  res.status(500).send(`Internal server error: ${err.message}`);
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
