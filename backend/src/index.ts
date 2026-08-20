// Must run before any other local import: ES module imports are evaluated
// in the order they're written, so if this came after `import app from
// './app.js'`, app.js's transitive import of lib/prisma.ts would construct
// PrismaClient before DATABASE_URL was loaded into process.env — which is
// exactly what caused every Prisma-backed request (signup, login, farms) to
// fail with "Environment variable not found: DATABASE_URL" while env-free
// routes (forecast CSV lookups) kept working fine.
import 'dotenv/config';

import app from './app.js';
import { initializeForecastRepository } from './repositories/forecastRepositoryFactory.js';

const PORT = process.env.PORT || 3001;

// Repository initialization (CSV index build, or a Postgres connection
// check) runs from the listen callback rather than before it: the port
// opens first (so the process is reachable as early as possible), then
// initialization runs. Forecast/recommendation routes stay gated by
// requireForecastRepositoryReady (app.ts) the entire time; only GET /ready
// and GET /health respond during that window.
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  void initializeForecastRepository();
});
