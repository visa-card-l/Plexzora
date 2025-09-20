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
const ADMIN_PASSWORD_HASH = bcrypt.hashSync('midas', 10);

// Persistent storage paths
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
    console.error('Error creating data directory:', err.message);
    throw err;
  }
}

// Initialize files
async function initializeFiles() {
  try {
    await fs.access(submissionsFile);
  } catch {
    await fs.writeFile(submissionsFile, JSON.stringify([]));
    console.log('Created submissions.json');
  }
  try {
    await fs.access(formConfigsFile);
    formConfigs = JSON.parse(await fs.readFile(formConfigsFile, 'utf8'));
    console.log('Loaded formConfigs from file');
  } catch {
    await fs.writeFile(formConfigsFile, JSON.stringify({}));
    console.log('Created formConfigs.json');
  }
  try {
    await fs.access(usersFile);
  } catch {
    await fs.writeFile(usersFile, JSON.stringify([]));
    console.log('Created users.json');
  }
  try {
    await fs.access(adminSettingsFile);
  } catch {
    await fs.writeFile(adminSettingsFile, JSON.stringify({
      linkLifespan: 604800000,
      maxFormsPerUserPerDay: 10,
      restrictionsEnabled: true
    }));
    console.log('Created adminSettings.json');
  }
}

// Save form configs
async function saveFormConfigs() {
  try {
    await fs.writeFile(formConfigsFile, JSON.stringify(formConfigs, null, 2));
    console.log('Saved formConfigs to file');
  } catch (err) {
    console.error('Error saving formConfigs:', err.message);
    throw err;
  }
}

// Save users
async function saveUsers(users) {
  try {
    await fs.writeFile(usersFile, JSON.stringify(users, null, 2));
    console.log('Saved users to file');
  } catch (err) {
    console.error('Error saving users:', err.message);
    throw err;
  }
}

// Save admin settings
async function saveAdminSettings(settings) {
  try {
    await fs.writeFile(adminSettingsFile, JSON.stringify(settings, null, 2));
    console.log('Saved admin settings to file');
  } catch (err) {
    console.error('Error saving admin settings:', err.message);
    throw err;
  }
}

