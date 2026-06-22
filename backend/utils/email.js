const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

const sendOTPEmail = async (email, name, otp) => {
  try {
    await transporter.sendMail({
      from: `"Duty Management System" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Password Reset OTP - Duty Management System',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9fafb;padding:20px;border-radius:8px">
          <h2 style="color:#1e40af">Password Reset Request</h2>
          <p>Hello <strong>${name}</strong>,</p>
          <p>Your OTP for password reset is:</p>
          <div style="background:#1e40af;color:#fff;font-size:32px;font-weight:bold;text-align:center;padding:20px;border-radius:8px;letter-spacing:8px;">${otp}</div>
          <p style="color:#6b7280;margin-top:16px">This OTP is valid for <strong>10 minutes</strong>.</p>
          <p style="color:#ef4444">If you did not request this, please ignore this email and your account will remain secure.</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0"/>
          <p style="color:#9ca3af;font-size:12px">Duty Management System - Confidential</p>
        </div>
      `
    });
    return { success: true };
  } catch (error) {
    console.error('Email send error:', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = { sendOTPEmail };
