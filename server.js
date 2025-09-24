const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const jwt = require('jsonwebtoken');
const subscriptionRoutes = require('./routes/subscription'); // Subscription routes

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve static files from /public (e.g., dashboard.html)

// Environment variables
const DATA_DIR = process.env.DATA_DIR || './data';
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const FORMS_FILE = path.join(DATA_DIR, 'forms.json'); // For forms and submissions
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here';

// Ensure data files exist
async function ensureDataFiles() {
  try {
    await fs.access(USERS_FILE);
    console.log('users.json exists');
  } catch (error) {
    console.log('Creating users.json');
    await fs.writeFile(USERS_FILE, JSON.stringify([]));
  }

  try {
    await fs.access(FORMS_FILE);
    console.log('forms.json exists');
  } catch (error) {
    console.log('Creating forms.json');
    await fs.writeFile(FORMS_FILE, JSON.stringify({
      formConfigs: {},
      submissions: [],
      templates: {}
    }));
  }
}

// Authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    console.error('No token provided in Authorization header');
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('Token decoded:', decoded); // { id, email, username }
    req.user = decoded;
    next();
  } catch (error) {
    console.error('JWT verification error:', error.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// User endpoint
app.get('/user', authenticateToken, async (req, res) => {
  try {
    const users = JSON.parse(await fs.readFile(USERS_FILE, 'utf8'));
    const user = users.find(u => u.id === req.user.id);
    if (!user) {
      console.error(`User not found for ID: ${req.user.id}`);
      return res.status(404).json({ error: 'User not found' });
    }
    console.log('Serving /user:', { id: user.id, email: user.email, username: user.username });
    res.json({ user: { id: user.id, email: user.email, username: user.username } });
  } catch (error) {
    console.error('Error in /user:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get forms and submissions
app.get('/get', authenticateToken, async (req, res) => {
  try {
    const forms = JSON.parse(await fs.readFile(FORMS_FILE, 'utf8'));
    console.log('Serving /get:', {
      formConfigs: Object.keys(forms.formConfigs).length,
      submissions: forms.submissions.length,
      templates: Object.keys(forms.templates).length
    });
    res.json({
      formConfigs: forms.formConfigs || {},
      submissions: forms.submissions || [],
      templates: forms.templates || {}
    });
  } catch (error) {
    console.error('Error in /get:', error.message);
    res.status(500).json({ error: 'Failed to fetch forms' });
  }
});

// Create form (placeholder)
app.post('/create', authenticateToken, async (req, res) => {
  try {
    const { formId, headerText, theme, expiresAt } = req.body;
    if (!formId || !headerText) {
      console.error('Missing required fields for /create');
      return res.status(400).json({ error: 'Missing required fields: formId, headerText' });
    }

    const forms = JSON.parse(await fs.readFile(FORMS_FILE, 'utf8'));
    forms.formConfigs[formId] = {
      headerText,
      theme: theme || 'light',
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt || null
    };

    console.log(`Creating form: ${formId}`);
    await fs.writeFile(FORMS_FILE, JSON.stringify(forms, null, 2));
    res.json({ message: 'Form created successfully', formId });
  } catch (error) {
    console.error('Error in /create:', error.message);
    res.status(500).json({ error: 'Failed to create form' });
  }
});

// Delete form
app.delete('/form/:formId', authenticateToken, async (req, res) => {
  try {
    const { formId } = req.params;
    const forms = JSON.parse(await fs.readFile(FORMS_FILE, 'utf8'));

    if (!forms.formConfigs[formId]) {
      console.error(`Form not found: ${formId}`);
      return res.status(404).json({ error: 'Form not found' });
    }

    delete forms.formConfigs[formId];
    forms.submissions = forms.submissions.filter(sub => sub.formId !== formId);
    console.log(`Deleting form: ${formId}`);
    await fs.writeFile(FORMS_FILE, JSON.stringify(forms, null, 2));
    res.json({ message: 'Form deleted successfully' });
  } catch (error) {
    console.error('Error in /form/:formId DELETE:', error.message);
    res.status(500).json({ error: 'Failed to delete form' });
  }
});

// Delete submission
app.delete('/form/:formId/submission/:index', authenticateToken, async (req, res) => {
  try {
    const { formId, index } = req.params;
    const forms = JSON.parse(await fs.readFile(FORMS_FILE, 'utf8'));

    const submissionIndex = parseInt(index, 10);
    const submission = forms.submissions.find(sub => sub.formId === formId && forms.submissions.indexOf(sub) === submissionIndex);

    if (!submission) {
      console.error(`Submission not found: formId=${formId}, index=${index}`);
      return res.status(404).json({ error: 'Submission not found' });
    }

    forms.submissions.splice(submissionIndex, 1);
    console.log(`Deleting submission: formId=${formId}, index=${index}`);
    await fs.writeFile(FORMS_FILE, JSON.stringify(forms, null, 2));
    res.json({ message: 'Submission deleted successfully' });
  } catch (error) {
    console.error('Error in /form/:formId/submission/:index DELETE:', error.message);
    res.status(500).json({ error: 'Failed to delete submission' });
  }
});

// Subscription routes
app.use('/api/subscription', subscriptionRoutes);

// Login endpoint (placeholder, adjust as needed)
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const users = JSON.parse(await fs.readFile(USERS_FILE, 'utf8'));
    const user = users.find(u => u.email === email && u.password === password); // Simplified, use hashed passwords in production

    if (!user) {
      console.error('Login failed: Invalid credentials');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    console.log(`Login successful for user: ${user.email}`);
    res.json({ token });
  } catch (error) {
    console.error('Error in /login:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Register endpoint (placeholder, adjust as needed)
app.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      console.error('Registration failed: Missing required fields');
      return res.status(400).json({ error: 'Missing required fields: username, email, password' });
    }

    const users = JSON.parse(await fs.readFile(USERS_FILE, 'utf8'));
    if (users.find(u => u.email === email)) {
      console.error(`Registration failed: Email already exists: ${email}`);
      return res.status(400).json({ error: 'Email already exists' });
    }

    const userId = Date.now().toString(); // Simple ID generation
    const user = { id: userId, username, email, password }; // Hash password in production
    users.push(user);
    console.log(`Registering user: ${email}`);
    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));

    const token = jwt.sign(
      { id: userId, email, username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ token });
  } catch (error) {
    console.error('Error in /register:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Initialize data files on server start
ensureDataFiles().then(() => {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}).catch(error => {
  console.error('Failed to initialize data files:', error.message);
  process.exit(1);
});

// Export authenticateToken for use in other modules
module.exports = { authenticateToken };