// Load users
async function loadUsers() {
  try {
    const data = await fs.readFile(usersFile, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error loading users:', err.message);
    return [];
  }
}

// Load admin settings
async function loadAdminSettings() {
  try {
    const data = await fs.readFile(adminSettingsFile, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error loading admin settings:', err.message);
    return { linkLifespan: 604800000, maxFormsPerUserPerDay: 10, restrictionsEnabled: true };
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

// Admin password verification middleware
function verifyAdminPassword(req, res, next) {
  const { adminPassword } = req.body;
  if (!adminPassword || !bcrypt.compareSync(adminPassword, ADMIN_PASSWORD_HASH)) {
    return res.status(401).json({ error: 'Invalid admin password' });
  }
  next();
}

// Initialize storage
let formConfigs = {};
(async () => {
  try {
    await ensureDataDir();
    await initializeFiles();
  } catch (err) {
    console.error('Initialization failed:', err.message);
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

// Utility functions
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

function normalizeUrl(url) {
  if (!url) return '';
  url = url.trim();
  if (url.match(/^https?:\/\//)) return url;
  if (url.match(/\.[a-z]{2,}$/i)) return `https://${url}`;
  return '';
}

function generateShortCode(length = 6) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  if (formConfigs[code]) return generateShortCode(length);
  return code;
}

async function isFormExpired(formId) {
  const config = formConfigs[formId];
  if (!config || !config.createdAt) return true;
  const adminSettings = await loadAdminSettings();
  if (!adminSettings.restrictionsEnabled) return false;
  if (!adminSettings.linkLifespan) return false;
  const createdTime = new Date(config.createdAt).getTime();
  const currentTime = Date.now();
  return (currentTime - createdTime) > adminSettings.linkLifespan;
}

async function countUserFormsToday(userId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStart = today.getTime();
  return Object.values(formConfigs).filter(config => {
    if (config.userId !== userId) return false;
    const createdTime = new Date(config.createdAt).getTime();
    return createdTime >= todayStart;
  }).length;
}

async function getUserCount() {
  const users = await loadUsers();
  return users.length;
}

// Auth Routes
app.post('/signup', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
    const users = await loadUsers();
    if (users.find(u => u.email === email)) return res.status(400).json({ error: 'User already exists' });
    const hashedPassword = await bcrypt.hash(password, 10);
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
    console.error('Signup error:', error.message);
    res.status(500).json({ error: 'Signup failed' });
  }
});

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
    const users = await loadUsers();
    const user = users.find(u => u.email === email);
    if (!user || !await bcrypt.compare(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '100h' });
    res.json({ message: 'Login successful', token });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/user', verifyToken, async (req, res) => {
  try {
    const user = await loadUserById(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { id, username, email, createdAt } = user;
    res.json({ user: { id, username, email, createdAt }, message: 'User info retrieved successfully' });
  } catch (error) {
    console.error('Error fetching user info:', error.message);
    res.status(500).json({ error: 'Failed to fetch user info' });
  }
});

// Admin Routes
app.get('/admin', async (req, res) => {
  try {
    const adminSettings = await loadAdminSettings();
    const userCount = await getUserCount();
    res.render('admin', {
      userCount,
      restrictionsEnabled: adminSettings.restrictionsEnabled,
      headerHtml: 'Admin Settings',
      subheaderText: 'Configure form settings',
      subheaderColor: '#555555',
      borderShadow: '0 0 0 2px #000000',
      buttonColor: 'linear-gradient(45deg, #00b7ff, #0078ff)',
      buttonTextColor: '#ffffff',
      buttonText: 'Update Settings',
      theme: 'light'
    });
  } catch (error) {
    console.error('Error rendering admin page:', error.message);
    res.status(500).send('Error rendering admin page');
  }
});

app.post('/admin/settings', verifyAdminPassword, async (req, res) => {
  try {
    const { linkLifespan, maxFormsPerUserPerDay, restrictionsEnabled } = req.body;
    if (restrictionsEnabled && (!linkLifespan || !maxFormsPerUserPerDay)) {
      return res.status(400).json({ error: 'Link lifespan and max forms are required' });
    }
    const lifespanMs = restrictionsEnabled ? Number(linkLifespan) * 24 * 60 * 60 * 1000 : null;
    const adminSettings = {
      linkLifespan: lifespanMs,
      maxFormsPerUserPerDay: restrictionsEnabled ? Number(maxFormsPerUserPerDay) : null,
      restrictionsEnabled: !!restrictionsEnabled
    };
    await saveAdminSettings(adminSettings);
    res.status(200).json({ message: 'Settings updated successfully', settings: adminSettings });
  } catch (error) {
    console.error('Error updating admin settings:', error.message);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Form Routes
app.get('/get', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const submissions = JSON.parse(await fs.readFile(submissionsFile, 'utf8')).filter(s => s.userId === userId);
    const adminSettings = await loadAdminSettings();
    const userFormConfigs = {};
    for (const [formId, config] of Object.entries(formConfigs)) {
      if (config.userId === userId && !(adminSettings.restrictionsEnabled && await isFormExpired(formId))) {
        userFormConfigs[formId] = config;
      }
    }
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
    res.json({
      submissions: submissions.reverse(),
      formConfigs: userFormConfigs,
      templates,
      userId,
      maxFormsPerUserPerDay: adminSettings.restrictionsEnabled ? adminSettings.maxFormsPerUserPerDay : null
    });
  } catch (error) {
    console.error('Error fetching data:', error.message);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

app.post('/create', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const adminSettings = await loadAdminSettings();
    if (adminSettings.restrictionsEnabled) {
      const userFormCountToday = await countUserFormsToday(userId);
      if (userFormCountToday >= adminSettings.maxFormsPerUserPerDay) {
        return res.status(403).json({ error: `Maximum form limit (${adminSettings.maxFormsPerUserPerDay} per day) reached` });
      }
    }
    const formId = generateShortCode();
    const config = {
      userId,
      template: req.body.template || 'sign-in',
      headerText: sanitizeForJs(req.body.headerText || 'My Form'),
      headerColors: Array.isArray(req.body.headerColors) ? req.body.headerColors.map(sanitizeForJs) : [],
      subheaderText: sanitizeForJs(req.body.subheaderText || 'Fill the form'),
      subheaderColor: sanitizeForJs(req.body.subheaderColor || (req.body.theme === 'dark' ? '#d1d5db' : '#555555')),
      placeholders: Array.isArray(req.body.placeholders) ? req.body.placeholders.map(p => ({
        id: sanitizeForJs(p.id),
        placeholder: sanitizeForJs(p.placeholder)
      })) : [],
      borderShadow: sanitizeForJs(req.body.borderShadow || (req.body.theme === 'dark' ? '0 0 0 2px #ffffff' : '0 0 0 2px #000000')),
      buttonColor: sanitizeForJs(req.body.buttonColor || 'linear-gradient(45deg, #00b7ff, #0078ff)'),
      buttonTextColor: sanitizeForJs(req.body.buttonTextColor || '#ffffff'),
      buttonText: sanitizeForJs(req.body.buttonText || 'Submit'),
      buttonAction: ['url', 'message'].includes(req.body.buttonAction) ? req.body.buttonAction : 'message',
      buttonUrl: normalizeUrl(req.body.buttonUrl || ''),
      buttonMessage: sanitizeForJs(req.body.buttonMessage || 'Form submitted successfully!'),
      theme: req.body.theme === 'dark' ? 'dark' : 'light',
      createdAt: new Date().toISOString(),
      expiresAt: adminSettings.restrictionsEnabled ? new Date(Date.now() + adminSettings.linkLifespan).toISOString() : null
    };
    formConfigs[formId] = config;
    await saveFormConfigs();
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const host = req.headers.host || `localhost:${port}`;
    const url = `${protocol}://${host}/form/${formId}`;
    res.status(200).json({ url, formId, expiresAt: config.expiresAt });
  } catch (error) {
    console.error('Error creating form:', error.message);
    res.status(500).json({ error: 'Failed to create form' });
  }
});

app.post('/form/:id/submit', async (req, res) => {
  const formId = req.params.id;
  console.log(`Received submission for form ${formId}:`, req.body);
  if (!formConfigs[formId]) return res.status(404).json({ error: 'Form not found' });
  const adminSettings = await loadAdminSettings();
  if (adminSettings.restrictionsEnabled && await isFormExpired(formId)) {
    return res.status(403).json({ error: 'Form has expired' });
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
    const submissions = JSON.parse(await fs.readFile(submissionsFile, 'utf8'));
    submissions.push(submission);
    await fs.writeFile(submissionsFile, JSON.stringify(submissions, null, 2));
    res.status(200).json({ message: 'Submission saved successfully' });
  } catch (error) {
    console.error('Error saving submission:', error.message);
    res.status(500).json({ error: 'Failed to save submission' });
  }
});

// Render form page
app.get('/form/:id', async (req, res) => {
  const formId = req.params.id;
  console.log(`Rendering form ${formId}`);
  const config = formConfigs[formId];

  if (!config) {
    console.error(`Form not found for ID: ${formId}`);
    return res.status(404).send('Form not found');
  }

  const adminSettings = await loadAdminSettings();
  if (adminSettings.restrictionsEnabled && await isFormExpired(formId)) {
    console.error(`Form ${formId} has expired`);
    return res.status(403).send('Form has expired');
  }

  const templates = {
    'sign-in': {
      name: 'Sign In Form',
      fields: [
        { id: 'email', placeholder: 'Email', type: 'email', validation: { required: true, regex: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$', errorMessage: 'Please enter a valid email address.' } },
        { id: 'password', placeholder: 'Password', type: 'password', validation: { required: true } }
      ],
      buttonText: 'Sign In',
      buttonAction: 'message',
      buttonUrl: '',
      buttonMessage: 'Form submitted successfully!'
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
    const customField = (config.placeholders || []).find(p => p.id === field.id);
    return {
      ...field,
      placeholder: customField ? customField.placeholder : field.placeholder
    };
  });

  (config.placeholders || []).forEach(p => {
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

  const headerHtml = (config.headerText || 'My Form').split('').map((char, i) => {
    if (char === ' ') return '<span class="space"> </span>';
    const color = (config.headerColors || [])[i - (config.headerText || '').slice(0, i).split(' ').length + 1] || '';
    return `<span style="color: ${sanitizeForJs(color)}">${sanitizeForJs(char)}</span>`;
  }).join('');

  const templateData = {
    templateName: sanitizeForJs(template.name || 'Form'),
    headerHtml,
    subheaderText: sanitizeForJs(config.subheaderText || 'Fill the form'),
    subheaderColor: sanitizeForJs(config.subheaderColor || (config.theme === 'dark' ? '#d1d5db' : '#555555')),
    fields,
    borderShadow: sanitizeForJs(config.borderShadow || (config.theme === 'dark' ? '0 0 0 2px #ffffff' : '0 0 0 2px #000000')),
    buttonColor: sanitizeForJs(config.buttonColor || 'linear-gradient(45deg, #00b7ff, #0078ff)'),
    buttonTextColor: sanitizeForJs(config.buttonTextColor || '#ffffff'),
    buttonText: sanitizeForJs(config.buttonText || template.buttonText || 'Submit'),
    buttonAction: sanitizeForJs(config.buttonAction || template.buttonAction || 'message'),
    buttonUrl: sanitizeForJs(config.buttonUrl || template.buttonUrl || ''),
    buttonMessage: sanitizeForJs(config.buttonMessage || template.buttonMessage || 'Form submitted successfully!'),
    theme: config.theme || 'light',
    minHeight,
    template: config.template || 'sign-in',
    formId: sanitizeForJs(formId),
    templates: JSON.stringify(templates, (key, value) => {
      if (key === 'regex' && value) return value.toString().slice(1, -1);
      return value;
    })
  };

  console.log('Rendering form with data:', {
    formId,
    template: config.template,
    fields: fields.map(f => ({ id: f.id, placeholder: f.placeholder })),
    templateName: templateData.templateName,
    subheaderText: templateData.subheaderText,
    buttonText: templateData.buttonText,
    buttonAction: templateData.buttonAction,
    templates: Object.keys(templates)
  });

  try {
    res.render('form', templateData);
  } catch (error) {
    console.error('Error rendering form:', error.message, error.stack);
    res.status(500).send('Error rendering form');
  }
});

// Additional Routes (simplified for brevity)
app.put('/api/form/:id', verifyToken, async (req, res) => {
  try {
    const formId = req.params.id;
    const userId = req.user.userId;
    if (!formConfigs[formId] || formConfigs[formId].userId !== userId) {
      return res.status(404).json({ error: 'Form not found or access denied' });
    }
    const adminSettings = await loadAdminSettings();
    if (adminSettings.restrictionsEnabled && await isFormExpired(formId)) {
      return res.status(403).json({ error: 'Form has expired' });
    }
    const updatedConfig = {
      userId,
      template: req.body.template || formConfigs[formId].template,
      headerText: sanitizeForJs(req.body.headerText || formConfigs[formId].headerText),
      headerColors: Array.isArray(req.body.headerColors) ? req.body.headerColors.map(sanitizeForJs) : formConfigs[formId].headerColors,
      subheaderText: sanitizeForJs(req.body.subheaderText || formConfigs[formId].subheaderText),
      subheaderColor: sanitizeForJs(req.body.subheaderColor || formConfigs[formId].subheaderColor),
      placeholders: Array.isArray(req.body.placeholders) ? req.body.placeholders.map(p => ({
        id: sanitizeForJs(p.id),
        placeholder: sanitizeForJs(p.placeholder)
      })) : formConfigs[formId].placeholders,
      borderShadow: sanitizeForJs(req.body.borderShadow || formConfigs[formId].borderShadow),
      buttonColor: sanitizeForJs(req.body.buttonColor || formConfigs[formId].buttonColor),
      buttonTextColor: sanitizeForJs(req.body.buttonTextColor || formConfigs[formId].buttonTextColor),
      buttonText: sanitizeForJs(req.body.buttonText || formConfigs[formId].buttonText),
      buttonAction: ['url', 'message'].includes(req.body.buttonAction) ? req.body.buttonAction : formConfigs[formId].buttonAction,
      buttonUrl: normalizeUrl(req.body.buttonUrl || formConfigs[formId].buttonUrl),
      buttonMessage: sanitizeForJs(req.body.buttonMessage || formConfigs[formId].buttonMessage),
      theme: req.body.theme === 'dark' ? 'dark' : 'light',
      createdAt: formConfigs[formId].createdAt,
      updatedAt: new Date().toISOString(),
      expiresAt: adminSettings.restrictionsEnabled ? new Date(new Date(formConfigs[formId].createdAt).getTime() + adminSettings.linkLifespan).toISOString() : null
    };
    formConfigs[formId] = updatedConfig;
    await saveFormConfigs();
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const host = req.headers.host || `localhost:${port}`;
    const url = `${protocol}://${host}/form/${formId}`;
    res.status(200).json({ url, formId, message: 'Form updated successfully' });
  } catch (error) {
    console.error('Error updating form:', error.message);
    res.status(500).json({ error: 'Failed to update form' });
  }
});

app.delete('/form/:id', verifyToken, async (req, res) => {
  const formId = req.params.id;
  const userId = req.user.userId;
  try {
    if (!formConfigs[formId] || formConfigs[formId].userId !== userId) {
      return res.status(404).json({ error: 'Form not found or access denied' });
    }
    delete formConfigs[formId];
    await saveFormConfigs();
    const submissions = JSON.parse(await fs.readFile(submissionsFile, 'utf8'));
    const updatedSubmissions = submissions.filter(s => !(s.userId === userId && s.formId === formId));
    await fs.writeFile(submissionsFile, JSON.stringify(updatedSubmissions, null, 2));
    res.status(200).json({ message: 'Form and submissions deleted successfully' });
  } catch (error) {
    console.error('Error deleting form:', error.message);
    res.status(500).json({ error: 'Failed to delete form' });
  }
});

app.get('/submissions', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const submissions = JSON.parse(await fs.readFile(submissionsFile, 'utf8')).filter(s => s.userId === userId);
    const templates = {
      'sign-in': { name: 'Sign In Form', fields: [...] },
      'contact': { name: 'Contact Form', fields: [...] },
      'payment-checkout': { name: 'Payment Checkout Form', fields: [...] }
    }; // Abbreviated for brevity
    res.json({ submissions: submissions.reverse(), templates, userId });
  } catch (error) {
    console.error('Error fetching submissions:', error.message);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
}).on('error', (error) => {
  console.error('Server startup error:', error.message);
  process.exit(1);
});
