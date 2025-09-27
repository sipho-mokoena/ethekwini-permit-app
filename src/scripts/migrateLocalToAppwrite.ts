import {
  Account,
  Client,
  Databases,
  ID,
  Permission,
  Role,
  Storage,
} from "appwrite";
import { openDB } from "idb";

// Appwrite configuration
const client = new Client();
const account = new Account(client);
const databases = new Databases(client);
const storage = new Storage(client);

const DATABASE_ID = "spaza-db";
const APPLICATIONS_COLLECTION_ID = "applications";
const UPLOADED_DOCUMENTS_COLLECTION_ID = "uploaded_documents";
const STORAGE_BUCKET_ID = "application-files";

interface LocalUser {
  id: string;
  phone: string;
  ownerName?: string;
  phoneVerified: boolean;
  isAdmin: boolean;
  email?: string;
}

interface LocalApplication {
  id: string;
  ownerId: string;
  ownerName: string;
  phoneNumber: string;
  tradeName: string;
  location?: string;
  formData: string;
  status: "submitted" | "reviewing" | "approved" | "rejected";
  createdAt: string;
  updatedAt: string;
}

interface LocalUploadedDocument {
  id: string;
  applicationId: string;
  ownerId: string;
  documentType: string;
  fileId: string;
  filename: string;
  uploadedAt: string;
}

interface LocalFile {
  fileId: string;
  ownerId: string;
  filename: string;
  blob: Blob;
  uploadedAt: string;
}

async function migrateLocalToAppwrite() {
  try {
    // Get configuration from environment
    const endpoint = process.env.VITE_APPWRITE_ENDPOINT;
    const projectId = process.env.VITE_APPWRITE_PROJECT_ID;
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!endpoint || !projectId) {
      throw new Error(
        "Please set VITE_APPWRITE_ENDPOINT and VITE_APPWRITE_PROJECT_ID environment variables",
      );
    }

    if (!adminEmail || !adminPassword) {
      throw new Error(
        "Please set ADMIN_EMAIL and ADMIN_PASSWORD environment variables for authentication",
      );
    }

    client.setEndpoint(endpoint).setProject(projectId);

    console.log("🔐 Authenticating with Appwrite...");
    await account.createEmailPasswordSession(adminEmail, adminPassword);
    console.log("✓ Authenticated successfully");

    // Open local IndexedDB
    console.log("📂 Opening local database...");
    const localDb = await openDB("spaza-db", 1);

    // Get all data from local storage
    const users = (await localDb.getAll("users")) as LocalUser[];
    const applications = (await localDb.getAll(
      "applications",
    )) as LocalApplication[];
    const uploadedDocuments = (await localDb.getAll(
      "uploaded_documents",
    )) as LocalUploadedDocument[];
    const files = (await localDb.getAll("files")) as LocalFile[];

    console.log(
      `📊 Found ${users.length} users, ${applications.length} applications, ${uploadedDocuments.length} documents, ${files.length} files`,
    );

    // Migrate files first
    console.log("📁 Migrating files...");
    const fileIdMapping: Record<string, string> = {};

    for (const file of files) {
      try {
        const newFileId = ID.unique();

        // Convert blob to File object
        const fileObj = new File([file.blob], file.filename, {
          type: file.blob.type,
          lastModified: new Date(file.uploadedAt).getTime(),
        });

        await storage.createFile(STORAGE_BUCKET_ID, newFileId, fileObj, [
          Permission.read(Role.user(file.ownerId)),
          Permission.read(Role.team("admins")),
        ]);

        fileIdMapping[file.fileId] = newFileId;
        console.log(`  ✓ Migrated file: ${file.filename}`);
      } catch (error) {
        console.error(`  ❌ Failed to migrate file ${file.filename}:`, error);
      }
    }

    // Migrate applications
    console.log("📋 Migrating applications...");
    const applicationIdMapping: Record<string, string> = {};

    for (const app of applications) {
      try {
        const newAppId = ID.unique();

        await databases.createDocument(
          DATABASE_ID,
          APPLICATIONS_COLLECTION_ID,
          newAppId,
          {
            ownerId: app.ownerId,
            ownerName: app.ownerName,
            phoneNumber: app.phoneNumber,
            tradeName: app.tradeName,
            location: app.location || "",
            formData: app.formData,
            status: app.status,
          },
          [
            Permission.read(Role.user(app.ownerId)),
            Permission.read(Role.team("admins")),
          ],
        );

        applicationIdMapping[app.id] = newAppId;
        console.log(`  ✓ Migrated application: ${app.tradeName}`);
      } catch (error) {
        console.error(
          `  ❌ Failed to migrate application ${app.tradeName}:`,
          error,
        );
      }
    }

    // Migrate uploaded documents
    console.log("📄 Migrating uploaded documents...");

    for (const doc of uploadedDocuments) {
      try {
        const newAppId = applicationIdMapping[doc.applicationId];
        const newFileId = fileIdMapping[doc.fileId];

        if (!newAppId || !newFileId) {
          console.warn(
            `  ⚠️  Skipping document ${doc.filename} - missing application or file mapping`,
          );
          continue;
        }

        await databases.createDocument(
          DATABASE_ID,
          UPLOADED_DOCUMENTS_COLLECTION_ID,
          ID.unique(),
          {
            applicationId: newAppId,
            ownerId: doc.ownerId,
            documentType: doc.documentType,
            fileId: newFileId,
            filename: doc.filename,
          },
          [
            Permission.read(Role.user(doc.ownerId)),
            Permission.read(Role.team("admins")),
          ],
        );

        console.log(`  ✓ Migrated document: ${doc.filename}`);
      } catch (error) {
        console.error(
          `  ❌ Failed to migrate document ${doc.filename}:`,
          error,
        );
      }
    }

    console.log("\n🎉 Migration completed successfully!");
    console.log("\nSummary:");
    console.log(`- ${Object.keys(fileIdMapping).length} files migrated`);
    console.log(
      `- ${Object.keys(applicationIdMapping).length} applications migrated`,
    );
    console.log(`- ${uploadedDocuments.length} document records processed`);

    // Logout
    await account.deleteSession("current");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateLocalToAppwrite();
}

export { migrateLocalToAppwrite };
