import {
  Client,
  Account,
  Databases,
  Storage,
  Teams,
  ID,
  Permission,
  Role,
} from "appwrite";
import {
  Backend,
  User,
  Application,
  ApplicationInput,
  UploadedDocument,
  UploadedDocumentInput,
  FileUploadResult,
} from "./types";
import { formatPhoneNumber } from "./utils";

const client = new Client()
  .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT || "")
  .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID || "");

const account = new Account(client);
const databases = new Databases(client);
const storage = new Storage(client);
const teams = new Teams(client);

const DATABASE_ID = "spaza-db";
const APPLICATIONS_COLLECTION_ID = "applications";
const UPLOADED_DOCUMENTS_COLLECTION_ID = "uploaded_documents";
const STORAGE_BUCKET_ID = "application-files";

class AppwriteBackend implements Backend {
  private otpCooldowns = new Map<string, number>();

  private async getCurrentUser(): Promise<User | null> {
    try {
      const user = await account.get();
      return {
        id: user.$id,
        phone: user.phone || "",
        ownerName: user.name,
        phoneVerified: user.phoneVerification,
        isAdmin: false, // Will be determined by team membership
        email: user.email,
      };
    } catch {
      return null;
    }
  }

  auth = {
    requestPhoneOTP: async (
      phone: string,
    ): Promise<{ ok: boolean; cooldownUntil?: number }> => {
      const formattedPhone = formatPhoneNumber(phone);
      const cooldownUntil = this.otpCooldowns.get(formattedPhone);

      if (cooldownUntil && cooldownUntil > Date.now()) {
        return { ok: false, cooldownUntil };
      }

      try {
        await account.createPhoneToken(ID.unique(), formattedPhone);
        const newCooldownUntil = Date.now() + 60000; // 1 minute cooldown
        this.otpCooldowns.set(formattedPhone, newCooldownUntil);
        return { ok: true };
      } catch (error) {
        throw new Error("Failed to send OTP");
      }
    },

    verifyOTP: async (
      phone: string,
      code: string,
    ): Promise<{ user: User; sessionToken?: string }> => {
      const formattedPhone = formatPhoneNumber(phone);

      try {
        const session = await account.createSession(ID.unique(), code);
        const user = await this.getCurrentUser();

        if (!user) {
          throw new Error("Failed to get user after verification");
        }

        return { user, sessionToken: session.$id };
      } catch (error) {
        throw new Error("Invalid OTP");
      }
    },

    createEmailSession: async (
      email: string,
      password: string,
    ): Promise<{ user: User }> => {
      try {
        await account.createEmailPasswordSession(email, password);
        const user = await this.getCurrentUser();

        if (!user) {
          throw new Error("Failed to get user after login");
        }

        // Check if user is admin
        try {
          const memberships = await teams.listMemberships("admins");
          user.isAdmin = memberships.memberships.some(
            (m) => m.userId === user.id,
          );
        } catch {
          user.isAdmin = false;
        }

        return { user };
      } catch (error) {
        throw new Error("Invalid credentials");
      }
    },

    getCurrentUser: async (): Promise<User | null> => {
      const user = await this.getCurrentUser();
      if (user) {
        // Check admin status
        try {
          const memberships = await teams.listMemberships("admins");
          user.isAdmin = memberships.memberships.some(
            (m) => m.userId === user.id,
          );
        } catch {
          user.isAdmin = false;
        }
      }
      return user;
    },

    logout: async (): Promise<void> => {
      try {
        await account.deleteSession("current");
      } catch {
        // Ignore errors during logout
      }
    },
  };

