const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('../config/index');

exports.verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Token verification error:', error.message);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

exports.verifyAdminPassword = (req, res, next) => {
  const { adminPassword } = req.body;
  if (!adminPassword || !bcrypt.compareSync(adminPassword, config.ADMIN_PASSWORD_HASH)) {
    return res.status(401).json({ error: 'Invalid admin password' });
  }
  next();
};

exports.errorHandler = (error, req, res, next) => {
  console.error('Error:', error.message, error.stack);
  res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
};
