const { backendSchemaPointers } = require("./schema/schema-sources.cjs");

/** @type {import("@graphql-codegen/cli").CodegenConfig} */
module.exports = {
  schema: backendSchemaPointers,
  generates: {
    "./src/generated/graphql.ts": {
      plugins: ["typescript", "typescript-resolvers"],
      config: {
        contextType: "../server/context#GraphQLContext"
      }
    }
  }
};
