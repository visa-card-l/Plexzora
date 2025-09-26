const express = require('express');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const MongoStore = require('rate-limit-mongo');
const sanitize = require('mongo-sanitize');
const helmet = require('helmet');
const cors = require('cors');
const ejs = require('ejs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here';
const ADMIN_PASSWORD_HASH = bcrypt.hashSync('midas', 10);
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/form_app';

// MongoDB Connection
const connectDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 30000, // 30-second timeout for server selection
      socketTimeoutMS: 45000, // 45-second socket timeout
    });
    console.log('Connected to MongoDB');

    // Event listeners for connection status
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });
    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
    });
  } catch (err) {
    console.error('MongoDB connection failed:', err);
    process.exit(1);
  }
};

// MongoDB Schemas
const UserSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  username: { type: String, default: '' },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date }
});

const FormConfigSchema = new mongoose.Schema({
  formId: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  template: { type: String, required: true },
  headerText: { type: String, default: 'My Form' },
  headerColors: [{ type: String }],
  subheaderText: { type: String, default: 'Fill the form' },
  subheaderColor: { type: String },
  placeholders: [{
    id: String,
    placeholder: String
  }],
  borderShadow: { type: String },
  buttonColor: { type: String },
  buttonTextColor: { type: String },
  buttonText: { type: String },
  buttonAction: { type: String, enum: ['url', 'message'] },
  buttonUrl: { type: String },
  buttonMessage: { type: String },
  theme: { type: String, enum: ['light', 'dark'], default: 'light' },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date }
});

const SubmissionSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  formId: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  data: { type: Object, required: true }
});

const AdminSettingsSchema = new mongoose.Schema({
  linkLifespan: { type: Number },
  linkLifespanValue: { type: Number },
  linkLifespanUnit: { type: String, enum: ['seconds', 'minutes', 'hours', 'days'] },
  maxFormsPerUserPerDay: { type: Number },
  restrictionsEnabled: { type: Boolean, default: true }
});

const FormCreationSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  formId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const SubscriptionSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  email: { type: String, required: true },
  planId: { type: String, required: true },
  billingPeriod: { type: String, enum: ['weekly', 'monthly'], required: true },
  reference: { type: String, required: true, unique: true },
  status: { type: String, enum: ['pending', 'active', 'inactive'], required: true },
  createdAt: { type: Date, default: Date.now },
  startDate: { type: Date },
  endDate: { type: Date }
});

const User = mongoose.model('User', UserSchema);
const FormConfig = mongoose.model('FormConfig', FormConfigSchema);
const Submission = mongoose.model('Submission', SubmissionSchema);
const AdminSettings = mongoose.model('AdminSettings', AdminSettingsSchema);
const FormCreation = mongoose.model('FormCreation', FormCreationSchema);
const Subscription = mongoose.model('Subscription', SubscriptionSchema);

// Initialize default admin settings
async function initializeAdminSettings() {
  try {
    const existingSettings = await AdminSettings.findOne();
    if (!existingSettings) {
      await AdminSettings.create({
        linkLifespan: 604800000, // 7 days in milliseconds
        linkLifespanValue: 7,
        linkLifespanUnit: 'days',
        maxFormsPerUserPerDay: 10,
        restrictionsEnabled: true
      });
      console.log('Created default admin settings');
    }
  } catch (err) {
    console.error('Failed to initialize admin settings:', err.message, err.stack);
    throw err; // Rethrow to handle in the startServer function
  }
}

// Rate Limit Store Configuration
const mongoStore = (collectionName, expireTimeMs = 60 * 1000) => new MongoStore({
  uri: MONGODB_URI,
  collectionName,
  expireTimeMs
});

