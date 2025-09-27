import "dotenv/config";
import fs from "node:fs";
import os from "node:os";
import path, { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { openDB } from "idb";
import {
  AppwriteException,
  Client,
  Databases,
  ID,
  Permission,
  Role,
  Storage,
} from "node-appwrite";

// Appwrite configuration (Node SDK using API Key)
const client = new Client();
const databases = new Databases(client);
const storage = new Storage(client);

const DATABASE_ID = "spaza-db";
const APPLICATIONS_COLLECTION_ID = "applications";
const UPLOADED_DOCUMENTS_COLLECTION_ID = "uploaded_documents";
const STORAGE_BUCKET_ID = "application-files";

// Minimal blob-like type to avoid DOM dependency in Node
type BrowserBlob = {
  arrayBuffer: () => Promise<ArrayBuffer>;
  type?: string;
};

// Structural type to call Node SDK createFile without DOM File typing conflicts
type StorageCompat = {
  createFile: (
    bucketId: string,
    fileId: string,
    file: unknown,
    permissions?: unknown,
  ) => Promise<unknown>;
};

interface LocalUser {
  id: string;
  phone: string;
  ownerName?: string;
  phoneVerified: boolean;
  isAdmin: boolean;
  email?: string;
  password?: string;
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
  blob?: BrowserBlob; // present when reading directly from IndexedDB in browser env
  base64?: string; // present when using JSON export
  mimeType?: string; // present when using JSON export
  uploadedAt: string;
}

async function migrateLocalToAppwrite() {
  try {
    // Get configuration from environment (prefer server-side vars if provided)
    const endpoint =
      process.env.APPWRITE_ENDPOINT ?? process.env.VITE_APPWRITE_ENDPOINT;
    const projectId =
      process.env.APPWRITE_PROJECT_ID ?? process.env.VITE_APPWRITE_PROJECT_ID;
    const apiKey = process.env.APPWRITE_API_KEY;

    if (!endpoint || !projectId || !apiKey) {
      throw new Error(
        "Missing APPWRITE_ENDPOINT/VITE_APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID/VITE_APPWRITE_PROJECT_ID, or APPWRITE_API_KEY.",
      );
    }

    client.setEndpoint(endpoint).setProject(projectId).setKey(apiKey);

    console.log("🔐 Using Appwrite API Key authentication (server-side)…");
    console.log("✓ Auth configured");

    // Load data from a JSON export if provided; otherwise try IndexedDB (likely empty in Node)
    let users: LocalUser[] = [];
    let applications: LocalApplication[] = [];
    let uploadedDocuments: LocalUploadedDocument[] = [];
    let files: LocalFile[] = [];

    // Support --json path or MIGRATION_JSON env var
    const argvJsonIndex = process.argv.findIndex((a) => a === "--json");
    const jsonPathArg =
      argvJsonIndex > -1 ? process.argv[argvJsonIndex + 1] : undefined;
    const jsonPath = process.env.MIGRATION_JSON || jsonPathArg;

    if (jsonPath) {
      console.log(`📄 Loading migration data from JSON: ${jsonPath}`);
      const raw = await fs.promises.readFile(jsonPath, "utf-8");
      const payload = JSON.parse(raw) as {
        users?: LocalUser[];
        applications?: LocalApplication[];
        uploaded_documents?: LocalUploadedDocument[];
        files?: Array<
          Omit<LocalFile, "blob"> & { base64: string; mimeType: string }
        >;
      };

      users = payload.users ?? [];
      applications = payload.applications ?? [];
      uploadedDocuments = payload.uploaded_documents ?? [];
      files = (payload.files ?? []) as LocalFile[];
    } else {
      try {
        console.log("📂 Opening local database (IndexedDB)…");
        const localDb = await openDB("spaza-db", 1);
        users = (await localDb.getAll("users")) as LocalUser[];
        applications = (await localDb.getAll(
          "applications",
        )) as LocalApplication[];
        uploadedDocuments = (await localDb.getAll(
          "uploaded_documents",
        )) as LocalUploadedDocument[];
        files = (await localDb.getAll("files")) as LocalFile[];
      } catch {
        console.warn(
          "⚠️ IndexedDB is not accessible in Node. Provide a JSON export via MIGRATION_JSON env or --json <path>.",
        );
      }
    }

    console.log(
      `📊 Found ${users.length} users, ${applications.length} applications, ${uploadedDocuments.length} documents, ${files.length} files`,
    );

    if (
      users.length === 0 &&
      applications.length === 0 &&
      uploadedDocuments.length === 0 &&
      files.length === 0
    ) {
      console.warn(
        "⚠️ No local data found. This script runs in Node and cannot access your browser's IndexedDB. Export your local data to JSON in the browser and re-run this script with that file, or run a browser-based migration.",
      );
      console.warn(
        "Tip: Implement an in-app export, then modify this script to read the exported JSON instead of IndexedDB.",
      );
    }

    // Migrate files first
    console.log("📁 Migrating files...");
    const fileIdMapping: Record<string, string> = {};

    for (const file of files) {
      try {
        const newFileId = ID.unique();

        // Prepare a temp file for upload
        let buffer: Buffer | null = null;
        if (file.base64) {
          buffer = Buffer.from(file.base64, "base64");
        } else if (file.blob) {
          const arrayBuffer = await file.blob.arrayBuffer();
          buffer = Buffer.from(arrayBuffer);
        }

        if (!buffer) {
          console.warn(
            `  ⚠️ Skipping file ${file.filename} - no data available`,
          );
          continue;
        }

        const tmpDir = await fs.promises.mkdtemp(
          path.join(os.tmpdir(), "appwrite-mig-"),
        );
        const tmpPath = path.join(tmpDir, file.filename || `${newFileId}`);
        await fs.promises.writeFile(tmpPath, buffer);

        try {
          const stream = fs.createReadStream(tmpPath);
          await (storage as unknown as StorageCompat).createFile(
            STORAGE_BUCKET_ID,
            newFileId,
            stream,
            [Permission.read(Role.team("admins"))],
          );
        } finally {
          // Cleanup temp file
          try {
            await fs.promises.rm(tmpDir, { recursive: true, force: true });
          } catch {
            /* ignore */
          }
        }

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
          [Permission.read(Role.team("admins"))],
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
          [Permission.read(Role.team("admins"))],
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

    console.log(
      "\nNote: Documents and files were created with read access for the 'admins' team only to avoid invalid user references during migration.",
    );
  } catch (error) {
    if (error instanceof AppwriteException) {
      console.error(
        `❌ Migration failed: AppwriteException(${error.code} ${error.type}): ${error.message}`,
      );
    } else {
      console.error("❌ Migration failed:", error);
    }
    process.exit(1);
  }
}

// Run migration if called directly
const isDirectRun =
  typeof process !== "undefined" &&
  typeof import.meta !== "undefined" &&
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  migrateLocalToAppwrite();
}

export { migrateLocalToAppwrite };
