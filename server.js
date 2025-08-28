const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;
const ejs = require('ejs');

app.use(cors());
app.use(express.json());

const forms = {};
let idCounter = 0;

const templates = {
  "sign-in": {
    name: "Sign In Form",
    fields: [
      { id: "email", placeholder: "Email", type: "email", validation: { required: true, regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, errorMessage: "Please enter a valid email address." } },
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
      { id: "email", placeholder: "Email", type: "email", validation: { required: true, regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, errorMessage: "Please enter a valid email address." } }
    ],
    buttonText: "Submit",
    buttonAction: "message",
    buttonUrl: "",
    buttonMessage: "Thank you for contacting us!"
  },
  "payment-checkout": {
    name: "Payment Checkout Form",
    fields: [
      { id: "card-number", placeholder: "Card Number", type: "text", validation: { required: true, regex: /^\d{4}\s?\d{4}\s?\d{4}\s?\d{4}$/, errorMessage: "Please enter a valid 16-digit card number." } },
      { id: "exp-date", placeholder: "Expiration Date (MM/YY)", type: "text", validation: { required: true } },
      { id: "cvv", placeholder: "CVV", type: "text", validation: { required: true } }
    ],
    buttonText: "Pay Now",
    buttonAction: "message",
    buttonUrl: "",
    buttonMessage: "Payment processed successfully!"
  }
};

const formTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><%= state.headerText || 'Custom Form' %></title>
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
  <style>
    body {
      font-family: 'Roboto', sans-serif;
      background: <%= state.theme === 'dark' ? '#1f2a44' : '#f8f9fa' %>;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      padding: 40px 20px;
      box-sizing: border-box;
      transition: all 0.3s ease;
      position: relative;
    }
    .login-container {
      background: <%= state.theme === 'dark' ? '#2f3b5a' : 'white' %>;
      padding: 20px;
      border-radius: 16px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, <%= state.theme === 'dark' ? '0.3' : '0.1' %>);
      width: 320px;
      min-height: <%= 300 + (state.placeholders.length - templates[state.template].fields.length) * 40 %>px;
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
      box-shadow: 0 8px 24px rgba(0, 0, 0, <%= state.theme === 'dark' ? '0.4' : '0.15' %>);
    }
    .login-container h2 {
      font-size: 1.8rem;
      font-weight: 700;
      color: <%= state.theme === 'dark' ? '#ffffff' : '#000000' %>;
      display: block;
      visibility: visible;
      opacity: 1;
    }
    .login-container p {
      font-size: 0.9rem;
      color: <%= state.subheaderColor || (state.theme === 'dark' ? '#ffffff' : '#555555') %>;
      font-weight: 400;
      display: block;
      visibility: visible;
      opacity: 1;
    }
    .login-container span {
      cursor: default;
      position: relative;
      display: inline-block;
      margin: 0;
      letter-spacing: 0.5px;
      pointer-events: none;
    }
    .login-container span.space {
      margin-right: 4px;
      letter-spacing: 0;
      width: 4px;
      display: inline-block;
    }
    .login-container input, .login-container button {
      width: 100%;
      margin: 10px 0;
      padding: 14px;
      border-radius: 8px;
      font-size: 0.95rem;
      box-sizing: border-box;
      transition: all 0.2s ease;
    }
    .login-container input {
      border: none;
      box-shadow: <%= state.borderShadow || (state.theme === 'dark' ? '0 0 0 2px #ffffff' : '0 0 0 2px #000000') %>;
      background: <%= state.theme === 'dark' ? '#3b4a6b' : '#f8f9fa' %>;
      color: <%= state.theme === 'dark' ? '#f8f9fa' : '#333333' %>;
    }
    .login-container input::placeholder {
      color: <%= state.theme === 'dark' ? '#ffffff' : '#999999' %>;
      opacity: 1;
    }
    .login-container input:focus {
      outline: none;
      box-shadow: 0 0 0 3px rgba(0, 183, 255, 0.2);
      background: <%= state.theme === 'dark' ? '#3b4a6b' : '#ffffff' %>;
    }
    .login-container input:not(:placeholder-shown) {
      background: <%= state.theme === 'dark' ? '#3b4a6b' : '#ffffff' %>;
    }
    .login-container button {
      background: <%= state.buttonColor || 'linear-gradient(45deg, #00b7ff, #0078ff)' %>;
      color: <%= state.buttonTextColor || (state.buttonColor === '#FFFFFF' ? '#000000' : '#ffffff') %>;
      border: none;
      cursor: pointer;
      font-weight: 500;
      box-shadow: 0 2px 8px rgba(0, 183, 255, 0.3);
      padding: 16px;
    }
    .login-container button:hover {
      background: <%= state.buttonColor === '#FFFFFF' ? '#e0e0e0' : (state.buttonColor || 'linear-gradient(45deg, #0078ff, #005eff)') %>;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 183, 255, 0.5);
    }
    .popup {
      display: none;
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: <%= state.theme === 'dark' ? '#2f3b5a' : '#ffffff' %>;
      padding: 16px;
      border-radius: 12px;
      box-shadow: 0 6px 20px rgba(0, 0, 0, <%= state.theme === 'dark' ? '0.4' : '0.15' %>);
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
      color: <%= state.theme === 'dark' ? '#f8f9fa' : '#333333' %>;
      margin-bottom: 8px;
    }
    .popup p {
      font-size: 0.75rem;
      color: <%= state.theme === 'dark' ? '#d1d5db' : '#555555' %>;
      margin-bottom: 8px;
      line-height: 1.4;
    }
    .popup-close {
      position: absolute;
      top: 8px;
      right: 8px;
      background: none;
      border: none;
      font-size: 0.85rem;
      color: <%= state.theme === 'dark' ? '#f8f9fa' : '#555555' %>;
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
      background: rgba(0, 0, 0, 0.4);
      z-index: 999;
    }
    .overlay.show {
      display: block;
    }
    @media (max-width: 768px) {
      body {
        padding: 30px 16px;
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
<body class="<%= state.theme === 'dark' ? 'dark-mode saved-mode' : 'saved-mode' %>">
  <div class="login-container">
    <h2 id="login-header">
      <% (state.headerText || 'my form').split('').forEach((char, index) => { %>
        <% if (char === ' ') { %>
          <span class="space">&nbsp;</span>
        <% } else { %>
          <span style="color: <%= state.headerColors && state.headerColors[index] ? state.headerColors[index] : '' %>;"><%= char %></span>
        <% } %>
      <% }); %>
    </h2>
    <p id="login-subheader" style="color: <%= state.subheaderColor || (state.theme === 'dark' ? '#ffffff' : '#555555') %>;">
      <%= state.subheaderText || 'fill the form' %>
    </p>
    <div id="input-fields">
      <% state.placeholders.forEach(field => { %>
        <input type="<%= templates[state.template].fields.find(f => f.id === field.id)?.type || 'text' %>"
               id="login-<%= field.id %>"
               placeholder="<%= field.placeholder %>"
               style="box-shadow: <%= state.borderShadow || (state.theme === 'dark' ? '0 0 0 2px #ffffff' : '0 0 0 2px #000000') %>;">
      <% }); %>
    </div>
    <button id="login-button" style="background: <%= state.buttonColor || 'linear-gradient(45deg, #00b7ff, #0078ff)' %>; color: <%= state.buttonTextColor || (state.buttonColor === '#FFFFFF' ? '#000000' : '#ffffff') %>;">
      <%= state.buttonText || templates[state.template].buttonText %>
    </button>
  </div>
  <div class="overlay" id="message-overlay"></div>
  <div class="popup" id="message-popup">
    <button class="popup-close" id="message-popup-close">&times;</button>
    <h4>Message</h4>
    <p id="message-text"></p>
  </div>
  <script>
    const templates = <%- JSON.stringify(templates) %>;
    const state = <%- JSON.stringify(state) %>;
    const loginButton = document.getElementById('login-button');
    const inputFieldsContainer = document.getElementById('input-fields');
    const messagePopup = document.getElementById('message-popup');
    const messageOverlay = document.getElementById('message-overlay');
    const messagePopupClose = document.getElementById('message-popup-close');
    const messageText = document.getElementById('message-text');

    console.log('State:', state); // Debug state

    function normalizeUrl(url) {
      if (!url) return null;
      if (url.match(/^https?:\/\//)) return url;
      if (url.match(/\.[a-z]{2,}$/i)) return "https://" + url;
      return null;
    }

    function showMessagePopup(message) {
      console.log('Showing popup with message:', message); // Debug popup
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
      const templateFields = templates[state.template].fields;

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
      console.log('Button clicked, action:', state.buttonAction, 'URL:', state.buttonUrl, 'Message:', state.buttonMessage); // Debug button
      if (!checkFormFilled()) {
        return;
      }
      if (state.buttonAction === 'url') {
        const normalizedUrl = normalizeUrl(state.buttonUrl);
        if (normalizedUrl) {
          console.log('Redirecting to:', normalizedUrl); // Debug redirect
          window.location.href = normalizedUrl;
        } else {
          showMessagePopup('Please enter a valid URL (e.g., www.example.com).');
        }
      } else if (state.buttonAction === 'message') {
        showMessagePopup(state.buttonMessage);
      }
    });

    messagePopupClose.addEventListener('click', hideMessagePopup);
    messageOverlay.addEventListener('click', hideMessagePopup);
  </script>
</body>
</html>
`;

app.post('/create', (req, res) => {
  const state = req.body;
  console.log('Received state:', state); // Debug incoming state
  const id = idCounter++;
  forms[id] = state;
  res.json({ url: `https://${process.env.RENDER_EXTERNAL_HOSTNAME || `localhost:${port}`}/form/${id}` });
});

app.get('/form/:id', async (req, res) => {
  const state = forms[req.params.id];
  if (!state) {
    return res.status(404).send('Form not found');
  }
  try {
    const html = await ejs.render(formTemplate, { state, templates });
    res.send(html);
  } catch (error) {
    console.error('Error rendering form:', error);
    res.status(500).send('Error rendering form');
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
