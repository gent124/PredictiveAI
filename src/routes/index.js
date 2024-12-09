import { SoccerPredictor } from "../../soccer_prediction.js";
import { Match } from "../models/match.js";
import { setupLogger } from "../utils/logger.js";
import axios from "axios";

const logger = setupLogger();
const predictor = new SoccerPredictor(process.env.FOOTBALL_API_KEY);

// Initialize the model with historical data
async function initializeModel() {
  try {
    const historicalMatches = await Match.find({ status: "FINISHED" });
    const processedData = historicalMatches.map((match) => ({
      homeGoals: match.score.home,
      awayGoals: match.score.away,
      matchday: match.matchday,
      outcome: match.outcome,
    }));

    if (processedData.length > 0) {
      const { model } = predictor.trainModel(processedData);
      logger.info("Model initialized with historical data");
    }
  } catch (error) {
    logger.error("Error initializing model:", error);
  }
}

// Initialize the model when the server starts
initializeModel();

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

  // Get upcoming matches with predictions
  app.get("/api/upcoming-matches", async (req, res) => {
    try {
      // Fetch upcoming matches from the API
      const response = await axios.get(
        "https://api.football-data.org/v4/matches",
        {
          headers: {
            "X-Auth-Token": process.env.FOOTBALL_API_KEY,
          },
          params: {
            status: "SCHEDULED",
            competitions: "2021", // Premier League
            limit: 10,
          },
        }
      );

      const upcomingMatches = response.data.matches;
      const predictions = [];

      for (const match of upcomingMatches) {
        try {
          // Get team statistics from historical matches
          const homeTeamStats = await getTeamStats(match.homeTeam.name);
          const awayTeamStats = await getTeamStats(match.awayTeam.name);

          // Prepare features for prediction
          const features = [
            homeTeamStats.avgGoalsScored,
            awayTeamStats.avgGoalsScored,
            match.matchday || 0,
          ];

          // Make prediction using historical stats
          const prediction = predictor.predict(features);

          const predictionResult =
            prediction[0] === 0 ? "win" : prediction[0] === 1 ? "loss" : "draw";

          predictions.push({
            matchId: match.id,
            homeTeam: match.homeTeam.name,
            awayTeam: match.awayTeam.name,
            matchday: match.matchday,
            date: match.utcDate,
            prediction: predictionResult,
            confidence: calculateConfidence(homeTeamStats, awayTeamStats),
            homeTeamStats,
            awayTeamStats,
          });
        } catch (matchError) {
          logger.error(`Error processing match ${match.id}:`, matchError);
          // Continue with other matches even if one fails
          continue;
        }
      }

      res.json(predictions);
    } catch (error) {
      logger.error("Error fetching upcoming matches:", error);
      res
        .status(500)
        .json({ error: "Internal server error", message: error.message });
    }
  });

  // Get prediction for specific teams
  app.post("/api/predict", async (req, res) => {
    try {
      const { homeTeam, awayTeam, matchday } = req.body;

      if (!homeTeam || !awayTeam) {
        return res
          .status(400)
          .json({ error: "Home team and away team are required" });
      }

      // Get team statistics
      const homeTeamStats = await getTeamStats(homeTeam);
      const awayTeamStats = await getTeamStats(awayTeam);

      // Prepare features for prediction
      const features = [
        homeTeamStats.avgGoalsScored,
        awayTeamStats.avgGoalsScored,
        matchday || 0,
      ];

      // Make prediction
      const prediction = predictor.predict(features);

      const predictionResult =
        prediction[0] === 0 ? "win" : prediction[0] === 1 ? "loss" : "draw";

      res.json({
        homeTeam,
        awayTeam,
        prediction: predictionResult,
        confidence: calculateConfidence(homeTeamStats, awayTeamStats),
        homeTeamStats,
        awayTeamStats,
      });
    } catch (error) {
      logger.error("Error making prediction:", error);
      res
        .status(500)
        .json({ error: "Internal server error", message: error.message });
    }
  });
}

// Helper function to get team statistics from historical matches
async function getTeamStats(teamName) {
  const matches = await Match.find({
    $or: [{ "homeTeam.name": teamName }, { "awayTeam.name": teamName }],
    status: "FINISHED",
  });

  let totalGoalsScored = 0;
  let totalGoalsConceded = 0;
  let wins = 0;
  let losses = 0;
  let draws = 0;

  matches.forEach((match) => {
    const isHomeTeam = match.homeTeam.name === teamName;
    const goalsScored = isHomeTeam ? match.score.home : match.score.away;
    const goalsConceded = isHomeTeam ? match.score.away : match.score.home;

    totalGoalsScored += goalsScored;
    totalGoalsConceded += goalsConceded;

    if (goalsScored > goalsConceded) wins++;
    else if (goalsScored < goalsConceded) losses++;
    else draws++;
  });

  return {
    matchesPlayed: matches.length,
    wins,
    losses,
    draws,
    avgGoalsScored: matches.length > 0 ? totalGoalsScored / matches.length : 0,
    avgGoalsConceded:
      matches.length > 0 ? totalGoalsConceded / matches.length : 0,
    winRate: matches.length > 0 ? wins / matches.length : 0,
  };
}

// Helper function to calculate prediction confidence based on team stats
function calculateConfidence(homeStats, awayStats) {
  const homeStrength =
    homeStats.winRate * 0.4 +
    homeStats.avgGoalsScored * 0.3 -
    homeStats.avgGoalsConceded * 0.3;

  const awayStrength =
    awayStats.winRate * 0.4 +
    awayStats.avgGoalsScored * 0.3 -
    awayStats.avgGoalsConceded * 0.3;

  // Normalize to a percentage
  const confidence = Math.abs(homeStrength - awayStrength) * 50 + 50;
  return Math.min(Math.max(confidence, 50), 90); // Keep between 50% and 90%
}
