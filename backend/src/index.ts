import { connectDB } from "./config/db";
import { env } from "./config/env";
import app from "./app";

export async function startServer(): Promise<void> {
  try {
    await connectDB();

    app.listen(env.PORT, () => {
      console.log(`Server is running on port ${env.PORT}`);
    });
  } catch (error) {
    console.error("Error starting server:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}
