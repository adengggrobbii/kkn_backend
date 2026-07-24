const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');

// Load environment variables
dotenv.config();

const seedAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected for seeding...');

    // Check if any admin exists
    const adminCount = await User.countDocuments({ role: 'admin' });
    if (adminCount > 0) {
      console.log('Admin account already exists in database. Seeding skipped.');
      process.exit(0);
    }

    // Create default admin
    const defaultAdmin = new User({
      username: 'admin',
      email: 'admin@kkn.ac.id',
      password: 'adminpassword123', // Will be hashed automatically by User model pre-save hook
      role: 'admin',
    });

    await defaultAdmin.save();

    console.log('==================================================');
    console.log('SEED DATA BERHASIL!');
    console.log('Akun Admin Default telah berhasil dibuat:');
    console.log('Email:    admin@kkn.ac.id');
    console.log('Password: adminpassword123');
    console.log('Silakan gunakan akun ini untuk masuk ke Portal Admin.');
    console.log('==================================================');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error.message);
    process.exit(1);
  }
};

seedAdmin();
