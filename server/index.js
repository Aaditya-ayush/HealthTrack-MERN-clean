import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from './routes/auth.js';
import recordRoutes from './routes/records.js';
import reminderRoutes from './routes/reminders.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = Number(process.env.PORT || 5000);
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/healthtrack';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('Configuration error: set JWT_SECRET to 32+ characters in server/.env');
  process.exit(1);
}

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'HealthTrack API' });
});
app.use('/api/auth', authRoutes);
app.use('/api/records', recordRoutes);
app.use('/api/reminders', reminderRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Unexpected server error' });
});

async function start() {
  try {
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
    console.log('MongoDB connected');
    app.listen(PORT, () => console.log(`HealthTrack API ready at http://localhost:${PORT}`));
  } catch (error) {
    console.error(`MongoDB connection failed: ${error.message}`);
    console.error('Check that MongoDB is installed/running and MONGODB_URI in server/.env is correct.');
    process.exit(1);
  }
}
start();
