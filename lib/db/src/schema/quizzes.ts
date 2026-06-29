import { pgTable, varchar, integer, text } from "drizzle-orm/pg-core";

export const quizzesTable = pgTable("quizzes", {
  id:               integer("id").primaryKey(),
  answer:           varchar("answer",   { length: 100 }).notNull(),
  chosung:          varchar("chosung",  { length: 100 }).notNull(),
  category:         varchar("category", { length: 50  }).notNull(),
  alternateAnswers: text("alternate_answers").notNull().default("[]"),
});

export type QuizRow = typeof quizzesTable.$inferSelect;
