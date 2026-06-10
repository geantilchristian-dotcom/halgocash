import app from "./app";
import { logger } from "./lib/logger";
import { runMigrations, seedAdmin } from "./lib/migrate";
import { startSettlementScheduler } from "./routes/sport-scheduler";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

runMigrations()
  .then(() => seedAdmin())
  .then(() => {
    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }
      logger.info({ port }, "Server listening");
      startSettlementScheduler();
    });
  })
  .catch((err) => {
    logger.error({ err }, "Database migration failed");
    process.exit(1);
  });
