import type { Db } from "mongodb";

import { getAdminDashboardSnapshot } from "../../db/repositories/adminDashboard";

export async function getAdminDashboard(db: Db) {
  return getAdminDashboardSnapshot(db);
}
