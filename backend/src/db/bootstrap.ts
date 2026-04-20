import { spawn } from "node:child_process";
import path from "node:path";

import type { Db } from "mongodb";

const SEED_ARCHIVE = path.resolve(__dirname, "../../seed/charging-demo.gz");

export async function ensureDatabaseSeeded(db: Db, uri: string): Promise<void> {
  // Consider the database "seeded" only if at least one user collection
  // actually holds documents. We can't rely on `listCollections` alone because
  // the server calls `createIndex` on `chargingStations` after this step,
  // which implicitly creates an empty collection. On the next boot that would
  // make the DB look populated when it's really still empty (for example
  // after a first-run restore failure because `mongorestore` was missing).
  const collections = await db.listCollections({}, { nameOnly: true }).toArray();
  const userCollections = collections.filter(({ name }) => !name.startsWith("system."));

  let hasAnyDocument = false;
  for (const { name } of userCollections) {
    const count = await db.collection(name).estimatedDocumentCount();
    if (count > 0) {
      hasAnyDocument = true;
      break;
    }
  }

  if (hasAnyDocument) {
    return;
  }

  console.log(
    `Database '${db.databaseName}' has no documents. Restoring seed from ${SEED_ARCHIVE} ...`
  );

  try {
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
  } catch (error) {
    const isMissingBinary =
      error instanceof Error && (error as NodeJS.ErrnoException).code === "ENOENT";

    if (isMissingBinary) {
      console.error(
        "Seed restore skipped: 'mongorestore' binary not found on PATH. " +
          "Install the MongoDB Database Tools (https://www.mongodb.com/docs/database-tools/installation/) " +
          "or run the stack via Docker (the backend image bundles mongorestore). " +
          `The database '${db.databaseName}' will start empty.`
      );
    } else {
      console.error(
        `Seed restore failed; continuing with an empty database '${db.databaseName}'.`,
        error
      );
    }
  }
}
