// Optional: a throwaway local Postgres for development, with no Docker and no install.
//   npm run db:local      (leave it running, then use the DATABASE_URL from .env.example)
// Data lives in ./.pgdata. Not for production.
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";

const pg = new EmbeddedPostgres({
  databaseDir: "./.pgdata",
  user: "postgres",
  password: "postgres",
  port: Number(process.env.PGPORT ?? 5432),
  persistent: true,
});

const fresh = !existsSync("./.pgdata/PG_VERSION");
if (fresh) await pg.initialise();
await pg.start();
if (fresh) await pg.createDatabase("trustall");
console.log(`Postgres is running: postgres://postgres:postgres@localhost:${process.env.PGPORT ?? 5432}/trustall`);
console.log("Press Ctrl+C to stop.");
const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
