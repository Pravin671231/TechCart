import cors from "cors";
import { env } from "@/config/env";

const allowedOrigins = env.CORS_ORIGINS.split(",").map((origin) => origin.trim());

export const corsMiddleware = cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "X-Admin-Key"],
});
