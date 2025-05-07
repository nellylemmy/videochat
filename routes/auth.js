const express = require('express');
const { signup, verifyEmail, login } = require('../controllers/authController');
const router = express.Router();
const pool = require('../db');

router.post('/signup', signup);
router.post('/login', login);
// router.get('/verify-email/:token', verifyEmail); 

router.get('/verify-email/:token', async (req, res) => {
    const { token } = req.params;
    console.log(`📩 Incoming verification for token: ${token}`);
  
    try {
      const result = await pool.query(
        `SELECT * FROM email_verifications WHERE token = $1 AND expires_at > NOW()`,
        [token]
      );
  
      if (result.rows.length === 0) {
        console.warn('⚠️ Invalid or expired token');
        return res.status(400).json({ error: 'Invalid or expired token' });
      }
  
      const userId = result.rows[0].user_id;
      console.log(`🔐 Verifying user ID: ${userId}`);
  
      const updateRes = await pool.query(
        `UPDATE users SET email_verified = true WHERE id = $1 RETURNING id`,
        [userId]
      );
  
      if (updateRes.rowCount === 0) {
        console.error('❌ Failed to update email_verified field');
        return res.status(500).json({ error: 'Failed to update user verification status' });
      }
  
      const deleteRes = await pool.query(
        `DELETE FROM email_verifications WHERE user_id = $1`,
        [userId]
      );
  
      console.log(`✅ Email verified. Deleted token for user ${userId}`);
      res.json({ success: true, message: 'Email verified successfully!' });
    } catch (err) {
      console.error('❌ Email verification error:', {
        message: err.message,
        stack: err.stack,
        code: err.code,
        detail: err.detail,
      });
      res.status(500).json({ error: 'Server error during verification' });
    }
  });

module.exports = router;
