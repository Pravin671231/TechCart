import app from "./app";
import { env } from "./config/env";

app.listen(env.PORT, () => {
  console.log(`backend listening on port ${env.PORT}`);
});
