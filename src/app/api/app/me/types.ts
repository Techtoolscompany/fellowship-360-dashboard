import { users } from "@/db/schema/user";

export interface MeResponse {
  user: Omit<typeof users.$inferSelect, "password">;
}
