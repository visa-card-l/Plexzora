const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY || 'your-secret-key'; // Replace with a secure key in production

// Middleware
app.use(express.json());
app.use(cors({ origin: 'https://plexzora.onrender.com', credentials: true }));
app.use(express.static(path.join(__dirname, 'public')));

// In-memory storage (loaded from/saved to JSON files)
let formConfigs = {};
let users = {};

// File paths for persistent storage
const FORM_CONFIGS_FILE = path.join(__dirname, 'formConfigs.json');
const USERS_FILE = path.join(__dirname, 'users.json');

// Load data from files on startup
async function loadData() {
  try {
    const formData = await fs.readFile(FORM_CONFIGS_FILE, 'utf8');
    formConfigs = JSON.parse(formData) || {};
    console.log('Loaded formConfigs from file');
  } catch (error) {
    console.error('Error loading formConfigs:', error.message);
    formConfigs = {};
  }

  try {
    const userData = await fs.readFile(USERS_FILE, 'utf8');
    users = JSON.parse(userData) || {};
    console.log('Loaded users from file');
  } catch (error) {
    console.error('Error loading users:', error.message);
    users = {};
  }
}

// Save formConfigs to file
async function saveFormConfigs() {
  try {
    await fs.writeFile(FORM_CONFIGS_FILE, JSON.stringify(formConfigs, null, 2));
    console.log('Saved formConfigs to file');
  } catch (error) {
    console.error('Error saving formConfigs:', error.message);
    throw error;
  }
}

// Save users to file
async function saveUsers() {
  try {
    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
    console.log('Saved users to file');
  } catch (error) {
    console.error('Error saving users:', error.message);
    throw error;
  }
}

// Normalize URL function
function normalizeUrl(url) {
  if (!url) return null;
  if (url.match(/^https?:\/\//)) return url;
  if (url.match(/\.[a-z]{2,}$/i)) return `https://${url}`;
  return null;
}

// JWT verification middleware
function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded;
    next();
  } catch (error)