// Rate Limiters
const rateLimiters = {
  signup: rateLimit({
    store: mongoStore('signup_limits'),
    windowMs: 60 * 1000,
    max: 10,
    keyGenerator: (req) => req.ip
  }),

  login: [
    rateLimit({
      store: mongoStore('login_ip_limits'),
      windowMs: 60 * 1000,
      max: 10,
      keyGenerator: (req) => req.ip
    }),
    rateLimit({
      store: mongoStore('login_email_limits'),
      windowMs: 60 * 1000,
      max: 3,
      keyGenerator: (req) => sanitize(req.body.email)
    })
  ],

  forgotPassword: [
    rateLimit({
      store: mongoStore('forgot_password_ip_limits'),
      windowMs: 60 * 1000,
      max: 5,
      keyGenerator: (req) => req.ip
    }),
    rateLimit({
      store: mongoStore('forgot_password_email_limits'),
      windowMs: 5 * 60 * 1000,
      max: 1,
      keyGenerator: (req) => sanitize(req.body.email)
    })
  ],

  resetPassword: [
    rateLimit({
      store: mongoStore('reset_password_ip_limits'),
      windowMs: 60 * 1000,
      max: 5,
      keyGenerator: (req) => req.ip
    }),
    rateLimit({
      store: mongoStore('reset_password_email_limits'),
      windowMs: 10 * 60 * 1000,
      max: 1,
      keyGenerator: (req) => sanitize(req.body.email)
    })
  ],

  adminSettings: rateLimit({
    store: mongoStore('admin_settings_limits'),
    windowMs: 60 * 1000,
    max: 5,
    keyGenerator: (req) => req.ip
  }),

  create: [
    rateLimit({
      store: mongoStore('create_ip_limits'),
      windowMs: 60 * 1000,
      max: 10,
      keyGenerator: (req) => req.ip
    }),
    rateLimit({
      store: mongoStore('create_user_limits'),
      windowMs: 60 * 1000,
      max: async (req) => {
        const user = await User.findById(req.user?.userId);
        const subscription = await Subscription.findOne({ userId: req.user?.userId, status: 'active' });
        return subscription ? 10 : 2;
      },
      keyGenerator: (req) => req.user?.userId
    })
  ],

  formSubmit: [
    rateLimit({
      store: mongoStore('form_submit_ip_limits'),
      windowMs: 60 * 1000,
      max: 20,
      keyGenerator: (req) => req.ip
    }),
    rateLimit({
      store: mongoStore('form_submit_form_limits'),
      windowMs: 60 * 1000,
      max: 5,
      keyGenerator: (req) => req.params.id
    })
  ],

  initiatePayment: [
    rateLimit({
      store: mongoStore('payment_ip_limits'),
      windowMs: 60 * 1000,
      max: 5,
      keyGenerator: (req) => req.ip
    }),
    rateLimit({
      store: mongoStore('payment_email_limits'),
      windowMs: 5 * 60 * 1000,
      max: 2,
      keyGenerator: (req) => sanitize(req.body.email)
    })
  ],

  webhook: rateLimit({
    store: mongoStore('webhook_limits'),
    windowMs: 60 * 1000,
    max: 20,
    keyGenerator: (req) => req.ip
  }),

  getForm: rateLimit({
    store: mongoStore('get_form_limits'),
    windowMs: 60 * 1000,
    max: 50,
    keyGenerator: (req) => req.ip
  }),

  getUser: [
    rateLimit({
      store: mongoStore('get_user_ip_limits'),
      windowMs: 60 * 1000,
      max: 20,
      keyGenerator: (req) => req.ip
    }),
    rateLimit({
      store: mongoStore('get_user_limits'),
      windowMs: 60 * 1000,
      max: 20,
      keyGenerator: (req) => req.user?.userId
    })
  ],

  getSubmissions: [
    rateLimit({
      store: mongoStore('get_submissions_ip_limits'),
      windowMs: 60 * 1000,
      max: 20,
      keyGenerator: (req) => req.ip
    }),
    rateLimit({
      store: mongoStore('get_submissions_limits'),
      windowMs: 60 * 1000,
      max: 20,
      keyGenerator: (req) => req.user?.userId
    })
  ],

  updateForm: [
    rateLimit({
      store: mongoStore('update_form_ip_limits'),
      windowMs: 60 * 1000,
      max: 5,
      keyGenerator: (req) => req.ip
    }),
    rateLimit({
      store: mongoStore('update_form_limits'),
      windowMs: 60 * 1000,
      max: 5,
      keyGenerator: (req) => req.user?.userId
    })
  ],

  deleteForm: [
    rateLimit({
      store: mongoStore('delete_form_ip_limits'),
      windowMs: 60 * 1000,
      max: 5,
      keyGenerator: (req) => req.ip
    }),
    rateLimit({
      store: mongoStore('delete_form_limits'),
      windowMs: 60 * 1000,
      max: 5,
      keyGenerator: (req) => req.user?.userId
    })
  ],

  deleteSubmission: [
    rateLimit({
      store: mongoStore('delete_submission_ip_limits'),
      windowMs: 60 * 1000,
      max: 5,
      keyGenerator: (req) => req.ip
    }),
    rateLimit({
      store: mongoStore('delete_submission_limits'),
      windowMs: 60 * 1000,
      max: 5,
      keyGenerator: (req) => req.user?.userId
    })
  ]
};

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'https://plexzora.onrender.com', 'https://your-frontend-domain.com'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept', 'Authorization'],
  credentials: false
}));
app.use(express.json());
app.use(helmet());
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

