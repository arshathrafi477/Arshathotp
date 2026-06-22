require("dotenv").config();
const express    = require("express");
const cors       = require("cors");
const crypto     = require("crypto");
const nodemailer = require("nodemailer");

const app = express();
app.use(cors());
app.use(express.json());

// ─── Gmail transporter ─────────────────────────────────────────────────────
// Uses Gmail service (not raw SMTP) — works on Render free tier!
const transporter = nodemailer.createTransport({
  service: "gmail",          // ← nodemailer knows Gmail's settings automatically
  auth: {
    user: process.env.GMAIL_USER,   // arshathrafi477@gmail.com
    pass: process.env.GMAIL_PASS,   // 16-char App Password (NOT your Gmail password)
  },
});

transporter.verify((err) => {
  if (err) console.error("❌ Gmail SMTP error:", err.message);
  else     console.log("✅ Gmail ready to send OTPs!");
});

// ─── OTP store ─────────────────────────────────────────────────────────────
const otpStore      = new Map();
const OTP_EXPIRY_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS  = 5;

function generateOTP()    { return crypto.randomInt(100000, 999999).toString(); }
function isValidEmail(e)  { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }

// ─── GET / ─────────────────────────────────────────────────────────────────
app.get("/", (_req, res) => {
  res.json({
    name: "Arshathotp API", status: "🟢 Live",
    endpoints: {
      sendOTP:   "POST /send-otp   → { email }",
      verifyOTP: "POST /verify-otp → { email, otp }",
    }
  });
});

// ─── GET /health ───────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── POST /send-otp ────────────────────────────────────────────────────────
app.post("/send-otp", async (req, res) => {
  const { email } = req.body;

  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ success: false, message: "Valid email is required." });
  }

  const otp       = generateOTP();
  const expiresAt = Date.now() + OTP_EXPIRY_MS;
  otpStore.set(email.toLowerCase(), { otp, expiresAt, attempts: 0 });

  try {
    await transporter.sendMail({
      from:    `"OTP Verify" <${process.env.GMAIL_USER}>`,  // arshathrafi477@gmail.com
      to:      email,                                        // user's email
      subject: "Your OTP Verification Code",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;
                    border:1px solid #e0e0e0;border-radius:12px;">
          <h2 style="color:#15803d;">🔐 OTP Verify</h2>
          <p style="color:#555;font-size:14px;">
            Use the code below to verify your email.<br/>
            It expires in <strong>5 minutes</strong>.
          </p>
          <div style="background:#f0fdf4;border:2px solid #15803d;border-radius:12px;
                      text-align:center;padding:24px;margin:24px 0;">
            <span style="font-size:44px;font-weight:bold;letter-spacing:16px;color:#15803d;">
              ${otp}
            </span>
          </div>
          <p style="font-size:12px;color:#9ca3af;">
            If you did not request this, ignore this email.
          </p>
        </div>
      `,
      text: `Your OTP is: ${otp}\n\nExpires in 5 minutes. Do not share it.`,
    });

    console.log(`📧 OTP sent: ${process.env.GMAIL_USER} → ${email}`);
    return res.json({ success: true, message: `OTP sent to ${email}!` });

  } catch (err) {
    console.error("❌ Send failed:", err.message);
    otpStore.delete(email.toLowerCase());
    return res.status(500).json({ success: false, message: "Failed to send OTP: " + err.message });
  }
});

// ─── POST /verify-otp ──────────────────────────────────────────────────────
app.post("/verify-otp", (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ success: false, message: "Email and OTP required." });
  }

  const key    = email.toLowerCase();
  const record = otpStore.get(key);

  if (!record) {
    return res.status(400).json({ success: false, message: "No OTP found. Request a new one." });
  }
  if (Date.now() > record.expiresAt) {
    otpStore.delete(key);
    return res.status(400).json({ success: false, message: "OTP expired. Request a new one." });
  }
  if (record.attempts >= MAX_ATTEMPTS) {
    otpStore.delete(key);
    return res.status(429).json({ success: false, message: "Too many attempts. Request a new OTP." });
  }
  if (record.otp !== otp.toString().trim()) {
    record.attempts += 1;
    const left = MAX_ATTEMPTS - record.attempts;
    return res.status(400).json({
      success: false,
      message: `Incorrect OTP. ${left} attempt${left !== 1 ? "s" : ""} remaining.`,
    });
  }

  otpStore.delete(key);
  console.log(`✅ Verified: ${email}`);
  return res.json({ success: true, message: "✅ Email verified successfully!" });
});

// ─── Start ─────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📧 Sending from: ${process.env.GMAIL_USER || "❌ GMAIL_USER not set"}`);
});
