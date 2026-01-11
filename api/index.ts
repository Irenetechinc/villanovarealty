import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import adroomRouter from './routes/adroom.js';
import analyticsRouter from './routes/analytics.js';
import authRouter from './routes/auth.js';
import propertiesRouter from './routes/properties.js';
import walletRouter from './routes/wallet.js';
import { automation } from './cron.js';
import { botService } from './services/botService.js';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

automation.start();
botService.start();

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/properties', propertiesRouter);
app.use('/api/auth', authRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/adroom', adroomRouter);
app.use('/api/wallet', walletRouter);

// Serve Static Frontend (Production)
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../dist');
  app.use(express.static(distPath));

  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Villanova Realty API is running' });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`AdRoom Autonomous System v2.0 - Active`);
});
