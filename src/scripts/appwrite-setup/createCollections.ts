import "dotenv/config";
import {
  AppwriteException,
  Client,
  Databases,
  Permission,
  Role,
  Storage,
  Teams,
} from "node-appwrite";

const DATABASE_ID = "spaza-db";
const APPLICATIONS_COLLECTION_ID = "applications";
const UPLOADED_DOCUMENTS_COLLECTION_ID = "uploaded_documents";
const STORAGE_BUCKET_ID = "application-files";
const ADMINS_TEAM_ID = "admins";

const client = new Client();
const databases = new Databases(client);
const storage = new Storage(client);
const teams = new Teams(client);

function isConflict(error: unknown): boolean {
  return error instanceof AppwriteException && error.code === 409;
}

async function ensureDatabase() {
  try {
    await databases.get(DATABASE_ID);
    console.log("✓ Database already exists");
    return;
  } catch (error) {
    if (
      !(error instanceof AppwriteException) ||
      (error instanceof AppwriteException && error.code !== 404)
    ) {
      throw error;
    }
  }

  try {
    await databases.create(DATABASE_ID, "Spaza Registration Database");
    console.log("✓ Database created");
  } catch (error) {
    if (isConflict(error)) {
      console.log("✓ Database already exists");
      return;
    }

    if (
      error instanceof AppwriteException &&
      error.code === 403 &&
      error.type === "additional_resource_not_allowed"
    ) {
      console.log("✓ Database already exists (plan limit reached)");
      return;
    }

    throw error;
  }
}

async function ensureApplicationsCollection() {
  try {
    await databases.createCollection(
      DATABASE_ID,
      APPLICATIONS_COLLECTION_ID,
      "Applications",
      [
        Permission.create(Role.users()),
        Permission.read(Role.users()),
        Permission.read(Role.team(ADMINS_TEAM_ID)),
        Permission.update(Role.team(ADMINS_TEAM_ID)),
        Permission.delete(Role.team(ADMINS_TEAM_ID)),
      ],
      false,
    );
    console.log("✓ Applications collection created");
  } catch (error) {
    if (!isConflict(error)) {
      throw error;
    }
    console.log("✓ Applications collection already exists");
  }

  const existingAttributeKeys = new Set<string>();
  try {
    const collection = await databases.getCollection(
      DATABASE_ID,
      APPLICATIONS_COLLECTION_ID,
    );

    if (Array.isArray(collection.attributes)) {
      for (const attribute of collection.attributes as Array<{ key?: string }>) {
        if (attribute?.key) {
          existingAttributeKeys.add(attribute.key);
        }
      }
    }
  } catch (error) {
    if (
      !(error instanceof AppwriteException) ||
      (error instanceof AppwriteException && error.code !== 404)
    ) {
      throw error;
    }
  }

  const attributes: Array<
    | {
        kind: "enum";
        key: string;
        elements: string[];
        required: boolean;
        default?: string;
      }
    | {
        kind: "string";
        key: string;
        size: number;
        required: boolean;
        default?: string;
      }
  > = [
    { kind: "string", key: "ownerId", size: 255, required: true },
    { kind: "string", key: "ownerName", size: 255, required: true },
    { kind: "string", key: "phoneNumber", size: 50, required: true },
    { kind: "string", key: "tradeName", size: 255, required: true },
    { kind: "string", key: "location", size: 500, required: false },
    { kind: "string", key: "formData", size: 10_000, required: true },
    {
      kind: "enum",
      key: "status",
      elements: ["submitted", "reviewing", "approved", "rejected"],
      required: true,
    },
  ];

  for (const attribute of attributes) {
    if (existingAttributeKeys.has(attribute.key)) {
      console.log(`  ✓ ${attribute.key} attribute already exists`);
      continue;
    }

    try {
      if (attribute.kind === "enum") {
        await databases.createEnumAttribute(
          DATABASE_ID,
          APPLICATIONS_COLLECTION_ID,
          attribute.key,
          attribute.elements,
          attribute.required,
          attribute.default,
        );
      } else {
        await databases.createStringAttribute(
          DATABASE_ID,
          APPLICATIONS_COLLECTION_ID,
          attribute.key,
          attribute.size,
          attribute.required,
          attribute.default,
        );
      }
      console.log(`  ✓ ${attribute.key} attribute ready`);
    } catch (error) {
      if (!isConflict(error)) {
        throw error;
      }
    }
  }
}

