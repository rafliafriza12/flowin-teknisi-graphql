import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { config } from "../config";

const seedUsers = async () => {
  try {
    await mongoose.connect(config.mongoUri);
    console.log("Connected to MongoDB");

    const User = mongoose.model("User", new mongoose.Schema({
      profilePictureUrl: String,
      fullname: String,
      username: { type: String, unique: true },
      email: { type: String, unique: true },
      password: String,
      role: { type: String, enum: ["Super Admin", "Admin", "Copywriter"] },
      isActive: { type: Boolean, default: true },
      accessToken: String,
      refreshToken: String,
      lastOnline: Date,
    }, { timestamps: true }));

    const users = [
      {
        profilePictureUrl: "https://example.com/superadmin.jpg",
        fullname: "Super Admin User",
        username: "superadmin",
        email: "superadmin@test.com",
        password: await bcrypt.hash("password123", 10),
        role: "Super Admin",
        isActive: true,
      },
      {
        profilePictureUrl: "https://example.com/admin.jpg",
        fullname: "Admin User",
        username: "admin",
        email: "admin@test.com",
        password: await bcrypt.hash("password123", 10),
        role: "Admin",
        isActive: true,
      },
      {
        profilePictureUrl: "https://example.com/copywriter.jpg",
        fullname: "Copywriter User",
        username: "copywriter",
        email: "copywriter@test.com",
        password: await bcrypt.hash("password123", 10),
        role: "Copywriter",
        isActive: true,
      },
    ];

    for (const userData of users) {
      const existing = await User.findOne({ email: userData.email });
      if (existing) {
        console.log(`User ${userData.email} already exists, skipping...`);
      } else {
        await User.create(userData);
        console.log(`Created user: ${userData.email} (${userData.role})`);
      }
    }

    console.log("\n✅ Seed completed!");
    console.log("\nTest Accounts:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("| Email                  | Password     | Role        |");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("| superadmin@test.com    | password123  | Super Admin |");
    console.log("| admin@test.com         | password123  | Admin       |");
    console.log("| copywriter@test.com    | password123  | Copywriter  |");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("Seed error:", error);
    process.exit(1);
  }
};

const updateUserPassword = async () => {
  try {
    await mongoose.connect(config.mongoUri);
    console.log("Connected to MongoDB");

    const User = mongoose.model("User", new mongoose.Schema({
      profilePictureUrl: String,
      fullname: String,
      username: { type: String, unique: true },
      email: { type: String, unique: true },
      password: String,
      role: { type: String, enum: ["Super Admin", "Admin", "Copywriter"] },
      isActive: { type: Boolean, default: true },
      accessToken: String,
      refreshToken: String,
      lastOnline: Date,
    }, { timestamps: true }));

    const email = "admin@test.com";
    const newPassword = await bcrypt.hash("password123", 10);

    const user = await User.findOneAndUpdate(
      { email },
      { password: newPassword },
      { new: true }
    );

    if (user) {
      console.log(`✅ Password updated for ${email}`);
    } else {
      console.log(`❌ User with email ${email} not found`);
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("Update password error:", error);
    process.exit(1);
  }
};

updateUserPassword();
// seedUsers();
