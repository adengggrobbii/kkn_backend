const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');

// Lokasi penyimpanan user lokal (fallback jika MongoDB offline)
const dataDir = path.join(__dirname, '../data');
const localUsersFile = path.join(dataDir, 'users.json');

const ensureLocalUsers = () => {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(localUsersFile)) {
    // Default admin fallback
    const defaultUsers = [
      {
        _id: '65a000000000000000000001',
        username: 'admin',
        email: 'admin@kkn.ac.id',
        password: '$2a$10$gg3obmaUDNvmOUQNfCrhi.Y248D6XcaSDhEnabj3hOthlRlao9bH2', // adminpassword123
        role: 'admin',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    fs.writeFileSync(localUsersFile, JSON.stringify(defaultUsers, null, 2), 'utf-8');
  }
};

const readLocalUsers = () => {
  try {
    ensureLocalUsers();
    const raw = fs.readFileSync(localUsersFile, 'utf-8');
    return JSON.parse(raw || '[]');
  } catch (err) {
    console.error('Error reading local users.json:', err);
    return [];
  }
};

const writeLocalUsers = (users) => {
  try {
    ensureLocalUsers();
    fs.writeFileSync(localUsersFile, JSON.stringify(users, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing local users.json:', err);
  }
};

const isMongoConnected = () => mongoose.connection.readyState === 1;

// Helper to generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'fallback_secret_kkn_123', {
    expiresIn: '30d',
  });
};

// @desc    Register a new admin
// @route   POST /api/auth/register
// @access  Public
const registerAdmin = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: 'Semua field wajib diisi' });
    }

    let user = null;

    if (isMongoConnected()) {
      try {
        const userExists = await User.findOne({ $or: [{ email }, { username }] });
        if (userExists) {
          return res.status(400).json({ success: false, message: 'Username atau Email sudah terdaftar' });
        }
        user = await User.create({ username, email, password });
      } catch (dbErr) {
        console.warn('MongoDB register error, using local fallback:', dbErr.message);
      }
    }

    if (!user) {
      const localUsers = readLocalUsers();
      const exists = localUsers.some(
        (u) => u.email.toLowerCase() === email.toLowerCase() || u.username.toLowerCase() === username.toLowerCase()
      );
      if (exists) {
        return res.status(400).json({ success: false, message: 'Username atau Email sudah terdaftar' });
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      user = {
        _id: new mongoose.Types.ObjectId().toString(),
        username,
        email: email.toLowerCase(),
        password: hashedPassword,
        role: 'admin',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      localUsers.push(user);
      writeLocalUsers(localUsers);
    }

    res.status(201).json({
      success: true,
      data: {
        _id: user._id || user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        token: generateToken(user._id || user.id),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error: ' + error.message });
  }
};

// @desc    Authenticate admin user
// @route   POST /api/auth/login
// @access  Public
const loginAdmin = async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body;

    if (!emailOrUsername || !password) {
      return res.status(400).json({ success: false, message: 'Email/Username dan password wajib diisi' });
    }

    const inputLower = emailOrUsername.toLowerCase().trim();
    let matchedUser = null;

    // 1. Coba lewat MongoDB jika terhubung
    if (isMongoConnected()) {
      try {
        const user = await User.findOne({
          $or: [{ email: inputLower }, { username: emailOrUsername.trim() }],
        });
        if (user && (await user.matchPassword(password))) {
          matchedUser = user;
        }
      } catch (dbErr) {
        console.warn('MongoDB findOne error, falling back to local storage:', dbErr.message);
      }
    }

    // 2. Fallback ke users lokal jika MongoDB tidak aktif atau tidak ditemukan
    if (!matchedUser) {
      const localUsers = readLocalUsers();
      const localFound = localUsers.find(
        (u) =>
          u.email.toLowerCase() === inputLower ||
          u.username.toLowerCase() === inputLower ||
          u.username === emailOrUsername.trim()
      );

      if (localFound) {
        const isMatch = await bcrypt.compare(password, localFound.password);
        if (isMatch) {
          matchedUser = localFound;
        }
      }
    }

    if (matchedUser) {
      const userId = matchedUser._id || matchedUser.id;
      return res.json({
        success: true,
        data: {
          _id: userId,
          username: matchedUser.username,
          email: matchedUser.email,
          role: matchedUser.role || 'admin',
          token: generateToken(userId),
        },
      });
    }

    return res.status(401).json({ success: false, message: 'Username/Email atau Password salah' });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server Error: ' + error.message });
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    if (isMongoConnected()) {
      try {
        const user = await User.findById(req.user.id || req.user._id).select('-password');
        if (user) return res.json({ success: true, data: user });
      } catch (dbErr) {
        console.warn('MongoDB getMe error:', dbErr.message);
      }
    }

    const localUsers = readLocalUsers();
    const found = localUsers.find((u) => String(u._id) === String(req.user.id || req.user._id));
    if (found) {
      const { password, ...clean } = found;
      return res.json({ success: true, data: clean });
    }

    res.json({ success: true, data: req.user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error: ' + error.message });
  }
};

module.exports = {
  registerAdmin,
  loginAdmin,
  getMe,
  readLocalUsers,
};
