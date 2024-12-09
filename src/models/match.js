import mongoose from "mongoose";

const matchSchema = new mongoose.Schema(
  {
    homeTeam: {
      name: {
        type: String,
        required: true,
      },
    },
    awayTeam: {
      name: {
        type: String,
        required: true,
      },
    },
    score: {
      home: Number,
      away: Number,
    },
    matchday: Number,
    status: String,
    outcome: String,
    date: Date,
    competition: String,
    season: String,
    prediction: {
      type: String,
      enum: ["win", "loss", "draw"],
      default: null,
    },
  },
  { timestamps: true }
);

export const Match = mongoose.model("Match", matchSchema);
