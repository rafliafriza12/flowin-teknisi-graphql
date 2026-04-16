import { ApolloServer } from "@apollo/server";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import mongoose from "mongoose";
import crypto from "crypto";
import resolvers from "../src/graphql/resolvers";
import typeDefs from "../src/graphql/typeDefs";
import { config } from "../src/config";
import { authMiddleware } from "../src/middlewares/authMiddleware";
import { RateLimiter } from "../src/utils/rateLimiter";

let cachedDb: typeof mongoose | null = null;

// Rate limiter instances (persisted across serverless invocations via module cache)
const vercelGeneralLimiter = new RateLimiter({
  maxRequests: 100,
  windowMs: 60 * 1000,
  name: "vercel-general",
});
const vercelAuthLimiter = new RateLimiter({
  maxRequests: 10,
  windowMs: 15 * 60 * 1000,
  name: "vercel-auth",
});

async function connectToDatabase() {
  if (cachedDb && cachedDb.connection.readyState === 1) {
    return cachedDb;
  }

  if (!config.mongoUri) {
    throw new Error("MONGO_URI is not defined");
  }

  const db = await mongoose.connect(config.mongoUri);
  cachedDb = db;
  return db;
}

const apolloServer = new ApolloServer({
  typeDefs,
  resolvers: resolvers as any,
  introspection: true,
  formatError: (error) => {
    console.error("GraphQL Error:", error);
    return error;
  },
});

let serverStarted = false;

async function startServer() {
  if (!serverStarted) {
    await apolloServer.start();
    serverStarted = true;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const allowedOrigins = config.corsOrigin.split(",");
  const origin = req.headers.origin || "";

  if (allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
  }

  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS",
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-api-key",
  );

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  // Validate internal API secret
  if (config.internalApiSecret) {
    const apiKey = req.headers["x-api-key"] as string | undefined;

    if (!apiKey) {
      res.status(401).json({
        errors: [
          {
            message:
              "Missing API key. Provide a valid key in the 'x-api-key' header.",
            extensions: { code: "UNAUTHENTICATED", statusCode: 401 },
          },
        ],
      });
      return;
    }

    const isValid =
      apiKey.length === config.internalApiSecret.length &&
      crypto.timingSafeEqual(
        Buffer.from(apiKey),
        Buffer.from(config.internalApiSecret),
      );

    if (!isValid) {
      res.status(403).json({
        errors: [
          {
            message: "Invalid API key.",
            extensions: { code: "FORBIDDEN", statusCode: 403 },
          },
        ],
      });
      return;
    }
  }

  if (req.method === "GET") {
    res.setHeader("Content-Type", "text/html");
    res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>GraphQL Playground</title>
          <style>
            body {
              margin: 0;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
          </style>
        </head>
        <body>
          <div id="root"></div>
          <script>
            window.addEventListener('load', function () {
              const div = document.getElementById('root');
              div.innerHTML = '<h1 style="text-align: center; padding: 50px;">GraphQL API is running!</h1><p style="text-align: center;">Send POST request to this endpoint with GraphQL query.</p><p style="text-align: center;"><strong>Endpoint:</strong> ' + window.location.href + '</p>';
            });
          </script>
        </body>
      </html>
    `);
    return;
  }

  if (req.method !== "POST") {
    res
      .status(405)
      .json({ error: "Method not allowed. Use POST for GraphQL queries." });
    return;
  }

  // Rate limiting
  const clientIp =
    (typeof req.headers["x-forwarded-for"] === "string"
      ? req.headers["x-forwarded-for"].split(",")[0].trim()
      : req.socket?.remoteAddress) || "unknown";

  const body = req.body || {};
  const operationName =
    (body.operationName as string) ||
    (body.query as string)?.match(
      /(?:mutation|query)\s*(?:\w+\s*)?\{\s*(\w+)/,
    )?.[1] ||
    null;

  const AUTH_OPS = [
    "login",
    "register",
    "forgotPassword",
    "resetPassword",
    "refreshToken",
  ];
  const isAuthOp = operationName ? AUTH_OPS.includes(operationName) : false;
  const limiter = isAuthOp ? vercelAuthLimiter : vercelGeneralLimiter;
  const result = limiter.consume(clientIp);

  res.setHeader("X-RateLimit-Limit", result.total);
  res.setHeader("X-RateLimit-Remaining", Math.max(0, result.remaining));
  res.setHeader("X-RateLimit-Reset", Math.ceil(result.resetAt / 1000));

  if (!result.allowed) {
    const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
    res.setHeader("Retry-After", retryAfter);
    res.status(429).json({
      errors: [
        {
          message: isAuthOp
            ? "Too many authentication attempts. Please try again later."
            : "Too many requests. Please slow down.",
          extensions: { code: "RATE_LIMITED", statusCode: 429, retryAfter },
        },
      ],
    });
    return;
  }

  try {
    await connectToDatabase();

    await startServer();

    const { user, role } = await authMiddleware(req as any);

    const body = req.body || {};
    const { query, variables, operationName } = body as {
      query?: string;
      variables?: Record<string, any>;
      operationName?: string;
    };

    if (!query) {
      res.status(400).json({
        errors: [
          {
            message: "GraphQL query is required in request body",
            extensions: {
              code: "BAD_REQUEST",
            },
          },
        ],
      });
      return;
    }

    const response = await apolloServer.executeOperation(
      {
        query,
        variables,
        operationName,
      },
      {
        contextValue: {
          req,
          res,
          user,
          role,
        },
      },
    );

    if (response.body.kind === "single") {
      res.status(200).json(response.body.singleResult);
    } else {
      res
        .status(200)
        .json({ errors: [{ message: "Incremental delivery not supported" }] });
    }
  } catch (error) {
    console.error("Handler Error:", error);
    res.status(500).json({
      errors: [
        {
          message:
            error instanceof Error ? error.message : "Internal server error",
        },
      ],
    });
  }
}
