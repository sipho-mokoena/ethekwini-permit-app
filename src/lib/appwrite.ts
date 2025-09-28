import type { Models } from "appwrite";
import {
  Account,
  Client,
  Databases,
  ID,
  Permission,
  Query,
  Role,
  Storage,
  Teams,
} from "appwrite";
import type {
  Application,
  ApplicationInput,
  Backend,
  FileUploadResult,
  LoginInput,
  RegisterInput,
  UploadedDocument,
  UploadedDocumentInput,
  User,
} from "./types";
import { formatPhoneNumber } from "./utils";

const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT ?? "";
const projectId = import.meta.env.VITE_APPWRITE_PROJECT_ID ?? "";

const client = new Client();
if (endpoint) {
  client.setEndpoint(endpoint);
}
if (projectId) {
  client.setProject(projectId);
}

const account = new Account(client);
const databases = new Databases(client);
const storage = new Storage(client);
const teams = new Teams(client);

const DATABASE_ID = "spaza-db";
const APPLICATIONS_COLLECTION_ID = "applications";
const UPLOADED_DOCUMENTS_COLLECTION_ID = "uploaded_documents";
const STORAGE_BUCKET_ID = "application-files";
const ADMINS_TEAM_ID = "admins";

type ApplicationDocument = Models.Document & {
  ownerId: string;
  ownerName: string;
  phoneNumber: string;
  tradeName: string;
  location?: string;
  formData: string;
  status: "submitted" | "reviewing" | "approved" | "rejected";
};

type UploadedDocumentRecord = Models.Document & {
  applicationId: string;
  ownerId: string;
  documentType: string;
  fileId: string;
  filename: string;
};

class AppwriteBackend implements Backend {
  private async enrichUser(
    rawUser: Models.User<Models.Preferences>,
  ): Promise<User> {
    const isAdmin = await this.isUserAdmin(rawUser.$id);
    const prefs = (rawUser.prefs ?? {}) as Record<string, unknown>;
    const prefPhone = typeof prefs.phone === "string" ? prefs.phone : undefined;
    const prefOwnerName =
      typeof prefs.ownerName === "string" ? prefs.ownerName : undefined;
    const phone = (prefPhone ?? rawUser.phone ?? "").trim();
    const ownerName = (rawUser.name?.trim() || prefOwnerName)?.trim();

    return {
      id: rawUser.$id,
      phone,
      ownerName,
      phoneVerified: true,
      isAdmin,
      email: rawUser.email,
    };
  }

  private async isUserAdmin(userId: string): Promise<boolean> {
    try {
      const memberships = await teams.listMemberships(ADMINS_TEAM_ID, [
        Query.equal("userId", userId),
      ]);
      return memberships.total > 0;
    } catch {
      return false;
    }
  }

  private async getAuthedUser(): Promise<User | null> {
    try {
      const rawUser = await account.get();
      return await this.enrichUser(rawUser);
    } catch {
      return null;
    }
  }

  auth = {
    register: async (input: RegisterInput): Promise<{ user: User }> => {
      const email = input.email.trim();
      const ownerName = input.ownerName.trim();
      const phone = input.phone.trim();
      try {
        const uid = ID.unique();
        await account.create(uid, email, input.password, ownerName);
      } catch (error) {
        if (error instanceof Error) {
          throw new Error(
            error.message.includes("already")
              ? "An account with this email already exists"
              : "Failed to create account",
          );
        }
        throw new Error("Failed to create account");
      }

      try {
        await account.createEmailPasswordSession(email, input.password);
      } catch {
        throw new Error(
          "Account created but failed to sign in. Please try logging in.",
        );
      }

      try {
        await account.updatePrefs({
          phone: formatPhoneNumber(phone),
          ownerName,
        });
      } catch {
        // Preference updates are non-critical
      }

      const rawUser = await account.get();
      const user = await this.enrichUser(rawUser);
      return { user };
    },

    login: async (credentials: LoginInput): Promise<{ user: User }> => {
      try {
        await account.createEmailPasswordSession(
          credentials.email.trim(),
          credentials.password,
        );
        const rawUser = await account.get();
        const user = await this.enrichUser(rawUser);
        return { user };
      } catch {
        throw new Error("Invalid email or password");
      }
    },

    getCurrentUser: async (): Promise<User | null> => {
      return await this.getAuthedUser();
    },

    logout: async (): Promise<void> => {
      try {
        await account.deleteSession("current");
      } catch {
        /* noop */
      }
    },
  };

