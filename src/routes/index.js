import { SoccerPredictor } from "../../soccer_prediction.js";
import { Match } from "../models/match.js";
import { setupLogger } from "../utils/logger.js";

const logger = setupLogger();
const predictor = new SoccerPredictor(process.env.FOOTBALL_API_KEY);

export function setupRoutes(app) {
  // Get all matches
  app.get("/api/matches", async (req, res) => {
    try {
      const matches = await Match.find().sort("-date");
      res.json(matches);
    } catch (error) {
      logger.error("Error fetching matches:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get prediction for a match
  app.post("/api/predict", async (req, res) => {
    try {
      const { homeGoals, awayGoals, matchday } = req.body;

      if (
        typeof homeGoals !== "number" ||
        typeof awayGoals !== "number" ||
        typeof matchday !== "number"
      ) {
        return res.status(400).json({ error: "Invalid input data" });
      }

      const prediction = predictor.model.predict([
        [homeGoals, awayGoals, matchday],
      ]);
      const outcome =
        prediction[0] === 0 ? "win" : prediction[0] === 1 ? "loss" : "draw";

      res.json({ prediction: outcome });
    } catch (error) {
      logger.error("Error making prediction:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
}
