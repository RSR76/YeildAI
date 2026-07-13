import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
const prisma = new PrismaClient();
async function main() {
    console.log('Starting seed...');
    // Seed Crops
    const crops = [
        { name: 'Tomato', category: 'Vegetable', typicalYield: 10, costOfCultivation: 15000, growthDuration: 90, bestSeason: 'Kharif' },
        { name: 'Onion', category: 'Vegetable', typicalYield: 12, costOfCultivation: 20000, growthDuration: 120, bestSeason: 'Rabi' },
        { name: 'Potato', category: 'Tuber', typicalYield: 15, costOfCultivation: 25000, growthDuration: 100, bestSeason: 'Rabi' },
        { name: 'Rice', category: 'Cereal', typicalYield: 20, costOfCultivation: 30000, growthDuration: 150, bestSeason: 'Kharif' },
        { name: 'Wheat', category: 'Cereal', typicalYield: 18, costOfCultivation: 28000, growthDuration: 120, bestSeason: 'Rabi' },
    ];
    console.log('Seeding crops...');
    for (const crop of crops) {
        await prisma.crop.upsert({
            where: { name: crop.name },
            update: {},
            create: crop,
        });
    }
    // Seed Brokers
    console.log('Seeding brokers...');
    await prisma.broker.createMany({
        data: [
            { name: 'AgriConnect Punjab', location: 'Ludhiana, Punjab', contact: '+91 9876543210', commodities: ['Wheat', 'Rice'], rating: 4.5, verified: true },
            { name: 'Krishi Mandi Hub', location: 'Nashik, Maharashtra', contact: '+91 8765432109', commodities: ['Onion', 'Tomato'], rating: 4.8, verified: true },
            { name: 'South Agro Traders', location: 'Kurnool, Andhra Pradesh', contact: '+91 7654321098', commodities: ['Chilli', 'Cotton'], rating: 4.2, verified: false },
            { name: 'Bihar Farmers Collective', location: 'Patna, Bihar', contact: '+91 6543210987', commodities: ['Potato', 'Maize'], rating: 4.0, verified: true },
        ],
        skipDuplicates: true,
    });
    // Seed Forecasts from CSV
    const csvFilePath = path.join(__dirname, '../../forecast_lookup_all_commodities.csv');
    if (!fs.existsSync(csvFilePath)) {
        console.error(`CSV file not found at ${csvFilePath}`);
        return;
    }
    console.log('Reading CSV and seeding forecasts... This may take a while.');
    let count = 0;
    let batch = [];
    const BATCH_SIZE = 10000;
    const stream = fs.createReadStream(csvFilePath)
        .pipe(csv());
    for await (const row of stream) {
        // Basic validation and parsing
        const currentModalPrice = parseFloat(row.current_modal_price);
        const confidence = parseFloat(row.confidence);
        const priceTrendScore = parseFloat(row.price_trend_score);
        const probFalling = parseFloat(row.prob_Falling);
        const probRising = parseFloat(row.prob_Rising);
        const probStable = parseFloat(row.prob_Stable);
        if (isNaN(currentModalPrice))
            continue;
        batch.push({
            commodity: row.commodity,
            state: row.state,
            district: row.district,
            market: row.market,
            date: new Date(row.date),
            currentModalPrice: currentModalPrice,
            predictedPriceTrend: row.predicted_price_trend,
            confidence: isNaN(confidence) ? 0 : confidence,
            confidenceBand: row.confidence_band || 'Unknown',
            priceTrendScore: isNaN(priceTrendScore) ? 0 : priceTrendScore,
            probFalling: isNaN(probFalling) ? 0 : probFalling,
            probRising: isNaN(probRising) ? 0 : probRising,
            probStable: isNaN(probStable) ? 0 : probStable,
        });
        if (batch.length >= BATCH_SIZE) {
            await prisma.forecast.createMany({ data: batch });
            count += batch.length;
            if (count % 100000 === 0) {
                console.log(`Seeded ${count} forecasts...`);
            }
            batch = [];
        }
    }
    if (batch.length > 0) {
        await prisma.forecast.createMany({ data: batch });
        count += batch.length;
        console.log(`Seeded ${count} forecasts total.`);
    }
    console.log('Seed completed successfully.');
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map