import "dotenv/config";

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@as-integrations/express5";
import cors from "cors";
import express from "express";

import { connectMongo } from "../db/mongo";
import { resolvers } from "../graphql/resolvers/index";
import { createGraphQLContext } from "./context";

const { runtimeSchemaDirectories } = require("../../schema/schema-sources.cjs") as {
  runtimeSchemaDirectories: string[];
};

const readGraphqlFiles = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const sortedEntries = entries.sort((left, right) => left.name.localeCompare(right.name));
  const documents: string[] = [];

  for (const entry of sortedEntries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      documents.push(...await readGraphqlFiles(entryPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".graphql")) {
      documents.push(await readFile(entryPath, "utf-8"));
    }
  }

  return documents;
};

const loadTypeDefs = async (): Promise<string> => {
  const schemaRoot = path.resolve(__dirname, "../../schema");
  const documentGroups = await Promise.all(
    runtimeSchemaDirectories.map((relativeDirectory) =>
      readGraphqlFiles(path.join(schemaRoot, relativeDirectory))
    )
  );

  return documentGroups.flat().join("\n\n");
};

const startServer = async (): Promise<void> => {
  const db = await connectMongo();

  await db.collection("chargingStations").createIndex(
    { location: "2dsphere" },
    { name: "location_2dsphere" }
  ).catch(() => {});

  const app = express();
  app.use(express.json());

  const server = new ApolloServer({
    typeDefs: await loadTypeDefs(),
    resolvers
  });

  await server.start();

  app.use(
    "/graphql",
    cors({
      origin: process.env.BACKEND_CORS_ORIGIN ?? "http://localhost:3000"
    }),
    expressMiddleware(server, {
      context: async () => createGraphQLContext(db)
    })
  );

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  const backendUrl = process.env.BACKEND_URL ?? "http://localhost:4000";
  const port = Number(new URL(backendUrl).port || 4000);
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Backend GraphQL server listening on port ${port}`);
  });
};

// Force restart on schema change
void startServer();
