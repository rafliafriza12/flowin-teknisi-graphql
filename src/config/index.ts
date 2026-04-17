import dotenv from "dotenv";

dotenv.config();

function validateEnvVars() {
  const requiredVars = [
    "MONGODB_URI",
    "JWT_ACCESS_SECRET",
    "JWT_REFRESH_SECRET",
    "INTERNAL_API_SECRET",
  ];

  const missingVars = requiredVars.filter((varName) => !process.env[varName]);

  if (missingVars.length > 0) {
    console.error("❌ Missing required environment variables:");
    missingVars.forEach((varName) => {
      console.error(`   - ${varName}`);
    });
    console.error(
      "\n💡 Please check your .env file and ensure all required variables are set.",
    );
    console.error("   Copy .env.example to .env and fill in the values.\n");
    process.exit(1);
  }

  // if (process.env.NODE_ENV === "production") {
  //   const accessSecret = process.env.JWT_ACCESS_SECRET || "";
  //   const refreshSecret = process.env.JWT_REFRESH_SECRET || "";

  //   if (accessSecret.length < 32 || refreshSecret.length < 32) {
  //     console.error(
  //       "❌ JWT secrets must be at least 32 characters in production!"
  //     );
  //     console.error(
  //       "   Generate strong secrets using: node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\"\n"
  //     );
  //     process.exit(1);
  //   }
  // }
  // test
}

validateEnvVars();

export const config = {
  port: parseInt(process.env.PORT || "4000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  mongoUri: process.env.MONGODB_URI!,
  corsOrigin: process.env.CORS_ORIGIN || "*",
  graphqlPath: process.env.GRAPHQL_PATH || "/graphql",
  defaultPageSize: 10,
  maxPageSize: 100,

  jwt: {
    accessTokenSecret: process.env.JWT_ACCESS_SECRET!,
    refreshTokenSecret: process.env.JWT_REFRESH_SECRET!,
    accessTokenExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
    refreshTokenExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  },

  smtp: {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.SMTP_FROM || "noreply@bumiresources.com",
  },

  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",

  internalApiSecret: process.env.INTERNAL_API_SECRET || "",

  midtrans: {
    serverKey: process.env.MIDTRANS_SERVER_KEY || "",
    clientKey: process.env.MIDTRANS_CLIENT_KEY || "",
    isProduction: process.env.MIDTRANS_IS_PRODUCTION === "true",
  },
} as const;

export type Config = typeof config;
