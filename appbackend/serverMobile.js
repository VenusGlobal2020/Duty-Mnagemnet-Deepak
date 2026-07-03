require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

//const { startDutyStatusCron } = require('../backend/jobs/dutyStatusCron');

const app = express();

app.use(helmet());

app.use(cors({
  origin: [process.env.FRONTEND_URL, 'http://localhost:5173', 'exp://localhost'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// health
app.get('/api/mobile/health', (req, res) => {
  res.json({ success: true, message: 'Mobile backend running', timestamp: new Date() });
});

// Routes
const appRoutes = require('./appRoutes');
app.use('/api/mobile', appRoutes);

// Error middleware
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ success: false, message: err?.message || 'Internal server error' });
});

const PORT = process.env.MOBILE_PORT || 5001;

// Allow running without DB during integration/testing.
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.warn('⚠️ MONGO_URI not set; mobile backend starting without MongoDB connection.');
  app.listen(PORT, () => console.log(`🚀 Mobile backend running on port ${PORT} (no DB)`));
} else {
  mongoose
    .connect(MONGO_URI)

  .then(() => {
    console.log('✅ MongoDB connected (mobile backend)');
    app.listen(PORT, () => console.log(`🚀 Mobile backend running on port ${PORT}`));
    // Keep same cron behavior as main backend (safe if already exists)
    //if (startDutyStatusCron) startDutyStatusCron();
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error (mobile backend):', err);
    process.exit(1);
  });
}


