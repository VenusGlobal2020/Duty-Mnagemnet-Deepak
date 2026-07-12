require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Rank = require('../models/Rank');

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Check if master exists
    const existing = await User.findOne({ role: 'master' });
    if (existing) {
      console.log('⚠️  Master already exists:', existing.email);
      process.exit(0);
    }

    // Create master
    const master = await User.create({
      name: 'Super Tech Master',
      email: 'master@supertech.com',
      phone: '9000000000',
      password: 'supertech@1978@',
      gender: 'male',
      dateOfBirth: new Date('1990-01-01'),
      role: 'master',
      status: 'active'
    });
    console.log('✅ Master created:', master.email, '| Password: supertech@1978@');

    // Create default ranks
    const defaultRanks = [
      { name: 'DSP',       code: 'A', priority: 1, color: '#D97706' },
      { name: 'Inspector', code: 'B', priority: 2, color: '#65A30D' },
      { name: 'SI',        code: 'C', priority: 3, color: '#0891B2' },
      { name: 'Head Constable', code: 'D', priority: 4, color: '#7C3AED' },
      { name: 'Constable', code: 'E', priority: 5, color: '#6B7280' },
    ];

    for (const rank of defaultRanks) {
      const exists = await Rank.findOne({ code: rank.code });
      if (!exists) {
        await Rank.create({ ...rank, createdBy: master._id });
        console.log(`✅ Rank created: ${rank.name} (${rank.code})`);
      }
    }

    console.log('\n🎉 Seed completed successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Master Login:');
    console.log('  Email   : master@supertech.com');
    console.log('  Password: supertech@1978@');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed error:', error);
    process.exit(1);
  }
};

seed();
