import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cron from "node-cron";
import { setupRoutes } from "./src/routes/index.js";
import { setupLogger } from "./src/utils/logger.js";
import { fetchAndStoreData } from "./src/scripts/fetch_data.js";

dotenv.config();

const app = express();
const logger = setupLogger();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
console.log(process.env);
// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => logger.info("Connected to MongoDB"))
  .catch((err) => logger.error("MongoDB connection error:", err));

// Setup routes
setupRoutes(app);

// Schedule data fetching (every day at midnight)
cron.schedule("*/1 * * * *", async () => {
  try {
    await fetchAndStoreData();
    logger.info("Successfully fetched and stored new match data");
  } catch (error) {
    logger.error("Error in scheduled data fetch:", error);
  }
});

app.listen(port, () => {
  logger.info(`Server running on port ${port}`);
});
