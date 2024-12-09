import axios from "axios";
import dotenv from "dotenv";
import { Match } from "../models/match.js";
import { setupLogger } from "../utils/logger.js";

dotenv.config();
const logger = setupLogger();

export async function fetchAndStoreData() {
  try {
    const response = await axios.get(
      "https://api.football-data.org/v4/matches",
      {
        headers: {
          "X-Auth-Token": process.env.FOOTBALL_API_KEY,
        },
        params: {
          dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0],
          dateTo: new Date().toISOString().split("T")[0],
          status: "FINISHED",
        },
      }
    );

    const matches = response.data.matches;

    for (const match of matches) {
      await Match.findOneAndUpdate(
        {
          homeTeam: match.homeTeam.name,
          awayTeam: match.awayTeam.name,
          date: new Date(match.utcDate),
        },
        {
          score: {
            home: match.score.fullTime.home,
            away: match.score.fullTime.away,
          },
          matchday: match.matchday,
          status: match.status,
          competition: match.competition.name,
          season: match.season.id,
          outcome:
            match.score.fullTime.home > match.score.fullTime.away
              ? "win"
              : match.score.fullTime.home < match.score.fullTime.away
              ? "loss"
              : "draw",
        },
        { upsert: true, new: true }
      );
    }

    logger.info(`Successfully stored ${matches.length} matches`);
  } catch (error) {
    logger.error("Error fetching and storing matches:", error);
    throw error;
  }
}