  db = {
    createApplication: async (app: ApplicationInput): Promise<Application> => {
      const currentUser = await this.auth.getCurrentUser();
      if (!currentUser) throw new Error("Not authenticated");

      const doc = await databases.createDocument(
        DATABASE_ID,
        APPLICATIONS_COLLECTION_ID,
        ID.unique(),
        {
          ownerId: currentUser.id,
          ownerName: app.ownerName,
          phoneNumber: app.phoneNumber,
          tradeName: app.tradeName,
          location: app.location,
          formData: JSON.stringify(app.formData),
          status: "submitted",
        },
        [
          Permission.read(Role.user(currentUser.id)),
          Permission.read(Role.team("admins")),
        ],
      );

      return {
        id: doc.$id,
        ownerId: doc.ownerId,
        ownerName: doc.ownerName,
        phoneNumber: doc.phoneNumber,
        tradeName: doc.tradeName,
        location: doc.location,
        formData: doc.formData,
        status: doc.status,
        createdAt: doc.$createdAt,
        updatedAt: doc.$updatedAt,
      };
    },

    listApplications: async (filter?: {
      ownerId?: string;
      offset?: number;
      limit?: number;
      sort?: string;
    }): Promise<{ documents: Application[] }> => {
      const currentUser = await this.auth.getCurrentUser();
      if (!currentUser) throw new Error("Not authenticated");

      const queries = [];

      if (!currentUser.isAdmin && !filter?.ownerId) {
        queries.push(`ownerId="${currentUser.id}"`);
      } else if (filter?.ownerId) {
        queries.push(`ownerId="${filter.ownerId}"`);
      }

      const result = await databases.listDocuments(
        DATABASE_ID,
        APPLICATIONS_COLLECTION_ID,
        queries,
      );

      return {
        documents: result.documents.map((doc) => ({
          id: doc.$id,
          ownerId: doc.ownerId,
          ownerName: doc.ownerName,
          phoneNumber: doc.phoneNumber,
          tradeName: doc.tradeName,
          location: doc.location,
          formData: doc.formData,
          status: doc.status,
          createdAt: doc.$createdAt,
          updatedAt: doc.$updatedAt,
        })),
      };
    },

    getApplication: async (applicationId: string): Promise<Application> => {
      const doc = await databases.getDocument(
        DATABASE_ID,
        APPLICATIONS_COLLECTION_ID,
        applicationId,
      );

      return {
        id: doc.$id,
        ownerId: doc.ownerId,
        ownerName: doc.ownerName,
        phoneNumber: doc.phoneNumber,
        tradeName: doc.tradeName,
        location: doc.location,
        formData: doc.formData,
        status: doc.status,
        createdAt: doc.$createdAt,
        updatedAt: doc.$updatedAt,
      };
    },

    updateApplicationStatus: async (
      applicationId: string,
      status: "reviewing" | "approved" | "rejected",
    ): Promise<Application> => {
      const doc = await databases.updateDocument(
        DATABASE_ID,
        APPLICATIONS_COLLECTION_ID,
        applicationId,
        { status },
      );

      return {
        id: doc.$id,
        ownerId: doc.ownerId,
        ownerName: doc.ownerName,
        phoneNumber: doc.phoneNumber,
        tradeName: doc.tradeName,
        location: doc.location,
        formData: doc.formData,
        status: doc.status,
        createdAt: doc.$createdAt,
        updatedAt: doc.$updatedAt,
      };
    },

    createUploadedDocument: async (
      doc: UploadedDocumentInput,
    ): Promise<UploadedDocument> => {
      const result = await databases.createDocument(
        DATABASE_ID,
        UPLOADED_DOCUMENTS_COLLECTION_ID,
        ID.unique(),
        {
          applicationId: doc.applicationId,
          ownerId: doc.ownerId,
          documentType: doc.documentType,
          fileId: doc.fileId,
          filename: doc.filename,
        },
        [
          Permission.read(Role.user(doc.ownerId)),
          Permission.read(Role.team("admins")),
        ],
      );

      return {
        id: result.$id,
        applicationId: result.applicationId,
        ownerId: result.ownerId,
        documentType: result.documentType,
        fileId: result.fileId,
        filename: result.filename,
        uploadedAt: result.$createdAt,
      };
    },

    listUploadedDocuments: async (
      applicationId: string,
    ): Promise<UploadedDocument[]> => {
      const result = await databases.listDocuments(
        DATABASE_ID,
        UPLOADED_DOCUMENTS_COLLECTION_ID,
        [`applicationId="${applicationId}"`],
      );

      return result.documents.map((doc) => ({
        id: doc.$id,
        applicationId: doc.applicationId,
        ownerId: doc.ownerId,
        documentType: doc.documentType,
        fileId: doc.fileId,
        filename: doc.filename,
        uploadedAt: doc.$createdAt,
      }));
    },
  };

  storage = {
    uploadFile: async (
      file: File,
      ownerId: string,
      opts?: {
        filename?: string;
        documentType?: string;
        progress?: (p: number) => void;
      },
    ): Promise<FileUploadResult> => {
      const fileId = ID.unique();
      const filename = opts?.filename || file.name;

      await storage.createFile(STORAGE_BUCKET_ID, fileId, file, [
        Permission.read(Role.user(ownerId)),
        Permission.read(Role.team("admins")),
      ]);

      return { fileId, filename };
    },

    getFileURL: async (fileId: string, ownerId: string): Promise<string> => {
      const result = storage.getFileView(STORAGE_BUCKET_ID, fileId);
      return result.href;
    },
  };
}

export function createAppwriteBackend(): Backend {
  return new AppwriteBackend();
}

export { client, account, databases, storage, teams };
