import { startApolloServer, httpServer } from "./app";
import { connectDatabase } from "./config/database";
import { config } from "./config";

const startServer = async () => {
  try {
    await connectDatabase();  
    await startApolloServer();
    
    httpServer.listen(config.port, () => {
      console.log(`🚀 Server running on http://localhost:${config.port}`);
      console.log(`📊 GraphQL endpoint: http://localhost:${config.port}${config.graphqlPath}`);
      console.log(`🔍 Environment: ${config.nodeEnv}`);
    });
    
    const shutdown = async () => {
      console.log("\n🛑 Shutting down gracefully...");
      httpServer.close(() => {
        console.log("📤 HTTP server closed");
        process.exit(0);
      });
    };
    
    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
    
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

startServer();