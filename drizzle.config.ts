import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./app/server/schema.ts",
  out: "./drizzle/migrations",
  dialect: "mysql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
