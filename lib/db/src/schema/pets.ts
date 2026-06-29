import { pgTable, varchar, integer, text } from "drizzle-orm/pg-core";

export const petsTable = pgTable("pets", {
  userId:     varchar("user_id",    { length: 255 }).primaryKey(),
  petName:    varchar("pet_name",   { length: 50  }).notNull(),
  level:      integer("level").notNull().default(1),
  enhanceLog: text("enhance_log").notNull().default("[]"),
});

export type PetRow = typeof petsTable.$inferSelect;
