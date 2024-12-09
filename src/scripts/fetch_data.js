import axios from "axios";
import dotenv from "dotenv";
import { Match } from "../models/match.js";
import { setupLogger } from "../utils/logger.js";

dotenv.config();
const logger = setupLogger();

export async function fetchAndStoreData() {
  try {
    logger.info("Starting to fetch match data...");

    const today = new Date();
    const totalDays = 60;
    const daysPerFetch = 9;

    for (let i = 0; i < totalDays / daysPerFetch; i++) {
      const dateTo = new Date("2024-10-30");
      dateTo.setDate(today.getDate() - i * daysPerFetch); // End date for this fetch

      const dateFrom = new Date(dateTo);
      dateFrom.setDate(dateTo.getDate() - daysPerFetch); // Start date for this fetch

      // Format dates to YYYY-MM-DD
      const formattedDateFrom = dateFrom.toISOString().split("T")[0];
      const formattedDateTo = dateTo.toISOString().split("T")[0];

      logger.info(
        `Fetching data from ${formattedDateFrom} to ${formattedDateTo}`
      );

      const response = await axios.get(
        "https://api.football-data.org/v4/matches",
        {
          headers: {
            "X-Auth-Token": process.env.FOOTBALL_API_KEY,
          },
          params: {
            dateFrom: formattedDateFrom, // 10 days ago
            dateTo: formattedDateTo, // today's date
            status: "FINISHED",
            competitions: "2021", // Champions League competition ID
          },
        }
      );

      const matches = response.data.matches;
      logger.info(`Fetched ${matches?.length || 0} matches`);

      if (!matches || matches.length === 0) {
        logger.warn("No matches found in the response");
        continue;
      }

      // Process each match
      for (const match of matches) {
        try {
          if (!match.score?.fullTime?.home && !match.score?.fullTime?.away) {
            logger.warn(
              `Skipping match due to missing score data: ${match.homeTeam?.name} vs ${match.awayTeam?.name}`
            );
            continue;
          }

          const matchData = {
            homeTeam: {
              name: match.homeTeam?.name || "Unknown Team",
            },
            awayTeam: {
              name: match.awayTeam?.name || "Unknown Team",
            },
            score: {
              home: match.score?.fullTime?.home || 0,
              away: match.score?.fullTime?.away || 0,
            },
            matchday: match.matchday || 0,
            status: match.status,
            date: new Date(match.utcDate),
            competition: match.competition?.name || "Unknown Competition",
            season: match.season?.id?.toString(),
            outcome:
              match.score?.fullTime?.home > match.score?.fullTime?.away
                ? "win"
                : match.score?.fullTime?.home < match.score?.fullTime?.away
                ? "loss"
                : "draw",
          };

          console.log(matchData);

          await Match.findOneAndUpdate(
            {
              "homeTeam.name": matchData.homeTeam.name,
              "awayTeam.name": matchData.awayTeam.name,
              date: matchData.date,
            },
            matchData,
            { upsert: true, new: true }
          );

          logger.info(
            `Stored/Updated match: ${matchData.homeTeam.name} vs ${matchData.awayTeam.name}`
          );
        } catch (matchError) {
          logger.error("Error processing individual match:", {
            error: matchError.message,
            match: match.id,
          });
        }
      }

      logger.info(
        `Finished processing matches for ${formattedDateFrom} to ${formattedDateTo}`
      );
    }

    logger.info("Finished processing all matches");
  } catch (error) {
    logger.error("Error fetching and storing matches:", {
      error: error.message,
      response: error.response?.data,
    });
    throw error;
  }
}