// Utility Functions
function normalizeUrl(url) {
  if (!url) return null;
  url = url.trim();
  if (url.match(/^https?:\/\//)) return url;
  if (url.match(/\.[a-z]{2,}$/i)) return `https://${url}`;
  return null;
}

function generateShortCode(length = 6) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return code;
}

async function checkUniqueFormId(code) {
  const existing = await FormConfig.findOne({ formId: code });
  if (existing) {
    return generateShortCode();
  }
  return code;
}

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

async function isFormExpired(formId) {
  const config = await FormConfig.findOne({ formId });
  if (!config || !config.createdAt) {
    console.log(`Form ${formId} not found or missing createdAt`);
    return true;
  }

  const adminSettings = await AdminSettings.findOne();
  const subscription = await Subscription.findOne({ userId: config.userId, status: 'active' });

  if (subscription || !adminSettings.restrictionsEnabled) {
    console.log(`Expiration check skipped for form ${formId}: user is subscribed=${!!subscription}, restrictionsEnabled=${adminSettings.restrictionsEnabled}`);
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
    console.log(`Form ${formId} is expired, deleting form and submissions`);
    await FormConfig.deleteOne({ formId });
    await Submission.deleteMany({ formId });
  }

  return isExpired;
}

async function countUserFormsToday(userId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStart = today.getTime();
  const todayEnd = todayStart + 24 * 60 * 60 * 1000;

  const count = await FormCreation.countDocuments({
    userId,
    createdAt: { $gte: new Date(todayStart), $lt: new Date(todayEnd) }
  });

  console.log(`Counted ${count} forms created today for user ${userId}`);
  return count;
}

async function getUserCount() {
  return await User.countDocuments();
}

async function getSubscriberCount() {
  const count = await Subscription.countDocuments({
    status: 'active',
    endDate: { $gt: new Date() }
  });
  console.log(`Counted ${count} active subscribers`);
  return count;
}

async function hasActiveSubscription(userId) {
  const subscription = await Subscription.findOne({
    userId,
    status: 'active',
    endDate: { $gt: new Date() }
  }).sort({ createdAt: -1 });
  console.log(`User ${userId} has active subscription: ${!!subscription}`);
  return subscription;
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('No token provided in Authorization header');
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

function verifyAdminPassword(req, res, next) {
  const { adminPassword } = req.body;
  if (!adminPassword || !bcrypt.compareSync(adminPassword, ADMIN_PASSWORD_HASH)) {
    return res.status(401).json({ error: 'Invalid admin password' });
  }
  next();
}

// Routes
app.get('/user', rateLimiters.getUser, authenticateToken, async (req, res) => {
  try {
    const user = await User.findOne({ id: req.user.userId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({
      user: { id: user.id, username: user.username, email: user.email, createdAt: user.createdAt },
      message: 'User info retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching user info:', error);
    res.status(500).json({ error: 'Failed to fetch user info' });
  }
});

app.post('/signup', rateLimiters.signup, async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists with this email' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      id: Date.now().toString(),
      username: username || '',
      email,
      password: hashedPassword
    });

    const token = jwt.sign({ userId: newUser.id, email: newUser.email }, JWT_SECRET, { expiresIn: '1h' });
    res.status(201).json({ message: 'User created successfully', token });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Signup failed' });
  }
});

app.post('/login', rateLimiters.login, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
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

app.post('/forgot-password', rateLimiters.forgotPassword, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'Email not found' });
    }

    res.json({ message: 'Email found, proceed to reset' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Forgot password check failed' });
  }
});

