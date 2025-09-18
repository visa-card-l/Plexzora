const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const formController = require('../controllers/formController');
const { verifyToken, verifyAdminPassword } = require('../middleware/index');

router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.get('/user', verifyToken, authController.getUser);
router.post('/create', verifyToken, formController.createForm);
router.put('/api/form/:id', verifyToken, formController.updateForm);
router.post('/form/:id/submit', formController.submitForm);
router.delete('/form/:id/submission/:index', verifyToken, formController.deleteSubmission);
router.delete('/form/:id', verifyToken, formController.deleteForm);
router.get('/form/:id', formController.renderForm);
router.get('/api/form/:id', verifyToken, formController.getForm);
router.get('/submissions', verifyToken, formController.getSubmissions);
router.get('/admin', formController.renderAdmin);
router.post('/admin/settings', verifyAdminPassword, formController.updateAdminSettings);

module.exports = router;
