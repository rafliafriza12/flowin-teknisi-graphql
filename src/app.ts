import express, { Request, Response, json } from "express";
import cors from "cors";
import { ApolloServer } from "@apollo/server";
import http from "http";

import { config } from "./config";
import { typeDefs, resolvers } from "./graphql";
import { GraphQLContext } from "./types";
import {
  formatGraphQLError,
  httpContextMiddleware,
  requestLoggerMiddleware,
  authMiddleware,
  apiKeyMiddleware,
  rateLimiterMiddleware,
} from "./middlewares";

const app = express();
const httpServer = http.createServer(app);

const apolloServer = new ApolloServer<GraphQLContext>({
  typeDefs,
  resolvers: resolvers as never,
  formatError: formatGraphQLError,
  introspection: config.nodeEnv !== "production",
});

const createExpressMiddleware = <TContext extends GraphQLContext>(
  server: ApolloServer<TContext>,
  options?: {
    context?: (args: { req: Request; res: Response }) => Promise<TContext>;
  }
) => {
  return async (req: Request, res: Response) => {
    const contextValue = options?.context
      ? await options.context({ req, res })
      : ({ req, res } as TContext);

    const { body } = req;

    try {
      const result = await server.executeOperation(
        {
          query: body.query,
          variables: body.variables,
          operationName: body.operationName,
        },
        { contextValue }
      );

      if (result.body.kind === "single") {
        res.json(result.body.singleResult);
      } else {
        res.json({
          data: null,
          errors: [{ message: "Incremental delivery not supported" }],
        });
      }
    } catch (error) {
      console.error("GraphQL Error:", error);
      res.status(500).json({
        errors: [
          {
            message:
              error instanceof Error ? error.message : "Internal server error",
          },
        ],
      });
    }
  };
};

export const startApolloServer = async () => {
  await apolloServer.start();

  app.use(
    cors({
      origin: config.corsOrigin,
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "x-api-key"],
      credentials: true,
    })
  );

  app.use(json());
  app.use(httpContextMiddleware);
  app.use(requestLoggerMiddleware);
  app.use(apiKeyMiddleware);
  app.use(rateLimiterMiddleware);

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      environment: config.nodeEnv,
    });
  });

  const graphqlMiddleware = createExpressMiddleware(apolloServer, {
    context: async ({ req, res }): Promise<GraphQLContext> => {
      // Authenticate user from token
      const user = await authMiddleware(req);

      return {
        req,
        res,
        user,
      };
    },
  });

  app.post(config.graphqlPath, graphqlMiddleware);

  app.post("/", graphqlMiddleware);

  app.get(config.graphqlPath, (_req, res) => {
    res.json({
      message: "GraphQL endpoint - use POST method for queries",
      playground:
        "Use Apollo Sandbox at https://studio.apollographql.com/sandbox/explorer",
    });
  });

  app.get("/", (_req, res) => {
    res.json({
      message: "🚀 Bumi Resource GraphQL API",
      graphql: config.graphqlPath,
      documentation: "https://studio.apollographql.com/sandbox/explorer",
    });
  });

  return { app, httpServer, apolloServer };
};

export { app, httpServer, apolloServer };