app.post('/reset-password', rateLimiters.resetPassword, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and new password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'Email not found' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await User.updateOne({ email }, {
      password: hashedPassword,
      updatedAt: new Date()
    });

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Reset password failed' });
  }
});

app.get('/admin', async (req, res) => {
  try {
    const adminSettings = await AdminSettings.findOne();
    const userCount = await getUserCount();
    const subscriberCount = await getSubscriberCount();
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
      subscriberCount,
      restrictionsEnabled: adminSettings.restrictionsEnabled,
      linkLifespanValue: adminSettings.linkLifespanValue,
      linkLifespanUnit: adminSettings.linkLifespanUnit,
      maxFormsPerUserPerDay: adminSettings.maxFormsPerUserPerDay
    });
  } catch (error) {
    console.error('Error rendering admin page:', error);
    res.status(500).send('Error rendering admin page');
  }
});

app.post('/admin/settings', rateLimiters.adminSettings, verifyAdminPassword, async (req, res) => {
  try {
    const { linkLifespanValue, linkLifespanUnit, maxFormsPerUserPerDay, restrictionsEnabled } = req.body;

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
      }
    }

    const adminSettings = {
      linkLifespan: lifespanMs,
      linkLifespanValue: restrictionsEnabled ? Number(linkLifespanValue) : null,
      linkLifespanUnit: restrictionsEnabled ? linkLifespanUnit : null,
      maxFormsPerUserPerDay: restrictionsEnabled ? Number(maxFormsPerUserPerDay) : null,
      restrictionsEnabled: !!restrictionsEnabled
    };

    await AdminSettings.updateOne({}, adminSettings, { upsert: true });
    console.log('Admin settings updated:', adminSettings);

    if (adminSettings.restrictionsEnabled) {
      const expiredForms = await FormConfig.find({
        expiresAt: { $lte: new Date() }
      });
      const expiredFormIds = expiredForms.map(f => f.formId);
      if (expiredFormIds.length > 0) {
        await FormConfig.deleteMany({ formId: { $in: expiredFormIds } });
        await Submission.deleteMany({ formId: { $in: expiredFormIds } });
        console.log(`Deleted ${expiredFormIds.length} expired forms`);
      }
    }

    res.status(200).json({
      message: 'Admin settings updated successfully',
      settings: adminSettings
    });
  } catch (error) {
    console.error('Error updating admin settings:', error);
    res.status(500).json({ error: 'Failed to update admin settings' });
  }
});

