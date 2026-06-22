const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

const hashOTP = async (otp) => {
  return bcrypt.hash(otp, 10);
};

const verifyOTP = async (otp, hashedOTP) => {
  return bcrypt.compare(otp, hashedOTP);
};

module.exports = { generateOTP, hashOTP, verifyOTP };
