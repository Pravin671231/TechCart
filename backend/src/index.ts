import { connectDB } from "./config/db";
import { env } from "./config/env";
import app from "./app";

export async function startServer(): Promise<void> {
  try {
    await connectDB();
  } catch (error) {
    console.error("Error starting server:", error);
    process.exit(1);
    return;
  }

  app.listen(env.PORT, () => {
    console.log(`Server is running on port ${env.PORT}`);
  });
}

if (require.main === module) {
  startServer();
}
