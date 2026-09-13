const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const { readLocalUsers } = require('../controllers/authController');

const isMongoConnected = () => mongoose.connection.readyState === 1;

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_kkn_123');

      let user = null;

      // 1. Coba cari di MongoDB jika aktif
      if (isMongoConnected()) {
        try {
          user = await User.findById(decoded.id).select('-password');
        } catch (dbErr) {
          console.warn('MongoDB query user failed in auth middleware:', dbErr.message);
        }
      }

      // 2. Fallback cari di users.json
      if (!user) {
        const localUsers = readLocalUsers();
        const found = localUsers.find((u) => String(u._id) === String(decoded.id));
        if (found) {
          const { password, ...clean } = found;
          user = clean;
        }
      }

      if (!user) {
        return res.status(401).json({ success: false, message: 'Not authorized, user not found' });
      }

      req.user = user;
      return next();
    } catch (error) {
      console.error('Auth protect error:', error.message);
      return res.status(401).json({ success: false, message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token provided' });
  }
};

module.exports = { protect };
