# HealthTrack — clean MERN starter

A compact full-stack personal health tracker with:
- React + Vite frontend
- Express API + MongoDB (Mongoose)
- Account registration and login (bcrypt password hashes, JWT)
- Phone OTP verification (development OTP or Twilio Verify)
- Health records with PDF/PNG/JPG upload
- Reminders: once, every 6 months, or yearly
- Authenticated API endpoints

## Requirements

Install:
1. Node.js 20 LTS or newer (includes npm)
2. MongoDB Community Server **or** MongoDB Atlas account
3. Optional: MongoDB Compass (GUI; not required by the app)

You do not need to install a separate npm package for MongoDB. `mongoose` is already in package.json. You do need a MongoDB server/Atlas database available.

## Setup (Windows / VS Code)

Open the project root folder in VS Code, then run:

```powershell
npm install
```

Copy `server/.env.example` to `server/.env`. Set `MONGODB_URI` to your local MongoDB URI or Atlas connection string. Set `JWT_SECRET` to a unique random secret of at least 32 characters. For local development, keep `DEV_OTP=true`.

### Local MongoDB

Install and start MongoDB Community Server. The default URI is:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/healthtrack
```

If MongoDB is installed as a Windows service, it is usually started by the installer. Check Windows Services for `MongoDB Server` if connection fails.

### MongoDB Atlas alternative

Create a cluster in MongoDB Atlas, add a database user, allow your IP in Network Access, and replace `MONGODB_URI` with the Atlas connection string. URL-encode special characters in the database user's password.

### Start everything

From the project root:

```powershell
npm start
```

This starts API on `http://localhost:5000` and Vite frontend on `http://localhost:5173`.

Or use two terminals:
```powershell
npm run server
```
```powershell
npm run dev
```

Check API health:
http://localhost:5000/api/health

## OTP

With `DEV_OTP=true`, click Send code and get the code from the backend terminal (also returned to the frontend only for local testing). This is not real SMS and must never be enabled in production.

For real SMS, set `DEV_OTP=false` and provide:
```env
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_VERIFY_SERVICE_SID=
```
Twilio Verify must be configured and the account permitted to send to the target number.

## Notes

- The project creates the `healthtrack` database and collections automatically on first successful write.
- Uploaded files are stored in `server/uploads`; records store metadata and path.
- Do not expose `.env`, development OTPs, or uploaded medical records publicly.
- This starter is for local development and learning, not a production medical-records system. Add rate limiting, audit logging, secure storage, backups, consent, and deployment hardening before real patient use.
