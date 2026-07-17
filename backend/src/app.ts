import express from 'express';
import cors from 'cors';
import { ForecastController } from './controllers/forecast.controller.js';
import { RecommendationController } from './controllers/recommendation.controller.js';
import { BrokerController, CropController } from './controllers/misc.controller.js';

const app = express();

app.use(cors());
app.use(express.json());

const forecastController = new ForecastController();
const recommendationController = new RecommendationController();
const brokerController = new BrokerController();
const cropController = new CropController();

// Forecast Routes
app.get('/api/forecast/latest', forecastController.getLatest);
app.get('/api/forecast/all-latest', forecastController.getAllLatest);
app.get('/api/forecast/commodities', forecastController.getCommodities);
app.get('/api/forecast/markets', forecastController.getMarkets);
app.get('/api/forecast/locations', forecastController.getLocations);
app.get('/api/forecast/history', forecastController.getHistory);

// Recommendation Routes
app.get('/api/recommendations', recommendationController.getRecommendations);
app.get('/api/analysis', recommendationController.getMarketAnalysis);

// Misc Routes
app.get('/api/brokers', brokerController.getAll);
app.get('/api/brokers/:id', brokerController.getById);
app.get('/api/crops', cropController.getAll);

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

export default app;
