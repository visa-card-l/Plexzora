
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const router = express.Router();
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || 'sk_test_your_secret_key';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const subscriptionsFile = path.join(DATA_DIR, 'subscriptions.json');
const usersFile = path.join(DATA_DIR, 'users.json');
const ADMIN_PASSWORD_HASH = bcrypt.hashSync('midas', 10); // Must match server.js
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here'; // Must match server.js

// JWT verification middleware (same as server.js)
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

// Admin password verification middleware (same as server.js)
function verifyAdminPassword(req, res, next) {
  const { adminPassword } = req.body;
  if (!adminPassword || !bcrypt.compareSync(adminPassword, ADMIN_PASSWORD_HASH)) {
    return res.status(401).json({ error: 'Invalid admin password' });
  }
  next();
}

// Paystack webhook verification middleware
function verifyPaystackWebhook(req, res, next) {
  const hash = crypto
    .createHmac('sha512', PAYSTACK_SECRET_KEY)
    .update(JSON.stringify(req.body))
    .digest('hex');
  const signature = req.headers['x-paystack-signature'];
  if (!signature || hash !== signature) {
    console.error('Invalid Paystack webhook signature');
    return res.status(400).json({ error: 'Invalid webhook signature' });
  }
  next();
}

// Initialize subscriptions file
async function initializeSubscriptionsFile() {
  try {
    await fs.access(subscriptionsFile);
    console.log(`Subscriptions file exists: ${subscriptionsFile}`);
  } catch {
    await fs.writeFile(subscriptionsFile, JSON.stringify([]));
    console.log('Created subscriptions.json');
  }
}

// Load subscriptions
async function loadSubscriptions() {
  try {
    const data = await fs.readFile(submissionsFile, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error loading subscriptions:', err.message);
    return [];
  }
}

// Save subscriptions
async function saveSubscriptions(subscriptions) {
  try {
    await fs.writeFile(subscriptionsFile, JSON.stringify(subscriptions, null, 2));
    console.log('Saved subscriptions to file');
  } catch (err) {
    console.error('Error saving subscriptions:', err.message, err.stack);
    throw err;
  }
}

// Load users (same as server.js)
async function loadUsers() {
  try {
    const data = await fs.readFile(usersFile, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error loading users:', err.message);
    return [];
  }
}

// Initialize subscriptions file on startup
(async () => {
  try {
    await initializeSubscriptionsFile();
  } catch (err) {
    console.error('Failed to initialize subscriptions file:', err.message, err.stack);
    process.exit(1);
  }
})();

// Subscription Plans
router.get('/plans', async (req, res) => {
  try {
    const plans = [
      { id: 'premium-weekly', name: 'Premium Weekly', price: 80000, billingPeriod: 'weekly' },
      { id: 'premium-monthly', name: 'Premium Monthly', price: 300000, billingPeriod: 'monthly' }
    ];
    res.json({ plans });
  } catch (error) {
    console.error('Error fetching plans:', error.message);
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
});

// Initiate Payment
router.post('/initiate-payment', verifyToken, async (req, res) => {
  try {
    const { planId, email, price } = req.body;
    const userId = req.user.userId;

    if (!planId || !email || !price) {
      return res.status(400).json({ error: 'planId, email, and price are required' });
    }

    const users = await loadUsers();
    const user = users.find(u => u.id === userId && u.email === email);
    if (!user) {
      return res.status(404).json({ error: 'User not found or email mismatch' });
    }

    const validPlans = [
      { id: 'premium-weekly', price: 80000, billingPeriod: 'weekly' },
      { id: 'premium-monthly', price: 300000, billingPeriod: 'monthly' }
    ];
    const plan = validPlans.find(p => p.id === planId);
    if (!plan) {
      return res.status(400).json({ error: 'Invalid plan ID' });
    }

    if (plan.price !== price) {
      return res.status(400).json({ error: 'Price mismatch for the selected plan' });
    }

    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email,
        amount: price * 100, // Paystack expects amount in kobo
        metadata: { userId, planId, billingPeriod: plan.billingPeriod }
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data.status) {
      res.json({
        message: 'Payment initiated successfully',
        authorizationUrl: response.data.data.authorization_url,
        reference: response.data.data.reference
      });
    } else {
      console.error('Paystack API error:', response.data.message);
      res.status(500).json({ error: 'Failed to initiate payment', details: response.data.message });
    }
  } catch (error) {
    console.error('Error initiating payment:', error.message, error.stack);
    res.status(500).json({ error: 'Failed to initiate payment', details: error.message });
  }
});

// Webhook Handler
router.post('/webhook', verifyPaystackWebhook, async (req, res) => {
  try {
    const event = req.body;
    console.log('Received Paystack webhook:', event);

    if (event.event === 'charge.success') {
      const { email, metadata } = event.data;
      const { userId, planId, billingPeriod } = metadata;

      if (!userId || !planId || !billingPeriod) {
        console.error('Missing metadata in webhook:', { userId, planId, billingPeriod });
        return res.status(400).json({ error: 'Missing metadata in webhook' });
      }

      const users = await loadUsers();
      const user = users.find(u => u.id === userId && u.email === email);
      if (!user) {
        console.error('User not found for webhook:', { userId, email });
        return res.status(404).json({ error: 'User not found' });
      }

      const subscriptions = await loadSubscriptions();
      const existingSubscription = subscriptions.find(s => s.userId === userId);

      const startDate = new Date();
      let endDate;
      switch (billingPeriod) {
        case 'weekly':
          endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
          break;
        case 'monthly':
          endDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          console.error('Invalid billing period:', billingPeriod);
          return res.status(400).json({ error: 'Invalid billing period' });
      }

      const subscription = {
        userId,
        email,
        planId,
        billingPeriod,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      };

      if (existingSubscription) {
        // Update existing subscription
        const index = subscriptions.findIndex(s => s.userId === userId);
        subscriptions[index] = subscription;
        console.log(`Updated subscription for user ${userId}`);
      } else {
        // Add new subscription
        subscriptions.push(subscription);
        console.log(`Created new subscription for user ${userId}`);
      }

      await saveSubscriptions(subscriptions);
      res.status(200).json({ message: 'Webhook processed successfully' });
    } else {
      console.log('Ignored webhook event:', event.event);
      res.status(200).json({ message: 'Webhook received but not processed' });
    }
  } catch (error) {
    console.error('Error processing webhook:', error.message, error.stack);
    res.status(500).json({ error: 'Failed to process webhook', details: error.message });
  }
});

// Get Subscription Status
router.get('/status', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const subscriptions = await loadSubscriptions();
    const subscription = subscriptions.find(s => s.userId === userId);

    if (!subscription) {
      return res.json({ status: 'inactive', message: 'No active subscription found' });
    }

    const now = new Date();
    const isActive = new Date(subscription.startDate) <= now && new Date(subscription.endDate) >= now;

    res.json({
      status: isActive ? 'active' : 'inactive',
      subscription: isActive ? subscription : null,
      message: isActive ? 'Active subscription found' : 'Subscription expired or inactive'
    });
  } catch (error) {
    console.error('Error fetching subscription status:', error.message, error.stack);
    res.status(500).json({ error: 'Failed to fetch subscription status', details: error.message });
  }
});

// Admin Route: Get All Subscriptions
router.get('/subscriptions', verifyAdminPassword, async (req, res) => {
  try {
    const subscriptions = await loadSubscriptions();
    res.json({ subscriptions });
  } catch (error) {
    console.error('Error fetching all subscriptions:', error.message, error.stack);
    res.status(500).json({ error: 'Failed to fetch subscriptions', details: error.message });
  }
});

module.exports = router;
