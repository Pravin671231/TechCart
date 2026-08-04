import express from "express";
import routes from "./routes";
import { corsMiddleware } from "./middleware/cors";
import { notFoundHandler } from "./middleware/notFound";
import { errorHandler } from "./middleware/errorHandler";

const app = express();

app.use(corsMiddleware);

// Express 5's default ("simple") query parser has no support for bracket
// notation (?spec[RAM]=8GB), which the buyer product listing's dynamic
// specification filters depend on (#36, FR-CAT-072) — "extended" restores
// the qs-based nested/array parsing Express 4 always had, requiring `qs` as
// an explicit dependency here since Express 5 no longer bundles it.
app.set("query parser", "extended");

app.use(express.json());
app.use(routes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
