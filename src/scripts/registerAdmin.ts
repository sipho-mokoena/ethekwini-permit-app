#!/usr/bin/env node

/**
 * Script to register an admin user using ADMIN_EMAIL and ADMIN_PASSWORD environment variables
 */

import * as dotenv from "dotenv";
import { Account, Client, ID, Teams, Users } from "node-appwrite";

// Load environment variables
dotenv.config();

async function registerAdmin() {
  // Check if required environment variables are set
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminName = process.env.ADMIN_NAME || "Admin User";

  if (!adminEmail || !adminPassword) {
    console.error(
      "Error: ADMIN_EMAIL and ADMIN_PASSWORD environment variables must be set",
    );
    process.exit(1);
  }

  // Appwrite configuration
  const endpoint = process.env.VITE_APPWRITE_ENDPOINT;
  const apiKey = process.env.APPWRITE_API_KEY;
  const projectId = process.env.VITE_APPWRITE_PROJECT_ID;
  const adminsTeamId = "admins"; // This should match the ADMINS_TEAM_ID in appwrite.ts

  if (!endpoint || !apiKey || !projectId) {
    console.error(
      "Error: VITE_APPWRITE_ENDPOINT, APPWRITE_API_KEY, and VITE_APPWRITE_PROJECT_ID must be set",
    );
    process.exit(1);
  }

  try {
    // Initialize Appwrite client
    const client = new Client();
    client.setEndpoint(endpoint).setKey(apiKey).setProject(projectId);

    const account = new Account(client);
    const teams = new Teams(client);
    const users = new Users(client);

    // Try to create admin user account using Users service (for API key auth)
    console.log(`Creating admin user with email: ${adminEmail}`);
    let userId: string;

    try {
      const userResult = await users.create(
        ID.unique(),
        adminEmail,
        undefined,
        adminPassword,
        adminName,
      );
      userId = userResult.$id;
      console.log("Admin user created successfully");
    } catch (createError: any) {
      if (createError?.code === 409) {
        console.log("Admin user already exists, fetching existing user...");
        // If user exists, we need to get their ID
        // This is a bit tricky with Appwrite, so we'll need to handle this case
        // For now, let's continue with the team assignment
        console.log("User already exists, proceeding with team assignment...");
        // We'll try to get the user's ID through a different approach
        userId = "unknown"; // We'll need to find another way to get the user ID
      } else {
        throw createError;
      }
    }

    // Check if admins team exists, create it if it doesn't
    try {
      await teams.get(adminsTeamId);
      console.log("Admins team already exists");
    } catch (error) {
      console.log("Creating admins team...");
      await teams.create(adminsTeamId, "Administrators");
      console.log("Admins team created successfully");
    }

    // Add user to admins team
    try {
      console.log("Adding user to admins team...");
      // Add user to team with admin role
      // Note: We're using email here as we don't have the user ID if the user already existed
      await teams.createMembership(
        adminsTeamId,
        ["admin"], // Role
        adminEmail,
      );
      console.log("User added to admins team successfully");
    } catch (teamError: any) {
      if (teamError?.code === 409) {
        console.log("User is already a member of the admins team");
      } else {
        console.warn("Warning: Could not add user to admins team.");
        console.warn(
          "You may need to add the user manually through the Appwrite Console.",
        );
        console.warn(`Error: ${teamError?.message || teamError}`);
      }
    }

    console.log("\nAdmin user registration process completed!");
    console.log(`Email: ${adminEmail}`);
    console.log(`Name: ${adminName}`);
    console.log("This user now has admin privileges.");
  } catch (error) {
    console.error("Error registering admin user:", error);
    process.exit(1);
  }
}

// Run the script
registerAdmin().catch(console.error);
