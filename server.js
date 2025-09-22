const express = require('express');
const bodyParser = require('body-parser');
const ejs = require('ejs');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config(); // Load environment variables

const app = express();
const port = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here'; // Fallback for local dev
const ADMIN_PASSWORD_HASH = bcrypt.hashSync('midas', 10); // Pre-hashed admin password

// Use persistent path for Render (set DATA_DIR=/data in Render env vars)
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const submissionsFile = path.join(DATA_DIR, 'submissions.json');
const formConfigsFile = path.join(DATA_DIR, 'formConfigs.json');
const usersFile = path.join(DATA_DIR, 'users.json');
const adminSettingsFile = path.join(DATA_DIR, 'adminSettings.json');
const formCreationsFile = path.join(DATA_DIR, 'formCreations.json');

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

// Initialize form creations file
async function initializeFormCreationsFile() {
  try {
    await fs.access(formCreationsFile);
    console.log(`Form creations file exists: ${formCreationsFile}`);
  } catch {
    await fs.writeFile(formCreationsFile, JSON.stringify([]));
    console.log('Created formCreations.json');
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

// Save form creations to file
async function saveFormCreations(formCreations) {
  try {
    await fs.writeFile(formCreationsFile, JSON.stringify(formCreations, null, 2));
    console.log('Saved formCreations to file');
  } catch (err) {
    console.error('Error saving formCreations:', err.message, err.stack);
    throw err;
  }
}

// Initialize admin settings file
async function initializeAdminSettingsFile() {
  try {
    await fs.access(adminSettingsFile);
    console.log(`Admin settings file exists: ${adminSettingsFile}`);
  } catch {
    await fs.writeFile(adminSettingsFile, JSON.stringify({
      linkLifespan: 604800000, // Default: 7 days in milliseconds
      linkLifespanValue: 7, // Default: 7
      linkLifespanUnit: 'days', // Default: days
      maxFormsPerUserPerDay: 10, // Default: 10 forms per user per day
      restrictionsEnabled: true // Default: restrictions enabled
    }));
    console.log('Created adminSettings.json');
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

// Save admin settings to file
async function saveAdminSettings(settings) {
  try {
    await fs.writeFile(adminSettingsFile, JSON.stringify(settings, null, 2));
    console.log('Saved admin settings to file');
  } catch (err) {
    console.error('Error saving admin settings:', err.message, err.stack);
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

// Load admin settings from file
async function loadAdminSettings() {
  try {
    const data = await fs.readFile(adminSettingsFile, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error loading admin settings:', err.message);
    return {
      linkLifespan: 604800000,
      linkLifespanValue: 7,
      linkLifespanUnit: 'days',
      maxFormsPerUserPerDay: 10,
      restrictionsEnabled: true
    };
  }
}

// Load form creations from file
async function loadFormCreations() {
  try {
    const data = await fs.readFile(formCreationsFile, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error loading form creations:', err.message);
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
    req.user = decoded; // Store user data in request
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
    await initializeSubmissionsFile();
    await initializeFormConfigsFile();
    await initializeFormCreationsFile();
    await initializeUsersFile();
    await initializeAdminSettingsFile();
  } catch (err) {
    console.error('Initialization failed:', err.message, err.stack);
    process.exit(1);
  }
})();

// Middleware - Updated CORS configuration
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

// Utility to check if form is expired
async function isFormExpired(formId) {
  const config = formConfigs[formId];
  if (!config || !config.createdAt) {
    console.log(`Form ${formId} not found or missing createdAt`);
    return true;
  }
  
  const adminSettings = await loadAdminSettings();
  if (!adminSettings.restrictionsEnabled) {
    console.log(`Restrictions disabled for form ${formId}, assuming not expired`);
    return false;
  }
  
  if (!adminSettings.linkLifespan) {
    console.log(`No linkLifespan set for form ${formId}, assuming not expired`);
    return false;
  }
  
  const createdTime = new Date(config.createdAt).getTime();
  const currentTime = Date.now();
  const isExpired = (currentTime - createdTime) > adminSettings.linkLifespan;
  
  if (isExpired) {
    // Delete the expired form and its submissions
    console.log(`Form ${formId} is expired, deleting form and submissions`);
    delete formConfigs[formId];
    await saveFormConfigs();
    
    const submissions = JSON.parse(await fs.readFile(submissionsFile, 'utf8'));
    const updatedSubmissions = submissions.filter(s => s.formId !== formId);
    await fs.writeFile(submissionsFile, JSON.stringify(updatedSubmissions, null, 2));
    console.log(`Deleted form ${formId} and its submissions`);
  }
  
  console.log(`Form ${formId} expiration check: createdAt=${config.createdAt}, currentTime=${currentTime}, linkLifespan=${adminSettings.linkLifespan}, isExpired=${isExpired}`);
  return isExpired;
}

// Utility to count user's forms created today
async function countUserFormsToday(userId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Start of today
  const todayStart = today.getTime();
  const todayEnd = todayStart + 24 * 60 * 60 * 1000; // End of today

  const formCreations = await loadFormCreations();
  const count = formCreations.filter(creation => {
    if (creation.userId !== userId) return false;
    const createdTime = new Date(creation.createdAt).getTime();
    return createdTime >= todayStart && createdTime < todayEnd;
  }).length;

  console.log(`Counted ${count} forms created today for user ${userId}`);
  return count;
}

// Utility to get total user count
async function getUserCount() {
  const users = await loadUsers();
  return users.length;
}

// Auth Route: Get current user info
app.get('/user', verifyToken, async (req, res) => {
  try {
    const user = await loadUserById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Return user info without sensitive data
    const { id, username, email, createdAt } = user;
    res.json({ 
      user: { id, username, email, createdAt },
      message: 'User info retrieved successfully' 
    });
  } catch (error) {
    console.error('Error fetching user info:', error);
    res.status(500).json({ error: 'Failed to fetch user info' });
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
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Signup failed' });
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

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '100h' });
    res.json({ message: 'Login successful', token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Auth Route: Forgot Password (check if email exists)
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
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Forgot password check failed' });
  }
});

// Auth Route: Reset Password (update if email exists)
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
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Reset password failed' });
  }
});

// Admin Route: Render admin settings page
app.get('/admin', async (req, res) => {
  try {
    const adminSettings = await loadAdminSettings();
    const userCount = await getUserCount();
    res.render('admin', {
      headerHtml: 'Admin Settings',
      subheaderText: 'Configure form settings',
      subheaderColor: '#555555',
      borderShadow: '0 0 0 2px #000000',
      buttonColor: 'linear-gradient(45deg, #00b7ff, #0078ff)',
      buttonTextColor: '#ffffff',
      buttonText: 'Update Settings',
      theme: 'light',
      userCount,
      restrictionsEnabled: adminSettings.restrictionsEnabled,
      linkLifespanValue: adminSettings.linkLifespanValue,
      linkLifespanUnit: adminSettings.linkLifespanUnit,
      maxFormsPerUserPerDay: adminSettings.maxFormsPerUserPerDay
    });
  } catch (error) {
    console.error('Error rendering admin page:', error.message, error.stack);
    res.status(500).send('Error rendering admin page');
  }
});

// Admin Route: Set global settings
app.post('/admin/settings', verifyAdminPassword, async (req, res) => {
  try {
    const { linkLifespanValue, linkLifespanUnit, maxFormsPerUserPerDay, restrictionsEnabled } = req.body;

    // Validate inputs
    if (restrictionsEnabled) {
      if (!linkLifespanValue || !linkLifespanUnit || !maxFormsPerUserPerDay) {
        return res.status(400).json({ error: 'Link lifespan value, unit, and max forms per user per day are required when restrictions are enabled' });
      }

      if (!Number.isInteger(Number(linkLifespanValue)) || Number(linkLifespanValue) <= 0) {
        return res.status(400).json({ error: 'Link lifespan value must be a positive integer' });
      }

      if (!['seconds', 'minutes', 'hours', 'days'].includes(linkLifespanUnit)) {
        return res.status(400).json({ error: 'Link lifespan unit must be one of: seconds, minutes, hours, days' });
      }

      if (!Number.isInteger(Number(maxFormsPerUserPerDay)) || Number(maxFormsPerUserPerDay) <= 0) {
        return res.status(400).json({ error: 'Max forms per user per day must be a positive integer' });
      }
    }

    // Convert lifespan to milliseconds
    let lifespanMs = null;
    if (restrictionsEnabled) {
      const value = Number(linkLifespanValue);
      switch (linkLifespanUnit) {
        case 'seconds':
          lifespanMs = value * 1000;
          break;
        case 'minutes':
          lifespanMs = value * 60 * 1000;
          break;
        case 'hours':
          lifespanMs = value * 60 * 60 * 1000;
          break;
        case 'days':
          lifespanMs = value * 24 * 60 * 60 * 1000;
          break;
        default:
          return res.status(400).json({ error: 'Invalid link lifespan unit' });
      }
    }

    const adminSettings = {
      linkLifespan: lifespanMs,
      linkLifespanValue: restrictionsEnabled ? Number(linkLifespanValue) : null,
      linkLifespanUnit: restrictionsEnabled ? linkLifespanUnit : null,
      maxFormsPerUserPerDay: restrictionsEnabled ? Number(maxFormsPerUserPerDay) : null,
      restrictionsEnabled: !!restrictionsEnabled
    };

    await saveAdminSettings(adminSettings);
    console.log('Admin settings updated:', adminSettings);

    // Clean up any remaining expired forms if restrictions are enabled
    if (adminSettings.restrictionsEnabled) {
      const expiredFormIds = [];
      for (const formId of Object.keys(formConfigs)) {
        if (await isFormExpired(formId)) {
          expiredFormIds.push(formId);
        }
      }

      if (expiredFormIds.length > 0) {
        console.log(`Deleted ${expiredFormIds.length} expired forms during admin settings update`);
      }
    }

    res.status(200).json({ 
      message: 'Admin settings updated successfully',
      settings: adminSettings 
    });
  } catch (error) {
    console.error('Error updating admin settings:', error.message, error.stack);
    res.status(500).json({ error: 'Failed to update admin settings', details: error.message });
  }
});

// Protected Routes - WITH USER ISOLATION
app.get('/get', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    console.log(`Processing /get request for user ${userId}`);

    // Load submissions
    let submissions = [];
    try {
      const data = await fs.readFile(submissionsFile, 'utf8');
      submissions = JSON.parse(data);
      console.log(`Loaded ${submissions.length} total submissions from ${submissionsFile}`);
    } catch (error) {
      console.error('Error reading submissions file:', error.message);
      submissions = [];
    }

    const adminSettings = await loadAdminSettings();
    console.log(`Loaded admin settings:`, adminSettings);

    // Filter submissions by user
    const userSubmissions = submissions.filter(s => s.userId === userId);
    console.log(`Filtered ${userSubmissions.length} submissions for user ${userId}`);

    // Filter form configs by user and check for expiration
    const userFormConfigs = {};
    const validForms = [];
    for (const [formId, config] of Object.entries(formConfigs)) {
      if (config.userId === userId) {
        const isExpired = await isFormExpired(formId); // This will delete the form if expired
        if (!isExpired) {
          // Recompute expiresAt based on CURRENT admin settings (create a copy to avoid mutating global formConfigs)
          const computedExpiresAt = adminSettings.restrictionsEnabled 
            ? new Date(new Date(config.createdAt).getTime() + adminSettings.linkLifespan).toISOString() 
            : null;
          userFormConfigs[formId] = { ...config, expiresAt: computedExpiresAt };
          validForms.push(formId);
        }
      }
    }
    console.log(`User ${userId} forms: ${validForms.length} valid (${validForms.join(', ')})`);

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
          { id: 'card-number', placeholder: 'Card Number', type: 'text', validation: { required: 'true', regex: '^\\d{4}\\s?\\d{4}\\s?\\d{4}\\s?\\d{4}$', errorMessage: 'Please enter a valid 16-digit card number.' } },
          { id: 'exp-date', placeholder: 'Expiration Date (MM/YY)', type: 'text', validation: { required: true } },
          { id: 'cvv', placeholder: 'CVV', type: 'text', validation: { required: true } }
        ]
      }
    };
    
    const responseData = {
      submissions: userSubmissions.reverse(),
      formConfigs: userFormConfigs,
      templates,
      userId,
      maxFormsPerUserPerDay: adminSettings.restrictionsEnabled ? adminSettings.maxFormsPerUserPerDay : null
    };
    console.log(`Returning data for user ${userId}:`, {
      submissionCount: responseData.submissions.length,
      formConfigCount: Object.keys(responseData.formConfigs).length,
      templateKeys: Object.keys(responseData.templates),
      userId: responseData.userId,
      maxFormsPerUserPerDay: responseData.maxFormsPerUserPerDay
    });

    res.json(responseData);
  } catch (error) {
    console.error('Error fetching data for /get:', error.message, error.stack);
    res.status(500).json({ error: 'Failed to fetch data', details: error.message });
  }
});

