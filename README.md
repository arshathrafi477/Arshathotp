# OTP Backend — Email Verification

A simple Node.js backend that sends and verifies email OTPs using Express + Nodemailer.

---

## Project structure

```
otp-backend/
├── server.js      ← Express backend (send / verify / resend OTP)
├── index.html     ← Frontend demo page
├── package.json
├── .env           ← Your SMTP credentials (never commit this)
└── .gitignore
```

---

## Local setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure `.env`

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your_16_char_app_password
PORT=3000
```

**How to get a Gmail App Password:**
1. Go to https://myaccount.google.com/security
2. Enable 2-Step Verification
3. Search "App passwords" → create one for Mail
4. Paste the 16-character password (no spaces) into `SMTP_PASS`

### 3. Run the server

```bash
npm start
```

Open `index.html` in your browser. The API runs at `http://localhost:3000`.

---

## API endpoints

| Method | Route         | Body                    | Response                   |
|--------|---------------|-------------------------|----------------------------|
| POST   | `/send-otp`   | `{ email }`             | `{ message }` or `{ error }` |
| POST   | `/verify-otp` | `{ email, otp }`        | `{ message }` or `{ error }` |
| POST   | `/resend-otp` | `{ email }`             | `{ message }` or `{ error }` |
| GET    | `/`           | —                       | health check               |

---

## Deploy to Render

1. Push your project to GitHub (**without** `.env` — it's in `.gitignore`)
2. Go to https://render.com → New → Web Service
3. Connect your GitHub repo
4. Set these in Render dashboard:

| Setting       | Value         |
|---------------|---------------|
| Build Command | `npm install` |
| Start Command | `npm start`   |
| Environment   | Node          |

5. Add Environment Variables in Render (same as your `.env` values)
6. After deploy, copy your Render URL and update `index.html`:
   ```js
   const API = "https://your-app.onrender.com";
   ```

---

## OTP rules

- OTP is **6 digits**, randomly generated
- Expires in **5 minutes**
- Max **5 wrong attempts** before OTP is invalidated
- Resend available every **30 seconds** (frontend enforced)
"# Arshathotp" 
