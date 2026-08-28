import mongoose from "mongoose";
import { env } from "./env";

export async function connectDB(options: mongoose.ConnectOptions = {}): Promise<void> {
  try {
    const uri = env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI is not set");

    await mongoose.connect(uri, options);
    console.log("MongoDB connected");
  } catch (error) {
    console.error("MongoDB connection failed:", error);
    throw error;
  }
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
}