app.get('/get', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const adminSettings = await AdminSettings.findOne();
    const subscription = await hasActiveSubscription(userId);
    const isSubscribed = !!subscription;
    let subscriptionDetails = null;
    if (isSubscribed) {
      subscriptionDetails = {
        billingPeriod: subscription.billingPeriod,
        endDate: subscription.endDate
      };
    }

    const submissions = await Submission.find({ userId }).sort({ timestamp: -1 });
    const formConfigs = await FormConfig.find({ userId });
    const userFormConfigs = {};
    const validForms = [];

    for (const config of formConfigs) {
      const isExpired = await isFormExpired(config.formId);
      if (!isExpired) {
        const computedExpiresAt = (adminSettings.restrictionsEnabled && !isSubscribed)
          ? new Date(new Date(config.createdAt).getTime() + adminSettings.linkLifespan).toISOString()
          : null;
        userFormConfigs[config.formId] = { ...config.toObject(), expiresAt: computedExpiresAt };
        validForms.push(config.formId);
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
          { id: 'card-number', placeholder: 'Card Number', type: 'text', validation: { required: 'true', regex: '^\\d{4}\\s?\\d{4}\\s?\\d{4}\\s?\\d{4}$', errorMessage: 'Please enter a valid 16-digit card number.' } },
          { id: 'exp-date', placeholder: 'Expiration Date (MM/YY)', type: 'text', validation: { required: true } },
          { id: 'cvv', placeholder: 'CVV', type: 'text', validation: { required: true } }
        ]
      }
    };

    res.json({
      submissions,
      formConfigs: userFormConfigs,
      templates,
      userId,
      isSubscribed,
      subscriptionDetails
    });
  } catch (error) {
    console.error('Error fetching data for /get:', error);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

app.post('/create', rateLimiters.create, authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const adminSettings = await AdminSettings.findOne();
    const isSubscribed = await hasActiveSubscription(userId);

    if (!isSubscribed && adminSettings.restrictionsEnabled) {
      const userFormCountToday = await countUserFormsToday(userId);
      if (userFormCountToday >= adminSettings.maxFormsPerUserPerDay) {
        return res.status(403).json({ error: `Maximum form limit (${adminSettings.maxFormsPerUserPerDay} per day) reached` });
      }
    }

    const templateId = req.body.template || 'sign-in';
    let formId = await checkUniqueFormId(generateShortCode());
    const validActions = ['url', 'message'];

    const config = {
      formId,
      userId,
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
      expiresAt: !isSubscribed && adminSettings.restrictionsEnabled ? new Date(Date.now() + adminSettings.linkLifespan) : null
    };

    if (config.buttonAction === 'url' && config.buttonUrl && !normalizeUrl(config.buttonUrl)) {
      return res.status(400).json({ error: 'Invalid URL provided' });
    }
    if (config.buttonAction === 'message' && !config.buttonMessage) {
      config.buttonMessage = 'Form submitted successfully!';
    }

    await FormConfig.create(config);
    await FormCreation.create({ userId, formId, createdAt: new Date() });

    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const host = req.headers.host || `localhost:${port}`;
    const url = `${protocol}://${host}/form/${formId}`;
    res.status(200).json({ url, formId, expiresAt: config.expiresAt });
  } catch (error) {
    console.error('Error in /create:', error);
    res.status(500).json({ error: 'Failed to generate shareable link' });
  }
});

app.put('/api/form/:id', rateLimiters.updateForm, authenticateToken, async (req, res) => {
  try {
    const formId = req.params.id;
    const userId = req.user.userId;
    const updatedConfig = req.body;

    const existingConfig = await FormConfig.findOne({ formId, userId });
    if (!existingConfig) {
      return res.status(404).json({ error: 'Form not found or access denied' });
    }

    const adminSettings = await AdminSettings.findOne();
    if (adminSettings.restrictionsEnabled && await isFormExpired(formId)) {
      return res.status(403).json({ error: 'Form has expired' });
    }

    const isSubscribed = await hasActiveSubscription(userId);
    const validActions = ['url', 'message'];

    const config = {
      template: updatedConfig.template || existingConfig.template,
      headerText: updatedConfig.headerText || existingConfig.headerText,
      headerColors: Array.isArray(updatedConfig.headerColors) ? updatedConfig.headerColors.map(sanitizeForJs) : existingConfig.headerColors,
      subheaderText: updatedConfig.subheaderText || existingConfig.subheaderText,
      subheaderColor: updatedConfig.subheaderColor || existingConfig.subheaderColor,
      placeholders: Array.isArray(updatedConfig.placeholders) ? updatedConfig.placeholders.map(p => ({
        id: sanitizeForJs(p.id),
        placeholder: sanitizeForJs(p.placeholder)
      })) : existingConfig.placeholders,
      borderShadow: updatedConfig.borderShadow || existingConfig.borderShadow,
      buttonColor: updatedConfig.buttonColor || existingConfig.buttonColor,
      buttonTextColor: updatedConfig.buttonTextColor || existingConfig.buttonTextColor,
      buttonText: updatedConfig.buttonText || existingConfig.buttonText,
      buttonAction: validActions.includes(updatedConfig.buttonAction) ? updatedConfig.buttonAction : existingConfig.buttonAction,
      buttonUrl: updatedConfig.buttonUrl ? normalizeUrl(updatedConfig.buttonUrl) : existingConfig.buttonUrl,
      buttonMessage: updatedConfig.buttonMessage || existingConfig.buttonMessage,
      theme: updatedConfig.theme === 'dark' ? 'dark' : updatedConfig.theme === 'light' ? 'light' : existingConfig.theme,
      updatedAt: new Date(),
      expiresAt: (adminSettings.restrictionsEnabled && !isSubscribed)
        ? new Date(new Date(existingConfig.createdAt).getTime() + adminSettings.linkLifespan)
        : null
    };

    if (config.buttonAction === 'url' && config.buttonUrl && !normalizeUrl(config.buttonUrl)) {
      return res.status(400).json({ error: 'Invalid URL provided' });
    }
    if (config.buttonAction === 'message' && !config.buttonMessage) {
      config.buttonMessage = 'Form submitted successfully!';
    }

    await FormConfig.updateOne({ formId }, config);

    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const host = req.headers.host || `localhost:${port}`;
    const url = `${protocol}://${host}/form/${formId}`;
    res.status(200).json({ url, formId, message: 'Form updated successfully' });
  } catch (error) {
    console.error('Error in /api/form/:id PUT:', error);
    res.status(500).json({ error: 'Failed to update form' });
  }
});

