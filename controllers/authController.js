const pool = require('../db');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const { sendVerificationEmail } = require('../utils/mailer');

exports.signup = async (req, res) => {
    const {
      name,
      email,
      password,
      role,
      phone_number,
      age,
      bio,
      country,
      class_level,
      profile_picture_url,
      parent_email,
      parent_phone,
    } = req.body;
  
    console.log('📥 Signup attempt from:', email);
  
    // Basic validation
    if (!name || !email || !password || !role || !phone_number) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
  
    if (!['volunteer', 'student'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
  
    try {
      // Check for existing email
      const existing = await pool.query(`SELECT id FROM users WHERE email = $1`, [email]);
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'Email already in use' });
      }
  
      const hashed = await bcrypt.hash(password, 10);
      const userId = uuidv4();
  
      // Insert into users
      await pool.query(`
        INSERT INTO users (id, name, email, password_hash, phone_number, role, profile_picture_url)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [userId, name, email, hashed, phone_number, role, profile_picture_url || null]);
  
      console.log('✅ User inserted:', userId);
  
      // Role-based inserts
      if (role === 'volunteer') {
        if (!age) return res.status(400).json({ error: 'Age is required for volunteers' });
  
        if (parseInt(age) < 18) {
          if (!parent_email || !parent_phone) {
            return res.status(400).json({ error: 'Underage volunteers must provide parent contact' });
          }
        }
  
        await pool.query(`
          INSERT INTO volunteer_profiles (user_id, age, country, bio, parent_email, parent_phone)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          userId,
          age,
          country || null,
          bio || null,
          parent_email || null,
          parent_phone || null
        ]);
  
        console.log('📘 Volunteer profile created');
  
      } else {
        await pool.query(`
          INSERT INTO student_profiles (user_id, class_level, bio)
          VALUES ($1, $2, $3)
        `, [userId, class_level || null, bio || null]);
  
        console.log('📗 Student profile created');
      }
  
      // Email verification
      const token = uuidv4();
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour
  
      await pool.query(`
        INSERT INTO email_verifications (user_id, token, expires_at)
        VALUES ($1, $2, $3)
      `, [userId, token, expiresAt]);
  
      console.log('✉️ Email verification token created');
  
      await sendVerificationEmail(email, token);
      console.log('✅ Verification email sent');
  
      return res.status(201).json({
        message: 'Signup successful. Check your email to verify your account.'
      });
  
    } catch (err) {
      console.error('❌ Signup error:', err.message, err.stack);

  
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Account already exists' });
      }
  
      return res.status(500).json({ error: 'Internal server error' });
    }
  };

  exports.verifyEmail = async (req, res) => {
    const { token } = req.params;
  
    try {
      const result = await pool.query(
        `SELECT * FROM email_verifications WHERE token = $1 AND expires_at > NOW()`,
        [token]
      );
  
      if (result.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid or expired token' });
      }
  
      const userId = result.rows[0].user_id;
  
      await pool.query(`UPDATE users SET is_verified = true WHERE id = $1`, [userId]);
      await pool.query(`DELETE FROM email_verifications WHERE user_id = $1`, [userId]);
  
      res.json({ success: true, message: 'Email verified successfully!' });
    } catch (err) {
      console.error('Email verification error:', err);
      res.status(500).json({ error: 'Server error during verification' });
    }
  };
  
  


  exports.login = async (req, res) => {
    const { email, password } = req.body;
  
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password are required.' });
  
    try {
      const userResult = await pool.query(
        'SELECT * FROM users WHERE email = $1',
        [email]
      );
  
      if (userResult.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }
  
      const user = userResult.rows[0];
  
      const validPassword = await bcrypt.compare(password, user.password_hash);
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }
  
      if (!user.is_verified) {
        return res.status(403).json({ error: 'Please verify your email first.' });
      }
  
      const token = jwt.sign(
        {
          id: user.id,
          role: user.role,
          email: user.email,
          name: user.name,
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
  
      res.json({
        token,
        user: {
          id: user.id,
          role: user.role,
          name: user.name,
          email: user.email,
          profile_picture_url: user.profile_picture_url,
        }
      });
  
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
  