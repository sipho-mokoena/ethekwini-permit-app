import {
  Client,
  Databases,
  Storage,
  Teams,
  ID,
  Permission,
  Role,
} from "appwrite";

// Initialize Appwrite client
const client = new Client();
const databases = new Databases(client);
const storage = new Storage(client);
const teams = new Teams(client);

// Configuration
const DATABASE_ID = "spaza-db";
const APPLICATIONS_COLLECTION_ID = "applications";
const UPLOADED_DOCUMENTS_COLLECTION_ID = "uploaded_documents";
const STORAGE_BUCKET_ID = "application-files";

async function createCollections() {
  try {
    // Set endpoint and project from environment variables
    const endpoint = process.env.VITE_APPWRITE_ENDPOINT;
    const projectId = process.env.VITE_APPWRITE_PROJECT_ID;

    if (!endpoint || !projectId) {
      throw new Error(
        "Please set VITE_APPWRITE_ENDPOINT and VITE_APPWRITE_PROJECT_ID environment variables",
      );
    }

    client.setEndpoint(endpoint).setProject(projectId);

    console.log("Creating Appwrite collections and storage bucket...");

    // Create database
    try {
      await databases.create(DATABASE_ID, "Spaza Registration Database");
      console.log("✓ Database created");
    } catch (error: any) {
      if (error.code === 409) {
        console.log("✓ Database already exists");
      } else {
        throw error;
      }
    }

    // Create applications collection
    try {
      await databases.createCollection(
        DATABASE_ID,
        APPLICATIONS_COLLECTION_ID,
        "Applications",
        [
          Permission.create(Role.users()),
          Permission.read(Role.users()),
          Permission.read(Role.team("admins")),
          Permission.update(Role.team("admins")),
          Permission.delete(Role.team("admins")),
        ],
      );
      console.log("✓ Applications collection created");

      // Create attributes for applications collection
      const applicationAttributes = [
        { key: "ownerId", type: "string", size: 255, required: true },
        { key: "ownerName", type: "string", size: 255, required: true },
        { key: "phoneNumber", type: "string", size: 50, required: true },
        { key: "tradeName", type: "string", size: 255, required: true },
        { key: "location", type: "string", size: 500, required: false },
        { key: "formData", type: "string", size: 10000, required: true },
        {
          key: "status",
          type: "enum",
          elements: ["submitted", "reviewing", "approved", "rejected"],
          required: true,
          default: "submitted",
        },
      ];

      for (const attr of applicationAttributes) {
        if (attr.type === "enum") {
          await databases.createEnumAttribute(
            DATABASE_ID,
            APPLICATIONS_COLLECTION_ID,
            attr.key,
            attr.elements!,
            attr.required,
            attr.default,
          );
        } else {
          await databases.createStringAttribute(
            DATABASE_ID,
            APPLICATIONS_COLLECTION_ID,
            attr.key,
            attr.size!,
            attr.required,
            attr.default,
          );
        }
        console.log(`  ✓ Added ${attr.key} attribute`);
      }
    } catch (error: any) {
      if (error.code === 409) {
        console.log("✓ Applications collection already exists");
      } else {
        throw error;
      }
    }

    // Create uploaded_documents collection
    try {
      await databases.createCollection(
        DATABASE_ID,
        UPLOADED_DOCUMENTS_COLLECTION_ID,
        "Uploaded Documents",
        [
          Permission.create(Role.users()),
          Permission.read(Role.users()),
          Permission.read(Role.team("admins")),
          Permission.update(Role.team("admins")),
          Permission.delete(Role.team("admins")),
        ],
      );
      console.log("✓ Uploaded documents collection created");

      // Create attributes for uploaded_documents collection
      const documentAttributes = [
        { key: "applicationId", type: "string", size: 255, required: true },
        { key: "ownerId", type: "string", size: 255, required: true },
        { key: "documentType", type: "string", size: 100, required: true },
        { key: "fileId", type: "string", size: 255, required: true },
        { key: "filename", type: "string", size: 255, required: true },
      ];

      for (const attr of documentAttributes) {
        await databases.createStringAttribute(
          DATABASE_ID,
          UPLOADED_DOCUMENTS_COLLECTION_ID,
          attr.key,
          attr.size,
          attr.required,
        );
        console.log(`  ✓ Added ${attr.key} attribute`);
      }
    } catch (error: any) {
      if (error.code === 409) {
        console.log("✓ Uploaded documents collection already exists");
      } else {
        throw error;
      }
    }

    // Create storage bucket
    try {
      await storage.createBucket(
        STORAGE_BUCKET_ID,
        "Application Files",
        [
          Permission.create(Role.users()),
          Permission.read(Role.users()),
          Permission.read(Role.team("admins")),
          Permission.update(Role.team("admins")),
          Permission.delete(Role.team("admins")),
        ],
        false, // not file security (we'll use permissions)
        true, // enabled
        8 * 1024 * 1024, // 8MB max file size
        ["image/jpeg", "image/png", "image/gif", "application/pdf"], // allowed file types
        "none", // no compression
        false, // no encryption
        false, // no antivirus
      );
      console.log("✓ Storage bucket created");
    } catch (error: any) {
      if (error.code === 409) {
        console.log("✓ Storage bucket already exists");
      } else {
        throw error;
      }
    }

    // Create admins team
    try {
      await teams.create("admins", "Administrators");
      console.log("✓ Admins team created");
    } catch (error: any) {
      if (error.code === 409) {
        console.log("✓ Admins team already exists");
      } else {
        throw error;
      }
    }

    console.log(
      "\n🎉 All collections and storage bucket created successfully!",
    );
    console.log("\nNext steps:");
    console.log("1. Create an admin user in the Appwrite console");
    console.log('2. Add the admin user to the "admins" team');
    console.log(
      "3. Update your .env file with the correct endpoint and project ID",
    );
  } catch (error) {
    console.error("❌ Error creating collections:", error);
    process.exit(1);
  }
}

// Run the setup
createCollections();
