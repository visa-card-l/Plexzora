const mongoose = require('mongoose');

const formConfigSchema = new mongoose.Schema({
  formId: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  template: { type: String, default: 'sign-in' },
  headerText: { type: String, default: 'My Form' },
  headerColors: { type: [String], default: [] },
  subheaderText: { type: String, default: 'Fill the form' },
  subheaderColor: { type: String, default: '#555555' },
  placeholders: [{
    id: String,
    placeholder: String
  }],
  borderShadow: { type: String, default: '0 0 0 2px #000000' },
  buttonColor: { type: String, default: 'linear-gradient(45deg, #00b7ff, #0078ff)' },
  buttonTextColor: { type: String, default: '#ffffff' },
  buttonText: { type: String, default: 'Sign In' },
  buttonAction: { type: String, enum: ['url', 'message'], default: 'url' },
  buttonUrl: { type: String, default: '' },
  buttonMessage: { type: String, default: '' },
  theme: { type: String, enum: ['light', 'dark'], default: 'light' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date },
  expiresAt: { type: Date },
});

module.exports = mongoose.model('FormConfig', formConfigSchema);
