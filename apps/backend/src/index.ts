import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import routes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(
  cors({
    origin: [
      'http://localhost:3000',
      'https://solar-quotation-app.onrender.com',
      ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
    ],
    credentials: true,
  })
);
app.use(express.json());

app.use('/api', routes);

app.get('/', (_req, res) => {
  res.json({ message: 'Solar Quotation API', docs: '/api/health', version: '1.0' });
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use(errorHandler);

app.listen(config.port, async () => {
  console.log(`Backend running on http://localhost:${config.port}`);
  try {
    const { ensureDefaultTemplates } = await import('./services/default-templates.service.js');
    await ensureDefaultTemplates();
  } catch (err) {
    console.error('[Default Templates] Failed to ensure default templates:', err);
  }
});
