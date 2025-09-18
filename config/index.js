const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const config = {
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/plexzora',
  PORT: process.env.PORT || 3000,
  JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key-here',
  ADMIN_PASSWORD_HASH: require('bcryptjs').hashSync('midas', 10),
};

module.exports.connectDB = async () => {
  try {
    await mongoose.connect(config.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

module.exports = config;