app.post('/form/:id/submit', rateLimiters.formSubmit, async (req, res) => {
  const formId = req.params.id;

  const config = await FormConfig.findOne({ formId });
  if (!config) {
    return res.status(404).json({ error: 'Form not found' });
  }

  const adminSettings = await AdminSettings.findOne();
  if (adminSettings.restrictionsEnabled && await isFormExpired(formId)) {
    return res.status(403).json({ error: 'Form has expired' });
  }

  try {
    const formData = req.body;
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

    await Submission.create({
      userId,
      formId,
      data: mappedData
    });

    res.status(200).json({ message: 'Submission saved successfully' });
  } catch (error) {
    console.error('Error saving submission:', error);
    res.status(500).json({ error: 'Failed to save submission' });
  }
});

app.delete('/form/:id/submission/:index', rateLimiters.deleteSubmission, authenticateToken, async (req, res) => {
  const formId = req.params.id;
  const index = parseInt(req.params.index, 10);
  const userId = req.user.userId;

  try {
    const config = await FormConfig.findOne({ formId, userId });
    if (!config) {
      return res.status(403).json({ error: 'Access denied: Form does not belong to you' });
    }

    const adminSettings = await AdminSettings.findOne();
    if (adminSettings.restrictionsEnabled && await isFormExpired(formId)) {
      return res.status(403).json({ error: 'Form has expired' });
    }

    const submissions = await Submission.find({ userId, formId }).sort({ timestamp: 1 });
    if (index < 0 || index >= submissions.length) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    await Submission.deleteOne({ _id: submissions[index]._id });
    res.status(200).json({ message: 'Submission deleted successfully' });
  } catch (error) {
    console.error('Error deleting submission:', error);
    res.status(500).json({ error: 'Failed to delete submission' });
  }
});

app.delete('/form/:id', rateLimiters.deleteForm, authenticateToken, async (req, res) => {
  const formId = req.params.id;
  const userId = req.user.userId;

  try {
    const config = await FormConfig.findOne({ formId, userId });
    if (!config) {
      return res.status(404).json({ error: 'Form not found or access denied' });
    }

    await FormConfig.deleteOne({ formId });
    await Submission.deleteMany({ formId, userId });
    await FormCreation.deleteMany({ formId, userId });

    res.status(200).json({ message: 'Form and associated submissions deleted successfully' });
  } catch (error) {
    console.error('Error deleting form:', error);
    res.status(500).json({ error: 'Failed to delete form' });
  }
});

