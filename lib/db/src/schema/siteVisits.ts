import { pgTable, bigserial, timestamp } from "drizzle-orm/pg-core";

export const siteVisitsTable = pgTable("site_visits", {
  id:        bigserial("id", { mode: "number" }).primaryKey(),
  visitedAt: timestamp("visited_at", { withTimezone: true }).notNull().defaultNow(),
});