async function ensureDocumentsCollection() {
  try {
    await databases.createCollection(
      DATABASE_ID,
      UPLOADED_DOCUMENTS_COLLECTION_ID,
      "Uploaded Documents",
      [
        Permission.create(Role.users()),
        Permission.read(Role.users()),
        Permission.read(Role.team(ADMINS_TEAM_ID)),
        Permission.update(Role.team(ADMINS_TEAM_ID)),
        Permission.delete(Role.team(ADMINS_TEAM_ID)),
      ],
      false,
    );
    console.log("✓ Uploaded documents collection created");
  } catch (error) {
    if (!isConflict(error)) {
      throw error;
    }
    console.log("✓ Uploaded documents collection already exists");
  }

  const attributes = [
    { key: "applicationId", size: 255 },
    { key: "ownerId", size: 255 },
    { key: "documentType", size: 100 },
    { key: "fileId", size: 255 },
    { key: "filename", size: 255 },
  ];

  for (const attribute of attributes) {
    try {
      await databases.createStringAttribute(
        DATABASE_ID,
        UPLOADED_DOCUMENTS_COLLECTION_ID,
        attribute.key,
        attribute.size,
        true,
      );
      console.log(`  ✓ ${attribute.key} attribute ready`);
    } catch (error) {
      if (!isConflict(error)) {
        throw error;
      }
    }
  }
}

async function ensureStorageBucket() {
  try {
    await storage.createBucket(
      STORAGE_BUCKET_ID,
      "Application Files",
      [
        Permission.create(Role.users()),
        Permission.read(Role.users()),
        Permission.read(Role.team(ADMINS_TEAM_ID)),
        Permission.update(Role.team(ADMINS_TEAM_ID)),
        Permission.delete(Role.team(ADMINS_TEAM_ID)),
      ],
      false,
      true,
      8 * 1024 * 1024,
      ["jpg", "jpeg", "png", "gif", "pdf"],
      undefined,
      true,
      true,
    );
    console.log("✓ Storage bucket created");
  } catch (error) {
    if (!isConflict(error)) {
      throw error;
    }
    console.log("✓ Storage bucket already exists");
  }
}

async function ensureAdminsTeam() {
  try {
    await teams.create(ADMINS_TEAM_ID, "Administrators");
    console.log("✓ Admins team created");
  } catch (error) {
    if (!isConflict(error)) {
      throw error;
    }
    console.log("✓ Admins team already exists");
  }
}

async function main() {
  const endpoint =
    process.env.APPWRITE_ENDPOINT ?? process.env.VITE_APPWRITE_ENDPOINT;
  const projectId =
    process.env.APPWRITE_PROJECT_ID ?? process.env.VITE_APPWRITE_PROJECT_ID;
  const apiKey = process.env.APPWRITE_API_KEY;

  if (!endpoint || !projectId || !apiKey) {
    throw new Error(
      "Missing APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, or APPWRITE_API_KEY environment variables.",
    );
  }

  client.setEndpoint(endpoint).setProject(projectId).setKey(apiKey);

  console.log("Starting Appwrite project provisioning...\n");
  await ensureDatabase();
  await ensureApplicationsCollection();
  await ensureDocumentsCollection();
  await ensureStorageBucket();
  await ensureAdminsTeam();

  console.log("\n🎉 Appwrite project is ready!");
  console.log("Next steps:");
  console.log("1. Create an admin account in the Appwrite Console.");
  console.log(
    `2. Add the admin user to the "${ADMINS_TEAM_ID}" team via the Console or REST API.`,
  );
  console.log("3. Update your .env file with the correct frontend credentials.");
}

main().catch((error) => {
  console.error("❌ Error while provisioning Appwrite:", error);
  process.exit(1);
});