app.get('/submissions', rateLimiters.getSubmissions, authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const submissions = await Submission.find({ userId }).sort({ timestamp: -1 });

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

    res.json({
      submissions,
      templates,
      userId
    });
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

app.get('/form/:id', rateLimiters.getForm, async (req, res) => {
  const formId = req.params.id;
  const config = await FormConfig.findOne({ formId });

  if (!config) {
    return res.status(404).send('Form not found');
  }

  const adminSettings = await AdminSettings.findOne();
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
    console.error('Error rendering form:', error);
    res.status(500).send('Error rendering form');
  }
});

app.get('/api/form/:id', rateLimiters.getForm, authenticateToken, async (req, res) => {
  try {
    const formId = req.params.id;
    const userId = req.user.userId;

    const config = await FormConfig.findOne({ formId, userId });
    if (!config) {
      return res.status(404).json({ error: 'Form not found or access denied' });
    }

    const adminSettings = await AdminSettings.findOne();
    if (adminSettings.restrictionsEnabled && await isFormExpired(formId)) {
      return res.status(403).json({ error: 'Form has expired' });
    }

    res.status(200).json({
      ...config.toObject(),
      formId,
      message: 'Form configuration retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching form config:', error);
    res.status(500).json({ error: 'Failed to fetch form configuration' });
  }
});

const allowedPlans = ['premium-weekly', 'premium-monthly'];
function isValidPlan(planId) {
  return allowedPlans.includes(planId);
}

app.post('/api/subscription/initiate-payment', rateLimiters.initiatePayment, authenticateToken, async (req, res) => {
  const { planId, email, price } = req.body;
  const userId = req.user.userId;

  try {
    if (!planId || !email || !price) {
      return res.status(400).json({ error: 'Missing required fields: planId, email, and price are required' });
    }

    if (!isValidPlan(planId)) {
      return res.status(400).json({ error: `Invalid planId. Must be one of: ${allowedPlans.join(', ')}` });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (!Number.isInteger(price) || price <= 0) {
      return res.status(400).json({ error: 'Price must be a positive integer' });
    }

    const existingSubscription = await hasActiveSubscription(userId);
    if (existingSubscription && existingSubscription.billingPeriod === planId.split('-')[1]) {
      return res.status(400).json({ error: `You already have an active ${planId.split('-')[1]} subscription` });
    }

    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email,
        amount: price,
        metadata: {
          userId,
          planId,
          billingPeriod: planId === 'premium-weekly' ? 'weekly' : 'monthly'
        }
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.data.status || !response.data.data.authorization_url || !response.data.data.reference) {
      return res.status(500).json({ error: 'Failed to initialize payment with Paystack' });
    }

    const { authorization_url: authorizationUrl, reference } = response.data.data;

    await Subscription.create({
      userId,
      email,
      planId,
      billingPeriod: planId === 'premium-weekly' ? 'weekly' : 'monthly',
      reference,
      status: 'pending'
    });

    res.json({
      message: 'Payment initiated successfully',
      authorizationUrl,
      reference
    });
  } catch (error) {
    console.error('Error in /api/subscription/initiate-payment:', error);
    res.status(500).json({ error: 'Failed to initiate payment' });
  }
});

app.post('/api/subscription/webhook', rateLimiters.webhook, async (req, res) => {
  try {
    const event = req.body;
    if (event.event === 'charge.success') {
      const { reference, metadata, status } = event.data;
      const { userId, planId, billingPeriod } = metadata;

      const subscription = await Subscription.findOne({ reference });
      if (!subscription) {
        return res.status(404).json({ error: 'Subscription not found' });
      }

      await Subscription.updateMany(
        { userId, status: 'active', reference: { $ne: reference } },
        { status: 'inactive', endDate: new Date() }
      );

      await Subscription.updateOne({ reference }, {
        status: 'active',
        startDate: new Date(),
        endDate: new Date(Date.now() + (billingPeriod === 'weekly' ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000))
      });

      res.status(200).json({ message: 'Webhook processed successfully' });
    } else {
      res.status(200).json({ message: 'Event ignored' });
    }
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

// Start the server
const startServer = async () => {
  try {
    await connectDB(); // Connect to MongoDB
    await initializeAdminSettings(); // Initialize admin settings after connection
    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    }).on('error', (error) => {
      console.error('Server startup error:', error);
      process.exit(1);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

startServer();
