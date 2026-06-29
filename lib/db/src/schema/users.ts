import { pgTable, varchar, bigint, integer, primaryKey } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  userId:               varchar("user_id",                { length: 255 }).primaryKey(),
  nickname:             varchar("nickname",               { length: 255 }).notNull().default(""),
  score:                bigint("score",                   { mode: "number" }).notNull().default(0),
  correct:              bigint("correct",                 { mode: "number" }).notNull().default(0),
  total:                bigint("total",                   { mode: "number" }).notNull().default(0),
  lastAttendance:       varchar("last_attendance",        { length: 10  }).notNull().default(""),
  hunminWins:           integer("hunmin_wins").notNull().default(0),
  hunminMax:            integer("hunmin_max").notNull().default(0),
  hunminTotal:          integer("hunmin_total").notNull().default(0),
  relicInvLimit:        integer("relic_inv_limit").notNull().default(6),
  jamoStreak:           integer("jamo_streak").notNull().default(0),
  lastJamoDate:         varchar("last_jamo_date",         { length: 10 }).notNull().default(""),
  jamoBestStreak:       integer("jamo_best_streak").notNull().default(0),
  jamoTotalCount:       integer("jamo_total_count").notNull().default(0),
  jamoEasyCount:        integer("jamo_easy_count").notNull().default(0),
  jamoNormalCount:      integer("jamo_normal_count").notNull().default(0),
  jamoHardCount:        integer("jamo_hard_count").notNull().default(0),
  lastJamoAt:           varchar("last_jamo_at",           { length: 30 }).default(""),
});

export type UserRow = typeof usersTable.$inferSelect;

export const roomUsersTable = pgTable("room_users", {
  roomId:   varchar("room_id",  { length: 255 }).notNull(),
  userId:   varchar("user_id",  { length: 255 }).notNull(),
  nickname: varchar("nickname", { length: 255 }).notNull().default(""),
  score:    bigint("score",     { mode: "number" }).notNull().default(0),
  correct:  bigint("correct",   { mode: "number" }).notNull().default(0),
  total:    bigint("total",     { mode: "number" }).notNull().default(0),
}, (t) => ({
  pk: primaryKey({ columns: [t.roomId, t.userId] }),
}));

export type RoomUserRow = typeof roomUsersTable.$inferSelect;

export const giftLogTable = pgTable("gift_log", {
  userId:   varchar("user_id",   { length: 255 }).primaryKey(),
  giftDate: varchar("gift_date", { length: 10  }).notNull().default(""),
  sent:     bigint("sent",       { mode: "number" }).notNull().default(0),
  count:    integer("count").notNull().default(0),
});

export type GiftLogRow = typeof giftLogTable.$inferSelect;
