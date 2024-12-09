import axios from "axios";
import LogisticRegression from "ml-logistic-regression";
import Matrix from "ml-matrix";

class SoccerPredictor {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = "https://api.football-data.org/v4"; // Using v4 API
    this.model = null;
    this.scaler = null;
  }

  async fetchMatchData(daysBack = 10) {
    try {
      const endDate = new Date().toISOString().split("T")[0];
      const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      console.log(startDate, endDate);

      console.log(`Fetching matches from ${startDate} to ${endDate}`);

      const response = await axios.get(`${this.baseUrl}/matches`, {
        headers: {
          "X-Auth-Token": this.apiKey,
        },
        params: {
          dateFrom: startDate,
          dateTo: endDate,
          status: "FINISHED",
        },
      });

      if (!response.data.matches || response.data.matches.length === 0) {
        throw new Error("No matches found in the specified date range");
      }

      console.log(
        `Successfully fetched ${response.data.matches.length} matches`
      );
      return response.data.matches;
    } catch (error) {
      if (error.response && error.response.status === 403) {
        console.error(
          "API Access Forbidden. Please check your API key and subscription level."
        );
      } else {
        console.error("Error fetching match data:", error);
      }
      throw error;
    }
  }

  preprocessData(matches) {
    console.log(`Preprocessing ${JSON.stringify(matches[0].score)} matches...`);
    try {
      const processedData = matches
        .filter((match) => {
          // v4 API uses score.home and score.away
          return (
            match.score.fullTime &&
            typeof match.score.fullTime.home === "number" &&
            typeof match.score.fullTime.away === "number"
          );
        })
        .map((match) => {
          return {
            homeTeam: match.homeTeam.name,
            awayTeam: match.awayTeam.name,
            homeGoals: match.score.fullTime.home,
            awayGoals: match.score.fullTime.away,
            matchday: match.matchday || 0,
            outcome:
              match.score.fullTime.home > match.score.fullTime.away
                ? "win"
                : match.score.fullTime.home < match.score.fullTime.away
                ? "loss"
                : "draw",
          };
        });

      if (processedData.length === 0) {
        throw new Error("No valid matches after preprocessing");
      }

      console.log(`Preprocessed ${processedData.length} matches successfully`);
      return processedData;
    } catch (error) {
      console.error("Error in preprocessing:", error);
      throw error;
    }
  }

  trainModel(data) {
    try {
      if (!data || data.length === 0) {
        throw new Error("No data provided for training");
      }

      // Extract features
      const features = data.map((match) => [
        match.homeGoals,
        match.awayGoals,
        match.matchday,
      ]);

      // Extract labels
      const labels = data.map((match) =>
        match.outcome === "win" ? 0 : match.outcome === "loss" ? 1 : 2
      );

      // Verify we have enough data
      if (features.length < 10) {
        throw new Error(
          "Insufficient data for training. Need at least 10 matches."
        );
      }

      const cleanedFeatures = features.map((row) =>
        row.map((value) => (value === undefined ? 0 : value))
      );

      // Check label diversity
      const uniqueLabels = new Set(labels);
      if (uniqueLabels.size < 2) {
        throw new Error(
          "Insufficient diversity in target labels. Need at least 2 different outcomes."
        );
      }

      // Scale features
      const scaledFeatures = this.scaleFeatures(cleanedFeatures);

      // Convert features and labels to Matrix format
      const X = new Matrix(scaledFeatures);
      const y = Matrix.columnVector(labels);

      // Split data
      const splitIndex = Math.floor(features.length * 0.8);
      const X_train = X.subMatrix(0, splitIndex - 1, 0, X.columns - 1);
      const X_test = X.subMatrix(splitIndex, X.rows - 1, 0, X.columns - 1);
      const y_train = y.subMatrix(0, splitIndex - 1, 0, 0);
      const y_test = y.subMatrix(splitIndex, y.rows - 1, 0, 0);

      // Train model
      this.model = new LogisticRegression({
        numSteps: 1000,
        learningRate: 0.1,
      });

      this.model.train(X_train, y_train);

      console.log("Model training completed successfully");

      // Return test data in Matrix format
      return {
        X_test: X_test,
        y_test: y_test.to2DArray().map((row) => row[0]),
      };
    } catch (error) {
      console.error("Error in model training:", error.message);
      throw error;
    }
  }

  scaleFeatures(features) {
    const matrix = new Matrix(features);
    const means = matrix.mean("column");
    const stds = matrix.standardDeviation("column");

    const scaled = matrix
      .to2DArray()
      .map((row) => row.map((val, i) => (val - means[i]) / (stds[i] || 1)));
    return scaled;
  }

  evaluateModel(X_test, y_test) {
    if (!this.model) {
      throw new Error("Model has not been trained yet");
    }

    try {
      // Convert X_test to Matrix format if it's not already
      const X_test_matrix = Matrix.isMatrix(X_test)
        ? X_test
        : new Matrix(X_test);

      // Make predictions
      const predictions = this.model.predict(X_test_matrix);

      // Calculate accuracy
      const correct = predictions.filter(
        (pred, i) => pred === y_test[i]
      ).length;
      const accuracy = correct / predictions.length;

      console.log(`Model Accuracy: ${(accuracy * 100).toFixed(2)}%`);

      // Create confusion matrix
      const confusionMatrix = Array(3)
        .fill()
        .map(() => Array(3).fill(0));
      predictions.forEach((pred, i) => {
        confusionMatrix[y_test[i]][pred]++;
      });

      console.log("Confusion Matrix:");
      console.log(confusionMatrix);

      return accuracy;
    } catch (error) {
      console.error("Error in model evaluation:", error);
      throw error;
    }
  }
}

async function main() {
  try {
    const apiKey = "f9158ecbccbd4a679a7cb09b861bc602";
    const predictor = new SoccerPredictor(apiKey);

    console.log("Fetching match data...");
    const matches = await predictor.fetchMatchData(10); // Fetch 30 days of data

    console.log("Preprocessing data...");
    const processedData = predictor.preprocessData(matches);

    console.log("Training model...");
    const { X_test, y_test } = predictor.trainModel(processedData);

    console.log("Evaluating model...");
    predictor.evaluateModel(X_test, y_test);
  } catch (error) {
    console.error("An error occurred in the main process:", error.message);
  }
}

// Export the SoccerPredictor class
export { SoccerPredictor };

// Only run main if this file is being run directly
if (import.meta.url === new URL(process.argv[1], "file:").href) {
  main();
}
