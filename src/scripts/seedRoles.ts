import mongoose from "mongoose";
import { config } from "../config";
import roleService from "../services/roleService";

async function seedRoles() {
  try {
    console.log("Connecting to database...");
    await mongoose.connect(config.mongoUri);
    console.log("Connected to MongoDB");

    console.log("Initializing default roles...");
    await roleService.initializeDefaultRoles();

    console.log("Default roles initialized successfully!");
  } catch (error) {
    console.error("Error seeding roles:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

seedRoles();
