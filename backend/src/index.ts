import app from './app.js';
import dotenv from 'dotenv';
import { initializeForecastIndex } from './lib/csvForecastIndex.js';

dotenv.config();

const PORT = process.env.PORT || 3001;

// The CSV index build is synchronous and can briefly block the event loop,
// so it runs from the listen callback rather than before it: the port opens
// first (so the process is reachable as early as possible), then
// initialization runs. Forecast/recommendation routes stay gated by
// requireForecastIndexReady (app.ts) the entire time; only GET /ready and
// GET /health respond during that window once the event loop is free.
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  initializeForecastIndex();
});
