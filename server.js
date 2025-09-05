const express = require('express');
const bodyParser = require('body-parser');
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

// Utility to sanitize strings for JavaScript interpolation
function sanitizeForJs(str) {
  if (!str) return '';
  return str.replace(/['"`]/g, '\\$&').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
}

// Route to save form configuration and generate shareable link
app.post('/create', (req, res) => {
  try {
    const formId = generateShortCode();
    const validActions = ['url', 'message'];
    const config = {
      template: req.body.template || 'sign-in',
      headerText: req.body.headerText || 'my form',
      headerColors: Array.isArray(req.body.headerColors) ? req.body.headerColors : [],
      subheaderText: req.body.subheaderText || 'fill the form',
      subheaderColor: req.body.subheaderColor || '#555555',
      placeholders: Array.isArray(req.body.placeholders) ? req.body.placeholders : [],
      borderShadow: req.body.borderShadow || '0 0 0 2px #000000',
      buttonColor: req.body.buttonColor || 'linear-gradient(45deg, #00b7ff, #0078ff)',
      buttonTextColor: req.body.buttonTextColor || '#ffffff',
      buttonText: req.body.buttonText || 'Sign In',
      buttonAction: validActions.includes(req.body.buttonAction) ? req.body.buttonAction : 'url',
      buttonUrl: normalizeUrl(req.body.buttonUrl) || '',
      buttonMessage: req.body.buttonMessage || '',
      theme: req.body.theme === 'dark' ? 'dark' : 'light'
    };
    formConfigs[formId] = config;

    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const host = process.env.HOST || req.headers.host || `localhost:${port}`;
    const url = `${protocol}://${host}/form/${formId}`;
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

  // Calculate min-height for login-container based on fields
  const inputCount = fields.length;
  const baseHeight = 300;
  const additionalHeight = (inputCount - template.fields.length) * 40;
  const minHeight = `${baseHeight + additionalHeight}px`;

  // Render the form with embedded CSS and JavaScript
  res.set('Content-Type', 'text/html');
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${template.name}</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
      <style>
        body {
          font-family: 'Inter', sans-serif;
          background: ${config.theme === 'dark' ? '#1a1f2e' : '#f8f9fa'};
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
          background: ${config.theme === 'dark' ? '#2f3b5a' : 'white'};
          padding: 20px;
          border-radius: 16px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, ${config.theme === 'dark' ? '0.3' : '0.1'});
          width: 320px;
          min-height: ${minHeight};
          height: auto;
          text-align: center;
          transition: transform 0.3s ease, box-shadow 0.3s ease;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
        }
        .login-container:hover {
          transform: scale(1.02);
          box-shadow: 0 8px 24px rgba(0, 0, 0, ${config.theme === 'dark' ? '0.4' : '0.15'});
        }
        .login-container h2 {
          font-size: 1.8rem;
          font-weight: 700;
          color: ${config.theme === 'dark' ? '#ffffff' : '#000000'};
          margin: 0 0 10px;
        }
        .login-container h2 span {
          color: inherit;
        }
        .login-container p {
          font-size: 0.9rem;
          color: ${config.theme === 'dark' ? '#d1d5db' : '#555555'};
          font-weight: 400;
          margin: 0 0 10px;
        }
        .login-container input, .login-container button {
          width: 100%;
          padding: 14px;
          margin: 10px 0;
          border-radius: 8px;
          font-size: 0.95rem;
          box-sizing: border-box;
          transition: all 0.2s ease;
        }
        .login-container input {
          border: none;
          box-shadow: ${config.borderShadow};
          background: ${config.theme === 'dark' ? '#3b4a6b' : '#f8f9fa'};
          color: ${config.theme === 'dark' ? '#f8f9fa' : '#333333'};
        }
        .login-container input::placeholder {
          color: ${config.theme === 'dark' ? '#b0b8cc' : '#999999'};
          opacity: 1;
        }
        .login-container input:focus {
          outline: none;
          box-shadow: 0 0 0 3px rgba(0, 183, 255, 0.3);
          background: ${config.theme === 'dark' ? '#3b4a6b' : '#ffffff'};
        }
        .login-container input:not(:placeholder-shown) {
          background: ${config.theme === 'dark' ? '#3b4a6b' : '#ffffff'};
        }
        .login-container button {
          background: ${config.buttonColor};
          color: ${config.buttonTextColor};
          border: none;
          cursor: pointer;
          font-weight: 500;
          box-shadow: 0 2px 8px rgba(0, 183, 255, 0.3);
          padding: 16px;
        }
        .login-container button:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 183, 255, 0.5);
          background: ${config.buttonColor.includes('linear-gradient') ? 'linear-gradient(45deg, #0078ff, #005bb5)' : config.buttonColor};
        }
        .close-button {
          position: absolute;
          top: 12px;
          right: 12px;
          width: 40px;
          height: 40px;
          background: ${config.theme === 'dark' ? '#2f3b5a' : '#ffffff'};
          border: none;
          border-radius: 50%;
          font-size: 1.4rem;
          font-weight: bold;
          color: ${config.theme === 'dark' ? '#f8f9fa' : '#555555'};
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
        }
        .close-button:hover {
          color: #DB4437;
          transform: scale(1.1);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }
        .popup {
          display: none;
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) scale(0.8);
          background: ${config.theme === 'dark' ? '#2f3b5a' : '#ffffff'};
          padding: 20px;
          border-radius: 12px;
          box-shadow: 0 6px 20px rgba(0, 0, 0, ${config.theme === 'dark' ? '0.4' : '0.15'});
          z-index: 1000;
          text-align: center;
          max-width: 300px;
          width: 90%;
          transition: transform 0.3s ease, opacity 0.3s ease;
          border: 1px solid rgba(0, 183, 255, 0.1);
        }
        .popup.show {
          display: block;
          transform: translate(-50%, -50%) scale(1);
          opacity: 1;
        }
        .popup h4 {
          font-size: 1rem;
          font-weight: 600;
          color: ${config.theme === 'dark' ? '#f8f9fa' : '#333333'};
          margin-bottom: 12px;
        }
        .popup p {
          font-size: 0.85rem;
          color: ${config.theme === 'dark' ? '#d1d5db' : '#555555'};
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
          color: ${config.theme === 'dark' ? '#f8f9fa' : '#555555'};
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
            padding: 16px;
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
          }
          .close-button {
            top: 12px;
            right: 12px;
            width: 36px;
            height: 36px;
            font-size: 1.2rem;
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
          }
          .popup {
            max-width: 260px;
          }
        }
      </style>
    </head>
    <body>
      <div class="login-container">
        <h2 id="login-header">${
          config.headerText.split('').map((char, i) => {
            if (char === ' ') return '<span class="space"> </span>';
            const color = config.headerColors[i - config.headerText.slice(0, i).split(' ').length + 1] || '';
            return `<span style="color: ${color}">${char}</span>`;
          }).join('')
        }</h2>
        <p id="login-subheader" style="color: ${config.subheaderColor}">${config.subheaderText}</p>
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
      <div class="popup" id="message-popup" role="alertdialog" aria-labelledby="message-popup-title">
        <button class="popup-close" id="message-popup-close" aria-label="Close message popup">&times;</button>
        <h4 id="message-popup-title">Message</h4>
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
          url = url.trim();
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

        try {
          loginButton.addEventListener('click', () => {
            if (!checkFormFilled()) {
              return;
            }
            const action = '${sanitizeForJs(config.buttonAction)}';
            if (action === 'url') {
              const normalizedUrl = normalizeUrl('${sanitizeForJs(config.buttonUrl)}');
              if (normalizedUrl) {
                window.location.href = normalizedUrl;
              } else {
                showMessagePopup('Please enter a valid URL (e.g., www.example.com).');
              }
            } else if (action === 'message') {
              showMessagePopup('${sanitizeForJs(config.buttonMessage)}');
            }
          });

          messagePopupClose.addEventListener('click', hideMessagePopup);
          messageOverlay.addEventListener('click', hideMessagePopup);

          closeButton.addEventListener('click', () => {
            window.location.href = '/';
          });
        } catch (error) {
          console.error('Error in form script:', error);
        }
      </script>
    </body>
    </html>
  `);
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