  db = {
    createApplication: async (app: ApplicationInput): Promise<Application> => {
      const currentUser = await this.auth.getCurrentUser();
      if (!currentUser) throw new Error("Not authenticated");

      const duplicates = await databases.listDocuments<ApplicationDocument>(
        DATABASE_ID,
        APPLICATIONS_COLLECTION_ID,
        [
          Query.equal("ownerId", currentUser.id),
          Query.equal("tradeName", app.tradeName.trim()),
          Query.equal("status", "submitted"),
        ],
      );

      if (duplicates.total > 0) {
        throw new Error(
          "You already have a submitted application for this trade name.",
        );
      }

      // Prepare permissions using the correct format
      const permissions = [
        Permission.read(Role.user(currentUser.id)),
        Permission.update(Role.user(currentUser.id)),
        Permission.delete(Role.user(currentUser.id)),
        Permission.read(Role.users()),
      ];

      // Only add team permissions if user is admin
      if (currentUser.isAdmin) {
        try {
          await teams.get(ADMINS_TEAM_ID);
          permissions.push(
            Permission.read(Role.team(ADMINS_TEAM_ID)),
            Permission.update(Role.team(ADMINS_TEAM_ID)),
            Permission.delete(Role.team(ADMINS_TEAM_ID)),
          );
        } catch (error) {
          // If team doesn't exist, log but continue
          console.debug("Admin team not found:", error);
        }
      }

      const doc = await databases.createDocument<ApplicationDocument>(
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
        permissions,
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

      const queries: string[] = [Query.orderDesc("$createdAt")];

      if (!currentUser.isAdmin && !filter?.ownerId) {
        queries.push(Query.equal("ownerId", currentUser.id));
      } else if (filter?.ownerId) {
        queries.push(Query.equal("ownerId", filter.ownerId));
      }

      if (typeof filter?.limit === "number") {
        queries.push(Query.limit(filter.limit));
      }

      if (typeof filter?.offset === "number") {
        queries.push(Query.offset(filter.offset));
      }

      const result = await databases.listDocuments<ApplicationDocument>(
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
      const doc = await databases.getDocument<ApplicationDocument>(
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
      const doc = await databases.updateDocument<ApplicationDocument>(
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
      const currentUser = await this.auth.getCurrentUser();
      if (!currentUser) throw new Error("Not authenticated");

      // Prepare permissions using the correct format
      const permissions = [
        Permission.read(Role.user(doc.ownerId)),
        Permission.update(Role.user(doc.ownerId)),
        Permission.delete(Role.user(doc.ownerId)),
        Permission.read(Role.users()),
      ];

      // Only add team permissions if user is admin
      if (currentUser.isAdmin) {
        try {
          await teams.get(ADMINS_TEAM_ID);
          permissions.push(
            Permission.read(Role.team(ADMINS_TEAM_ID)),
            Permission.update(Role.team(ADMINS_TEAM_ID)),
            Permission.delete(Role.team(ADMINS_TEAM_ID)),
          );
        } catch (error) {
          // If team doesn't exist, log but continue
          console.debug("Admin team not found:", error);
        }
      }

      const result = await databases.createDocument<UploadedDocumentRecord>(
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
        permissions,
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
      const result = await databases.listDocuments<UploadedDocumentRecord>(
        DATABASE_ID,
        UPLOADED_DOCUMENTS_COLLECTION_ID,
        [
          Query.equal("applicationId", applicationId),
          Query.orderAsc("$createdAt"),
        ],
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
      const currentUser = await this.auth.getCurrentUser();
      if (!currentUser) throw new Error("Not authenticated");

      // Prepare permissions using the correct format
      const permissions = [
        Permission.read(Role.user(ownerId)),
        Permission.read(Role.users()),
      ];

      // Only add team permissions if user is admin
      if (currentUser.isAdmin) {
        try {
          await teams.get(ADMINS_TEAM_ID);
          permissions.push(Permission.read(Role.team(ADMINS_TEAM_ID)));
        } catch (error) {
          // If team doesn't exist, log but continue
          console.debug("Admin team not found:", error);
        }
      }

      await storage.createFile(STORAGE_BUCKET_ID, fileId, file, permissions);

      if (opts?.progress) {
        opts.progress(100);
      }

      return { fileId, filename };
    },

    getFileURL: async (fileId: string, _ownerId: string): Promise<string> => {
      const url = storage.getFileView(STORAGE_BUCKET_ID, fileId);
      return url.toString();
    },
  };
}

export function createAppwriteBackend(): Backend {
  return new AppwriteBackend();
}

export { client, account, databases, storage, teams };
