/* eslint-disable @typescript-eslint/no-require-imports */
const { frontendSchemaPointers } = require("../backend/schema/schema-sources.cjs");

/** @type {import("@graphql-codegen/cli").CodegenConfig} */
module.exports = {
  schema: frontendSchemaPointers,
  documents: [
    "./app/**/_graphql/**/*.graphql",
    "./src/graphql/operations/**/*.graphql"
  ],
  generates: {
    "./src/graphql/generated/": {
      preset: "client",
      plugins: []
    }
  }
};
