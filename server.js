const express = require('express');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(bodyParser.json());

const forms = new Map();

app.post('/create', (req, res) => {
  const state = req.body;
  const id = uuidv4();
  forms.set(id, state);
  const protocol = req.protocol;
  const host = req.get('host');
  const url = `${protocol}://${host}/form/${id}`;
  res.json({ url });
});

app.get('/form/:id', (req, res) => {
  const id = req.params.id;
  const state = forms.get(id);
  if (!state) {
    return res.status(404).send('Form not found');
  }

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${state.headerText || 'Custom Form'}</title>
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

    body.dark-mode {
      background: #1f2a44;
    }

    body.saved-mode {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      background: #f8f9fa;
      padding: 40px 20px 20px;
    }

    body.dark-mode.saved-mode {
      background: #1f2a44;
    }

    .form-title {
      font-size: 1.8rem;
      font-weight: 700;
      color: #000000;
      text-align: center;
      margin: 0 0 20px;
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      background: linear-gradient(45deg, #00b7ff, #0078ff);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    body.dark-mode .form-title {
      color: #f8f9fa;
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    }

    body.saved-mode .form-title {
      display: none;
    }

    .template-instruction {
      font-size: 1rem;
      font-weight: 500;
      color: #333333;
      text-align: center;
      margin: 0 0 10px;
      padding: 8px 16px;
      background: linear-gradient(45deg, #00b7ff, #0078ff);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      max-width: 400px;
      line-height: 1.4;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
      border-radius: 8px;
    }

    body.dark-mode .template-instruction {
      color: #f8f9fa;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
    }

    body.saved-mode .template-instruction {
      display: none;
    }

    .template-selector-container {
      width: 100%;
      max-width: 260px;
      margin-bottom: 20px;
    }

    body.saved-mode .template-selector-container {
      display: none;
    }

    .theme-toggle {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 8px;
      width: calc(100% - 8px);
      flex-shrink: 0;
      user-select: none;
      cursor: pointer;
    }

    .theme-toggle label {
      font-size: 0.8rem;
      font-weight: 500;
      color: #555555;
      cursor: pointer;
    }

    body.dark-mode .theme-toggle label {
      color: #d1d5db;
    }

    .theme-toggle input[type="checkbox"] {
      display: none;
    }

    .theme-toggle .switch {
      position: relative;
      width: 40px;
      height: 20px;
      background: #ddd;
      border-radius: 20px;
      transition: background 0.3s ease;
      pointer-events: auto;
      z-index: 1;
      cursor: pointer;
    }

    .theme-toggle .switch::before {
      content: '';
      position: absolute;
      width: 16px;
      height: 16px;
      background: #ffffff;
      border-radius: 50%;
      top: 2px;
      left: 2px;
      transition: transform 0.3s ease;
    }

    .theme-toggle input:checked + .switch {
      background: #00b7ff;
    }

    .theme-toggle input:checked + .switch::before {
      transform: translateX(20px);
    }

    #template-selector {
      width: 100%;
      padding: 12px;
      border-radius: 8px;
      font-size: 0.9rem;
      background: #ffffff;
      border: none;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
      cursor: pointer;
    }

    body.dark-mode #template-selector {
      background: #2f3b5a;
      color: #f8f9fa;
      box-shadow: 0 0 0 2px #6b7280;
    }

    .content-container {
      display: flex;
      flex-direction: row;
      gap: 24px;
      justify-content: center;
      align-items: flex-start;
      width: 100%;
      max-width: 660px;
    }

    body.saved-mode .content-container {
      display: none;
    }

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

    body.saved-mode .login-container {
      margin: 0 auto;
      position: relative;
      top: 0;
      transform: translateY(0);
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
      display: block;
      visibility: visible;
      opacity: 1;
      color: #000000;
    }

    body.dark-mode .login-container h2 {
      color: #ffffff;
    }

    .login-container h2 span {
      color: inherit;
    }

    .login-container p {
      font-family: 'Roboto', sans-serif;
      font-size: 0.9rem;
      color: #555555;
      font-weight: 400;
      display: block;
      visibility: visible;
      opacity: 1;
    }

    body.dark-mode .login-container p {
      color: #ffffff;
    }

    .login-container span {
      cursor: pointer;
      position: relative;
      display: inline-block;
      margin: 0;
      letter-spacing: 0.5px;
    }

    .login-container span.space {
      cursor: default;
      margin-right: 4px;
      letter-spacing: 0;
      width: 4px;
      display: inline-block;
    }

    .login-container span.selected {
      box-shadow: 0 0 0 2px #00b7ff;
      border-radius: 50%;
      padding: 1px;
      box-sizing: border-box;
    }

    body.saved-mode .login-container span {
      cursor: default;
      pointer-events: none;
    }

    body.saved-mode .login-container h2,
    body.saved-mode .login-container p {
      cursor: default;
      pointer-events: none;
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
      box-shadow: 0 0 0 2px #000000;
      background: #f8f9fa;
    }

    body.dark-mode .login-container input {
      box-shadow: 0 0 0 2px #ffffff;
      background: #3b4a6b;
      color: #f8f9fa;
    }

    body.dark-mode .login-container input::placeholder {
      color: #ffffff;
      opacity: 1;
    }

    .login-container input:focus {
      outline: none;
      box-shadow: 0 0 0 3px rgba(0, 183, 255, 0.2);
      background: #ffffff;
    }

    body.dark-mode .login-container input:focus {
      background: #3b4a6b;
      box-shadow: 0 0 0 3px rgba(0, 183, 255, 0.2);
    }

    .login-container input:not(:placeholder-shown) {
      background: #ffffff;
    }

    body.dark-mode .login-container input:not(:placeholder-shown) {
      background: #3b4a6b;
    }

    .login-container button {
      background: linear-gradient(45deg, #00b7ff, #0078ff);
      color: white;
      border: none;
      cursor: pointer;
      font-weight: 500;
      box-shadow: 0 2px 8px rgba(0, 183, 255, 0.3);
      padding: 16px;
      touch-action: manipulation;
    }

    .login-container button:hover {
      background: linear-gradient(45deg, #0078ff, #005eff);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 183, 255, 0.5);
    }

    .customizer {
      background: #ffffff;
      padding: 20px 20px 20px 12px;
      border-radius: 16px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      width: 260px;
      max-height: 260px;
      overflow-y: auto;
      transition: transform 0.2s ease, box-shadow 0.3s ease;
      text-align: left;
    }

    body.dark-mode .customizer {
      background: #2f3b5a;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      scrollbar-color: #6b7280 #2f3b5a;
    }

    .customizer.hidden {
      display: none;
    }

    .customizer:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
    }

    body.dark-mode .customizer:hover {
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    }

    .customizer h3 {
      font-size: 1rem;
      font-weight: 700;
      color: #333333;
      margin-bottom: 12px;
      text-shadow: none;
    }

    body.dark-mode .customizer h3 {
      color: #f8f9fa;
    }

    .customizer-section {
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid #eee;
      margin-right: 8px;
    }

    body.dark-mode .customizer-section {
      border-bottom-color: #555;
    }

    .customizer-section:last-child {
      margin-bottom: 0;
      border-bottom: none;
      padding-bottom: 0;
    }

    .customizer h4 {
      color: #333333;
    }

    body.dark-mode .customizer h4 {
      color: #f8f9fa;
    }

    .customizer label {
      display: block;
      margin-top: 6px;
      font-size: 0.8rem;
      font-weight: 500;
      color: #555555;
      text-shadow: none;
    }

    body.dark-mode .customizer label {
      color: #d1d5db;
    }

    .customizer input, .customizer select {
      margin-top: 4px;
      width: calc(100% - 8px);
      padding: 8px;
      border-radius: 8px;
      border: none;
      box-shadow: 0 0 0 2px #ddd;
      font-size: 0.85rem;
      background: #f8f9fa;
      color: #333333;
      transition: all 0.2s ease;
      touch-action: manipulation;
    }

    body.dark-mode .customizer input, body.dark-mode .customizer select {
      background: #3b4a6b;
      box-shadow: 0 0 0 2px #6b7280;
      color: #f8f9fa;
    }

    .customizer input::placeholder, .customizer select::placeholder {
      color: #999999;
      opacity: 1;
    }

    body.dark-mode .customizer input::placeholder, body.dark-mode .customizer select::placeholder {
      color: #b0b8cc;
      opacity: 1;
    }

    .customizer input:focus, .customizer select:focus {
      outline: none;
      box-shadow: 0 0 0 3px rgba(0, 183, 255, 0.2);
      background: #ffffff;
    }

    body.dark-mode .customizer input:focus, body.dark-mode .customizer select:focus {
      background: #3b4a6b;
      box-shadow: 0 0 0 3px rgba(0, 183, 255, 0.2);
    }

    .customizer input[type="radio"] {
      width: auto;
      margin-right: 8px;
      transform: scale(1.1);
      box-shadow: none;
    }

    .radio-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 8px;
    }

    .color-boxes {
      display: flex;
      gap: 8px;
      margin-top: 8px;
      width: calc(100% - 8px);
      flex-wrap: wrap;
    }

    .color-box {
      width: 28px;
      height: 28px;
      border-radius: 6px;
      cursor: pointer;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
      touch-action: manipulation;
    }

    .color-box[data-color="#FFFFFF"] {
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2), inset 0 0 0 1px #ccc;
    }

    body.dark-mode .color-box[data-color="#FFFFFF"] {
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3), inset 0 0 0 1px #555;
    }

    .color-box:hover {
      transform: scale(1.1);
      box-shadow: 0 0 10px rgba(0, 183, 255, 0.3), 0 4px 12px rgba(0, 0, 0, 0.2);
    }

    body.dark-mode .color-box:hover {
      box-shadow: 0 0 10px rgba(0, 183, 255, 0.4), 0 4px 12px rgba(0, 0, 0, 0.4);
    }

    .instructions {
      font-size: 0.75rem;
      color: #777777;
      margin-top: 6px;
      line-height: 1.3;
      text-shadow: none;
    }

    body.dark-mode .instructions {
      color: #b0b8cc;
    }

    .color-button, .add-field-button, .remove-field-button {
      width: calc(100% - 8px);
      padding: 10px;
      margin-top: 8px;
      border-radius: 8px;
      font-size: 0.85rem;
      cursor: pointer;
      border: none;
      font-weight: 500;
      transition: all 0.2s ease;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
      touch-action: manipulation;
    }

    .color-button, .add-field-button {
      background: linear-gradient(45deg, #00b7ff, #0078ff);
      color: white;
    }

    .color-button:hover, .add-field-button:hover {
      background: linear-gradient(45deg, #0078ff, #005eff);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 183, 255, 0.4);
    }

    .remove-field-button {
      background: linear-gradient(45deg, #ff6b6b, #ff4757);
      color: white;
    }

    .remove-field-button:hover {
      background: linear-gradient(45deg, #ff4757, #ff2b4a);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(255, 71, 87, 0.4);
    }

    .field-container {
      margin-bottom: 12px;
    }

    .button-container {
      display: flex;
      justify-content: center;
      margin-top: 12px;
      width: 260px;
      margin-left: auto;
      margin-right: auto;
    }

    body.saved-mode .button-container {
      display: none;
    }

    .save-button {
      width: 100%;
      padding: 12px;
      background: linear-gradient(45deg, #00b7ff, #0078ff);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 0.9rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
      touch-action: manipulation;
    }

    .save-button:hover {
      background: linear-gradient(45deg, #0078ff, #005eff);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 183, 255, 0.4);
    }

    .close-button {
      display: none;
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
      touch-action: manipulation;
    }

    body.dark-mode .close-button {
      color: #f8f9fa;
    }

    body.saved-mode .close-button {
      display: none; /* Hide close button for live form */
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

    .popup.show {
      display: block;
    }

    .popup h4 {
      font-size: 0.85rem;
      font-weight: 600;
      color: #333333;
      margin-bottom: 8px;
    }

    body.dark-mode .popup h4 {
      color: #f8f9fa;
    }

    .popup .color-boxes {
      justify-content: center;
    }

    .popup p {
      font-size: 0.75rem;
      color: #555555;
      margin-bottom: 8px;
      line-height: 1.4;
    }

    body.dark-mode .popup p {
      color: #d1d5db;
    }

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
      touch-action: manipulation;
    }

    body.dark-mode .popup-close {
      color: #f8f9fa;
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
        flex-direction: column;
        align-items: center;
        gap: 16px;
        padding: 30px 16px 16px;
      }

      body.saved-mode {
        padding: 30px 16px 16px;
      }

      .form-title {
        font-size: 1.4rem;
        margin-bottom: 16px;
      }

      .template-instruction {
        font-size: 0.9rem;
        padding: 6px 12px;
        max-width: 300px;
      }

      .template-selector-container {
        max-width: 300px;
      }

      .content-container {
        flex-direction: column;
        align-items: center;
        gap: 16px;
      }

      .login-container, .customizer, .button-container {
        width: 100%;
        max-width: 300px;
      }

      .login-container {
        height: auto;
        min-height: 300px;
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

      .customizer {
        max-height: 260px;
        padding: 16px 16px 16px 12px;
      }

      .button-container {
        width: 100%;
        max-width: 300px;
        margin-top: 12px;
      }

      .save-button {
        padding: 12px;
        font-size: 0.9rem;
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
      .form-title {
        font-size: 1.2rem;
        margin-bottom: 12px;
      }

      .template-instruction {
        font-size: 0.85rem;
        padding: 6px 10px;
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

      .customizer h3 {
        font-size: 0.9rem;
      }

      .customizer label {
        font-size: 0.75rem;
      }

      .customizer input, .customizer select {
        font-size: 0.8rem;
        padding: 8px;
      }

      .color-button, .add-field-button, .remove-field-button {
        font-size: 0.8rem;
        padding: 8px;
      }

      .save-button {
        font-size: 0.85rem;
        padding: 10px;
      }

      .login-container, .customizer, .button-container {
        max-width: 280px;
      }

      .theme-toggle {
        gap: 6px;
      }

      .theme-toggle label {
        font-size: 0.75rem;
      }

      .theme-toggle .switch {
        width: 36px;
        height: 18px;
      }

      .theme-toggle .switch::before {
        width: 14px;
        height: 14px;
        top: 2px;
        left: 2px;
      }

      .theme-toggle input:checked + .switch::before {
        transform: translateX(18px);
      }
    }
  </style>
</head>
<body class="saved-mode${state.theme === 'dark' ? ' dark-mode' : ''}">
  <div class="login-container">
    <h2 id="login-header"></h2>
    <p id="login-subheader"></p>
    <div id="input-fields"></div>
    <button id="login-button"></button>
  </div>
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

    const state = ${JSON.stringify(state)};

    const loginHeader = document.getElementById('login-header');
    const loginSubheader = document.getElementById('login-subheader');
    const inputFieldsContainer = document.getElementById('input-fields');
    const loginButton = document.getElementById('login-button');
    const messageOverlay = document.getElementById('message-overlay');
    const messagePopup = document.getElementById('message-popup');
    const messagePopupClose = document.getElementById('message-popup-close');
    const messageText = document.getElementById('message-text');

    function updateHeaderText(text, colors) {
      loginHeader.innerHTML = '';
      if (!text) {
        loginHeader.textContent = 'my form';
        return;
      }
      let colorIndex = 0;
      for (let i = 0; i < text.length; i++) {
        const span = document.createElement('span');
        if (text[i] === ' ') {
          span.classList.add('space');
          span.textContent = ' ';
        } else {
          span.textContent = text[i];
          if (colors[colorIndex]) {
            span.style.color = colors[colorIndex];
          }
          span.style.cursor = 'default';
          span.style.pointerEvents = 'none';
          colorIndex++;
        }
        loginHeader.appendChild(span);
      }
    }

    function normalizeUrl(url) {
      if (!url) return null;
      if (url.match(/^https?:\\/\\//)) return url;
      if (url.match(/\\.[a-z]{2,}$/i)) return \`https://\${url}\`;
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

    // Apply state
    updateHeaderText(state.headerText || 'my form', state.headerColors || []);
    loginSubheader.textContent = state.subheaderText || 'fill the form';
    loginSubheader.style.color = state.subheaderColor || '';

    const templateFields = templates[state.template].fields;
    let minHeight = 300;
    state.placeholders.forEach((field, index) => {
      const fieldInfo = templateFields.find(f => f.id === field.id) || { type: 'text', validation: { required: true }, placeholder: field.placeholder || \`Field \${index + 1}\` };
      const newInput = document.createElement('input');
      newInput.type = fieldInfo.type;
      newInput.id = \`login-\${field.id}\`;
      newInput.placeholder = field.placeholder || fieldInfo.placeholder;
      newInput.style.boxShadow = state.borderShadow || '';
      inputFieldsContainer.appendChild(newInput);
      if (index >= templateFields.length) {
        minHeight += 40;
      }
    });
    document.querySelector('.login-container').style.minHeight = \`\${minHeight}px\`;

    loginButton.textContent = state.buttonText || templates[state.template].buttonText;
    loginButton.style.background = state.buttonColor || 'linear-gradient(45deg, #00b7ff, #0078ff)';
    loginButton.style.color = state.buttonTextColor || '#ffffff';

    loginButton.addEventListener('click', () => {
      if (!checkFormFilled()) {
        return;
      }
      if (state.buttonAction === 'url') {
        const normalizedUrl = normalizeUrl(state.buttonUrl);
        if (normalizedUrl) {
          window.location.href = normalizedUrl;
        } else {
          showMessagePopup('Please enter a valid URL (e.g., www.example.com).');
        }
      } else {
        showMessagePopup(state.buttonMessage);
      }
    });

    messagePopupClose.addEventListener('click', hideMessagePopup);
    messageOverlay.addEventListener('click', hideMessagePopup);
  </script>
</body>
</html>
  `;

  res.send(html);
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
