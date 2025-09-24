const express = require('express');
const router = express.Router();
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

// Environment variables
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const DATA_DIR = process.env.DATA_DIR || './data';
const SUBSCRIPTIONS_FILE = path.join(DATA_DIR, 'subscriptions.json');

// Middleware to authenticate JWT (assuming it's defined in server.js and passed to router)
const authenticateToken = require('../middleware/auth'); // Adjust path as needed

// Ensure subscriptions.json exists
async function ensureSubscriptionsFile() {
  try {
    await fs.access(SUBSCRIPTIONS_FILE);
    console.log('subscriptions.json exists');
  } catch (error) {
    console.log('Creating subscriptions.json');
    await fs.writeFile(SUBSCRIPTIONS_FILE, JSON.stringify([]));
  }
}

// Validate plan
const allowedPlans = ['premium-weekly', 'premium-monthly'];
function isValidPlan(planId) {
  return allowedPlans.includes(planId);
}

// Initiate payment
router.post('/initiate-payment', authenticateToken, async (req, res) => {
  const { planId, email, price } = req.body;
  const userId = req.user.id; // From JWT

  console.log(`Received payment initiation request: userId=${userId}, planId=${planId}, email=${email}, price=${price}`);

  try {
    // Validate request
    if (!planId || !email || !price) {
      console.error('Validation failed: Missing required fields');
      return res.status(400).json({ error: 'Missing required fields: planId, email, and price are required' });
    }

    if (!isValidPlan(planId)) {
      console.error(`Validation failed: Invalid planId: ${planId}`);
      return res.status(400).json({ error: `Invalid planId. Must be one of: ${allowedPlans.join(', ')}` });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      console.error('Validation failed: Invalid email format');
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (!Number.isInteger(price) || price <= 0) {
      console.error('Validation failed: Invalid price');
      return res.status(400).json({ error: 'Price must be a positive integer' });
    }

    // Ensure subscriptions.json exists
    await ensureSubscriptionsFile();

    // Initialize Paystack transaction
    console.log('Making Paystack API request to /transaction/initialize');
    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email,
        amount: price, // In kobo
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

    console.log('Paystack response:', response.data);

    if (!response.data.status || !response.data.data.authorization_url || !response.data.data.reference) {
      console.error('Paystack response missing required fields:', response.data);
      return res.status(500).json({ error: 'Failed to initialize payment with Paystack' });
    }

    const { authorization_url: authorizationUrl, reference } = response.data.data;

    // Store subscription (pending status)
    const subscriptions = JSON.parse(await fs.readFile(SUBSCRIPTIONS_FILE, 'utf8'));
    const subscription = {
      userId,
      email,
      planId,
      billingPeriod: planId === 'premium-weekly' ? 'weekly' : 'monthly',
      reference,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    subscriptions.push(subscription);
    console.log('Saving subscription:', subscription);
    await fs.writeFile(SUBSCRIPTIONS_FILE, JSON.stringify(subscriptions, null, 2));

    res.json({
      message: 'Payment initiated successfully',
      authorizationUrl,
      reference
    });
  } catch (error) {
    console.error('Error in /api/subscription/initiate-payment:', {
      message: error.message,
      stack: error.stack,
      axiosError: error.response ? {
        status: error.response.status,
        data: error.response.data
      } : null
    });
    res.status(500).json({ error: 'Failed to initiate payment' });
  }
});

// Webhook for Paystack (simplified example)
router.post('/webhook', async (req, res) => {
  console.log('Webhook received:', req.body);

  try {
    const event = req.body;
    if (event.event === 'charge.success') {
      const { reference, metadata, status } = event.data;
      const { userId, planId, billingPeriod } = metadata;

      console.log(`Processing webhook: reference=${reference}, userId=${userId}, planId=${planId}, status=${status}`);

      const subscriptions = JSON.parse(await fs.readFile(SUBSCRIPTIONS_FILE, 'utf8'));
      const subscription = subscriptions.find(sub => sub.reference === reference);

      if (!subscription) {
        console.error(`Webhook error: Subscription not found for reference ${reference}`);
        return res.status(404).json({ error: 'Subscription not found' });
      }

      subscription.status = 'active';
      subscription.startDate = new Date().toISOString();
      subscription.endDate = new Date(
        Date.now() + (billingPeriod === 'weekly' ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000)
      ).toISOString();

      console.log('Updating subscription:', subscription);
      await fs.writeFile(SUBSCRIPTIONS_FILE, JSON.stringify(subscriptions, null, 2));
      res.status(200).json({ message: 'Webhook processed successfully' });
    } else {
      console.log('Webhook ignored: Not a charge.success event');
      res.status(200).json({ message: 'Event ignored' });
    }
  } catch (error) {
    console.error('Webhook error:', error.message);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

module.exports = router;
