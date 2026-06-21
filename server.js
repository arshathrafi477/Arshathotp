require("dotenv").config();
const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
app.use(cors());
app.use(express.json());

// ─── In-memory OTP store ───────────────────────────────────────────────────
// Structure: { email: { otp, expiresAt, attempts } }
const otpStore = new Map();

const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS  = 5;              // max wrong guesses before lockout

// ─── Nodemailer transporter ────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === "true", // true for port 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Verify SMTP connection on startup
transporter.verify((err) => {
  if (err) {
    console.error("❌ SMTP connection failed:", err.message);
  } else {
    console.log("✅ SMTP server is ready to send emails");
  }
});

// ─── Helper: generate a 6-digit OTP ───────────────────────────────────────
function generateOTP() {
  return crypto.randomInt(100000, 999999).toString();
}

// ─── Helper: basic email format check ─────────────────────────────────────
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ─── POST /send-otp ────────────────────────────────────────────────────────
app.post("/send-otp", async (req, res) => {
  const { email } = req.body;

  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ success: false, message: "Valid email is required." });
  }

  const otp       = generateOTP();
  const expiresAt = Date.now() + OTP_EXPIRY_MS;

  // Save OTP (overwrites any previous one for this email)
  otpStore.set(email.toLowerCase(), { otp, expiresAt, attempts: 0 });

  const mailOptions = {
    from:    `"OTP Service" <${process.env.SMTP_USER}>`,
    to:      email,
    subject: "Your One-Time Password (OTP)",
    text:    `Your OTP is: ${otp}\n\nIt expires in 5 minutes. Do not share it with anyone.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #e0e0e0;border-radius:8px;">
        <h2 style="color:#333;">Your One-Time Password</h2>
        <p style="font-size:14px;color:#555;">Use the OTP below to complete your verification. It expires in <strong>5 minutes</strong>.</p>
        <div style="text-align:center;margin:32px 0;">
          <span style="font-size:40px;font-weight:bold;letter-spacing:12px;color:#4f46e5;">${otp}</span>
        </div>
        <p style="font-size:12px;color:#999;">If you did not request this, please ignore this email.</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`📧 OTP sent to ${email}`);
    return res.json({ success: true, message: `OTP sent to ${email}.` });
  } catch (err) {
    console.error("Failed to send email:", err.message);
    return res.status(500).json({ success: false, message: "Failed to send OTP. Please try again." });
  }
});

// ─── POST /verify-otp ─────────────────────────────────────────────────────
app.post("/verify-otp", (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ success: false, message: "Email and OTP are required." });
  }

  const key    = email.toLowerCase();
  const record = otpStore.get(key);

  if (!record) {
    return res.status(400).json({ success: false, message: "No OTP found for this email. Please request a new one." });
  }

  // Expired?
  if (Date.now() > record.expiresAt) {
    otpStore.delete(key);
    return res.status(400).json({ success: false, message: "OTP has expired. Please request a new one." });
  }

  // Too many wrong attempts?
  if (record.attempts >= MAX_ATTEMPTS) {
    otpStore.delete(key);
    return res.status(429).json({ success: false, message: "Too many failed attempts. Please request a new OTP." });
  }

  // Wrong OTP?
  if (record.otp !== otp.toString().trim()) {
    record.attempts += 1;
    const remaining = MAX_ATTEMPTS - record.attempts;
    return res.status(400).json({
      success: false,
      message: `Incorrect OTP. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.`,
    });
  }

  // ✅ Correct!
  otpStore.delete(key); // one-time use
  console.log(`✅ OTP verified for ${email}`);
  return res.json({ success: true, message: "OTP verified successfully! You are now authenticated." });
});

// ─── GET /health ───────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── Start server ──────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 OTP server running on http://localhost:${PORT}`);
});
