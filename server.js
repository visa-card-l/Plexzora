const express = require('express');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// In-memory storage for form configurations (replace with a database in production)
const formConfigs = {};

// Utility to normalize URLs
function normalizeUrl(url) {
  if (!url) return '';
  if (url.match(/^https?:\/\//)) return url;
  if (url.match(/\.[a-z]{2,}$/i)) return `https://${url}`;
  return url;
}

// Route to save form configuration and generate shareable link
app.post('/create', (req, res) => {
  try {
    const formId = uuidv4();
    const config = {
      template: req.body.template || 'sign-in',
      headerText: req.body.headerText || 'my form',
      headerColors: req.body.headerColors || [],
      subheaderText: req.body.subheaderText || 'fill the form',
      subheaderColor: req.body.subheaderColor || '#555555',
      placeholders: req.body.placeholders || [],
      borderShadow: req.body.borderShadow || '0 0 0 2px #000000',
      buttonColor: req.body.buttonColor || 'linear-gradient(45deg, #00b7ff, #0078ff)',
      buttonTextColor: req.body.buttonTextColor || '#ffffff',
      buttonText: req.body.buttonText || 'Sign In',
      buttonAction: req.body.buttonAction || 'url',
      buttonUrl: normalizeUrl(req.body.buttonUrl),
      buttonMessage: req.body.buttonMessage || '',
      theme: req.body.theme || 'light'
    };
    formConfigs[formId] = config;
    const url = `http://localhost:${port}/form/${formId}`;
    res.json({ url });
  } catch (error) {
    console.error('Error saving form configuration:', error);
    res.status(500).json({ error: 'Failed to generate shareable link' });
  }
});

// Route to serve the live form
app.get('/form/:id', (req, res) => {
  const formId = req.params.id;
  const config = formConfigs[formId];
  if (!config) {
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
        placeholder: p.placeholder || `Field`,
        type: 'text',
        validation: { required: false }
      });
    }
  });

  // Render the EJS template directly
  res.set('Content-Type', 'text/html');
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${template.name}</title>
      <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
      <style>
        body {
          font-family: 'Roboto', sans-serif;
          background: #f8f9fa;
          display: flex;
          flex-direction: column;
          gap: 20px;
          align-items: center;
          min-height: 100vh;
          margin: 0;
          padding: 40px 20px 20px;
          box-sizing: border-box;
          transition: all 0.3s ease;
          position: relative;
        }
        body.dark-mode { background: #000000; }
        body.saved-mode {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          background: #f8f9fa;
          padding: 40px 20px 20px;
        }
        body.dark-mode.saved-mode { background: #000000; }
        .login-container {
          background: white;
          padding: 20px;
          border-radius: 16px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
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
        body.dark-mode .login-container {
          background: #2f3b5a;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }
        .login-container:hover {
          transform: scale(1.02);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
        }
        body.dark-mode .login-container:hover {
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
        }
        .login-container h2 {
          font-size: 1.8rem;
          font-weight: 700;
          color: #000000;
        }
        body.dark-mode .login-container h2 { color: #ffffff; }
        .login-container p {
          font-family: 'Roboto', sans-serif;
          font-size: 0.9rem;
          color: #555555;
          font-weight: 400;
        }
        body.dark-mode .login-container p { color: #ffffff; }
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
          box-shadow: 0 0 0 2px #000000;
          background: #f8f9fa;
        }
        body.dark-mode .login-container input {
          box-shadow: 0 0 0 2px #ffffff;
          background: #3b4a6b;
          color: #f8f9fa;
        }
        body.dark-mode .login-container input::placeholder { color: #ffffff; opacity: 1; }
        .login-container input:focus {
          outline: none;
          box-shadow: 0 0 0 3px rgba(0, 183, 255, 0.2);
          background: #ffffff;
        }
        body.dark-mode .login-container input:focus {
          background: #3b4a6b;
          box-shadow: 0 0 0 3px rgba(0, 183, 255, 0.2);
        }
        .login-container button {
          background: linear-gradient(45deg, #00b7ff, #0078ff);
          color: white;
          border: none;
          cursor: pointer;
          font-weight: 500;
          box-shadow: 0 2px 8px rgba(0, 183, 255, 0.3);
          padding: 16px;
        }
        .login-container button:hover {
          background: linear-gradient(45deg, #0078ff, #005eff);
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
          color: #555555;
          cursor: pointer;
          transition: color 0.2s ease;
          z-index: 1000;
        }
        body.dark-mode .close-button { color: #f8f9fa; }
        .close-button:hover { color: #ff4757; }
        .popup {
          display: none;
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: #ffffff;
          padding: 16px;
          border-radius: 12px;
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
          z-index: 1000;
          text-align: center;
          max-width: 240px;
        }
        body.dark-mode .popup {
          background: #2f3b5a;
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
        }
        .popup.show { display: block; }
        .popup h4 {
          font-size: 0.85rem;
          font-weight: 600;
          color: #333333;
          margin-bottom: 8px;
        }
        body.dark-mode .popup h4 { color: #f8f9fa; }
        .popup p {
          font-size: 0.75rem;
          color: #555555;
          margin-bottom: 8px;
          line-height: 1.4;
        }
        body.dark-mode .popup p { color: #d1d5db; }
        .popup-close {
          position: absolute;
          top: 8px;
          right: 8px;
          background: none;
          border: none;
          font-size: 0.85rem;
          color: #555555;
          cursor: pointer;
          transition: color 0.2s ease;
        }
        body.dark-mode .popup-close { color: #f8f9fa; }
        .popup-close:hover { color: #00b7ff; }
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
        .overlay.show { display: block; }
        @media (max-width: 768px) {
          body {
            flex-direction: column;
            align-items: center;
            gap: 16px;
            padding: 30px 16px 16px;
          }
          body.saved-mode { padding: 30px 16px 16px; }
          .login-container {
            width: 100%;
            max-width: 300px;
            height: auto;
            min-height: 300px;
            padding: 16px;
          }
          .login-container h2 { font-size: 1.6rem; }
          .login-container input, .login-container button {
            padding: 12px;
            font-size: 0.9rem;
          }
          .login-container button { padding: 14px; }
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
          .login-container h2 { font-size: 1.4rem; }
          .login-container p { font-size: 0.8rem; }
          .login-container input, .login-container button {
            font-size: 0.85rem;
            padding: 10px;
          }
          .login-container button { padding: 12px; }
          .login-container { max-width: 280px; }
        }
      </style>
    </head>
    <body class="saved-mode ${config.theme === 'dark' ? 'dark-mode' : ''}">
      <div class="login-container">
        <h2 id="login-header">${
          config.headerText.split('').map((char, i) => {
            if (char === ' ') return '<span class="space"> </span>';
            const color = config.headerColors[i - config.headerText.slice(0, i).split(' ').length + 1] || '';
            return `<span style="color: ${color};">${char}</span>`;
          }).join('')
        }</h2>
        <p id="login-subheader" style="color: ${config.subheaderColor};">${config.subheaderText}</p>
        <div id="input-fields">
          ${fields.map(field => `
            <input 
              type="${field.type}" 
              id="login-${field.id}" 
              placeholder="${field.placeholder}" 
              style="box-shadow: ${config.borderShadow};"
            >
          `).join('')}
        </div>
        <button 
          id="login-button" 
          style="background: ${config.buttonColor}; color: ${config.buttonTextColor};"
        >${config.buttonText}</button>
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
          ${Object.keys(templates).map(key => `
            '${key}': {
              name: '${templates[key].name}',
              fields: [
                ${templates[key].fields.map(field => `
                  {
                    id: '${field.id}',
                    placeholder: '${field.placeholder}',
                    type: '${field.type}',
                    validation: {
                      required: ${field.validation.required},
                      ${field.validation.regex ? `regex: /${field.validation.regex}/, errorMessage: '${field.validation.errorMessage}'` : ''}
                    }
                  }
                `).join(',')}
              ],
              buttonText: '${templates[key].buttonText}',
              buttonAction: '${templates[key].buttonAction}',
              buttonUrl: '${templates[key].buttonUrl}',
              buttonMessage: '${templates[key].buttonMessage}'
            }
          `).join(',')}
        };

        const loginButton = document.getElementById('login-button');
        const messagePopup = document.getElementById('message-popup');
        const messageOverlay = document.getElementById('message-overlay');
        const messagePopupClose = document.getElementById('message-popup-close');
        const messageText = document.getElementById('message-text');
        const inputFieldsContainer = document.getElementById('input-fields');
        const closeButton = document.getElementById('close-button');

        function normalizeUrl(url) {
          if (!url) return null;
          if (url.match(/^https?:\/\//)) return url;
          if (url.match(/\.[a-z]{2,}$/i)) return \`https://\${url}\`;
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
          const templateFields = templates['${config.template}'].fields;

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
          const action = '${config.buttonAction}';
          if (action === 'url') {
            const normalizedUrl = normalizeUrl('${config.buttonUrl}');
            if (normalizedUrl) {
              window.location.href = normalizedUrl;
            } else {
              showMessagePopup('Invalid URL provided.');
            }
          } else if (action === 'message') {
            showMessagePopup('${config.buttonMessage}');
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
  `);
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