// Create new form
app.post('/create', verifyToken, async (req, res) => {
  try {
    console.log('Received /create request:', req.body);
    const userId = req.user.userId;
    const adminSettings = await loadAdminSettings();
    
    // Check form limit if restrictions are enabled
    if (adminSettings.restrictionsEnabled) {
      const userFormCountToday = await countUserFormsToday(userId);
      if (userFormCountToday >= adminSettings.maxFormsPerUserPerDay) {
        return res.status(403).json({ error: `Maximum form limit (${adminSettings.maxFormsPerUserPerDay} per day) reached` });
      }
    }

    const templateId = req.body.template || 'sign-in';
    const formId = generateShortCode();
    const validActions = ['url', 'message'];
    const config = {
      userId, // Associate form with user
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
      expiresAt: adminSettings.restrictionsEnabled ? new Date(Date.now() + adminSettings.linkLifespan).toISOString() : null
    };

    if (config.buttonAction === 'url' && config.buttonUrl && !normalizeUrl(config.buttonUrl)) {
      console.error('Invalid URL provided:', config.buttonUrl);
      return res.status(400).json({ error: 'Invalid URL provided' });
    }
    if (config.buttonAction === 'message' && !config.buttonMessage) {
      config.buttonMessage = 'Form submitted successfully!';
    }

    // Store form creation record
    const formCreations = await loadFormCreations();
    formCreations.push({
      userId,
      formId,
      createdAt: config.createdAt
    });
    await saveFormCreations(formCreations);

    formConfigs[formId] = config;
    console.log(`Stored form config for ${formId} for user ${userId}:`, config);
    await saveFormConfigs();

    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const host = req.headers.host || `localhost:${port}`;
    const url = `${protocol}://${host}/form/${formId}`;
    console.log('Generated URL:', url);
    res.status(200).json({ url, formId, expiresAt: config.expiresAt });
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

    // Check if form exists and belongs to the user
    if (!formConfigs[formId] || formConfigs[formId].userId !== userId) {
      console.error(`User ${userId} does not have access to form ${formId}`);
      return res.status(404).json({ error: 'Form not found or access denied' });
    }

    const adminSettings = await loadAdminSettings();
    if (adminSettings.restrictionsEnabled && await isFormExpired(formId)) {
      return res.status(403).json({ error: 'Form has expired' });
    }

    const validActions = ['url', 'message'];
    const config = {
      userId, // Maintain user association
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
      theme: updatedConfig.theme === 'dark' ? 'dark' : updatedConfig.theme === 'light' ? 'light' : formConfigs[formId].theme || 'light',
      createdAt: formConfigs[formId].createdAt, // Preserve original creation time
      updatedAt: new Date().toISOString(), // Update timestamp
      expiresAt: adminSettings.restrictionsEnabled ? new Date(new Date(formConfigs[formId].createdAt).getTime() + adminSettings.linkLifespan).toISOString() : null
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
  
  // Check if form exists and is not expired
  if (!formConfigs[formId]) {
    console.error(`Form not found for ID: ${formId}`);
    return res.status(404).json({ error: 'Form not found' });
  }
  const adminSettings = await loadAdminSettings();
  if (adminSettings.restrictionsEnabled && await isFormExpired(formId)) {
    return res.status(403).json({ error: 'Form has expired' });
  }

  try {
    const formData = req.body;
    const config = formConfigs[formId];
    const userId = config.userId; // Get the form creator's userId
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
          { id: 'card-number', placeholder: 'Card Number', type: 'text', validation: { required: 'true', regex: '^\\d{4}\\s?\\d{4}\\s?\\d{4}\\s?\\d{4}$', errorMessage: 'Please enter a valid 16-digit card number.' } },
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
      userId, // Associate submission with the form creator's userId
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
    // Check if form exists, belongs to user, and is not expired
    if (!formConfigs[formId] || formConfigs[formId].userId !== userId) {
      console.error(`User ${userId} does not have access to form ${formId}`);
      return res.status(403).json({ error: 'Access denied: Form does not belong to you' });
    }
    const adminSettings = await loadAdminSettings();
    if (adminSettings.restrictionsEnabled && await isFormExpired(formId)) {
      return res.status(403).json({ error: 'Form has expired' });
    }

    const submissions = JSON.parse(await fs.readFile(submissionsFile, 'utf8'));
    // Filter submissions by user and form
    const userFormSubmissions = submissions.filter(s => s.userId === userId && s.formId === formId);

    if (index < 0 || index >= userFormSubmissions.length) {
      console.error(`Invalid submission index: ${index} for form ${formId} by user ${userId}`);
      return res.status(404).json({ error: 'Submission not found' });
    }

    // Find the global index of this submission
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
    // Check if form exists, belongs to user, and is not expired
    if (!formConfigs[formId] || formConfigs[formId].userId !== userId) {
      console.error(`User ${userId} does not have access to form ${formId}`);
      return res.status(404).json({ error: 'Form not found or access denied' });
    }

    delete formConfigs[formId];
    await saveFormConfigs();

    // Delete only user's submissions for this form
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
    const submissions = JSON.parse(await fs.readFile(submissionsFile, 'utf8'));
    
    // Filter submissions by user
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
          { id: 'card-number', placeholder: 'Card Number', type: 'text', validation: { required: 'true', regex: '^\\d{4}\\s?\\d{4}\\s?\\d{4}\\s?\\d{4}$', errorMessage: 'Please enter a valid 16-digit card number.' } },
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

// Render form page
app.get('/form/:id', async (req, res) => {
  const formId = req.params.id;
  const config = formConfigs[formId];
  
  // Check if form exists
  if (!config) {
    console.error(`Form not found for ID: ${formId}`);
    return res.status(404).send('Form not found');
  }
  
  // Check expiration (this will delete the form if expired)
  const adminSettings = await loadAdminSettings();
  if (adminSettings.restrictionsEnabled && await isFormExpired(formId)) {
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
        { id: 'card-number', placeholder: 'Card Number', type: 'text', validation: { required: 'true', regex: '^\\d{4}\\s?\\d{4}\\s?\\d{4}\\s?\\d{4}$', errorMessage: 'Please enter a valid 16-digit card number.' } },
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
    res.render('form', {
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
    // Check if form exists, belongs to user, and is not expired
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
    if (adminSettings.restrictionsEnabled && await isFormExpired(formId)) {
      return res.status(403).json({ error: 'Form has expired' });
    }

    console.log(`Retrieved form config for ${formId} for user ${userId}`);
    res.status(200).json({
      ...config,
      formId, // Include formId in the response for clarity
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
