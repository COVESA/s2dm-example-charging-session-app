import { spawn } from "node:child_process";
import path from "node:path";

import type { Db } from "mongodb";

const SEED_ARCHIVE = path.resolve(__dirname, "../../seed/charging-demo.gz");

export async function ensureDatabaseSeeded(db: Db, uri: string): Promise<void> {
  const existing = await db.listCollections({}, { nameOnly: true }).toArray();
  if (existing.length > 0) {
    return;
  }

  console.log(
    `Database '${db.databaseName}' is empty. Restoring seed from ${SEED_ARCHIVE} ...`
  );

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(
      "mongorestore",
      ["--uri", uri, "--gzip", `--archive=${SEED_ARCHIVE}`],
      { stdio: "inherit" }
    );
    proc.on("error", reject);
    proc.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`mongorestore exited with code ${code}`));
      }
    });
  });

  console.log("Seed restore complete.");
}
