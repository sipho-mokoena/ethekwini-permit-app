import type { DBSchema, IDBPDatabase } from "idb";
import { openDB } from "idb";
import type {
  Application,
  ApplicationInput,
  Backend,
  FileUploadResult,
  UploadedDocument,
  UploadedDocumentInput,
  User,
} from "./types";
import { formatPhoneNumber, generateId } from "./utils";

interface SpazaDB extends DBSchema {
  users: {
    key: string;
    value: User;
  };
  sessions: {
    key: string;
    value: {
      sessionToken: string;
      userId: string;
      expiresAt: number;
    };
  };
  applications: {
    key: string;
    value: Application;
  };
  uploaded_documents: {
    key: string;
    value: UploadedDocument;
  };
  files: {
    key: string;
    value: {
      fileId: string;
      ownerId: string;
      filename: string;
      blob: Blob;
      uploadedAt: string;
    };
  };
}

class LocalBackend implements Backend {
  private dbPromise: Promise<IDBPDatabase<SpazaDB>>;

  constructor() {
    this.dbPromise = this.initDB();
    this.seedAdminUser();
  }

  private async initDB(): Promise<IDBPDatabase<SpazaDB>> {
    return openDB<SpazaDB>("spaza-db", 1, {
      upgrade(db) {
        db.createObjectStore("users", { keyPath: "id" });
        db.createObjectStore("sessions", { keyPath: "sessionToken" });
        db.createObjectStore("applications", { keyPath: "id" });
        db.createObjectStore("uploaded_documents", { keyPath: "id" });
        db.createObjectStore("files", { keyPath: "fileId" });
      },
    });
  }

  private async seedAdminUser() {
    const db = await this.dbPromise;
    const existingAdmin = await db.get("users", "admin-local");

    if (!existingAdmin) {
      const adminUser: User = {
        id: "admin-local",
        phone: "+27123456789",
        ownerName: "Local Admin",
        phoneVerified: true,
        isAdmin: true,
        email: "admin@local.test",
      };
      await db.put("users", adminUser);
    }
  }

  private getCurrentSession(): string | null {
    return localStorage.getItem("sessionToken");
  }

  private setCurrentSession(token: string) {
    localStorage.setItem("sessionToken", token);
  }

  private clearCurrentSession() {
    localStorage.removeItem("sessionToken");
  }

  private async getUserFromSession(sessionToken: string): Promise<User | null> {
    const db = await this.dbPromise;
    const session = await db.get("sessions", sessionToken);

    if (!session || session.expiresAt < Date.now()) {
      return null;
    }

    return (await db.get("users", session.userId)) || null;
  }

  private async hasPermission(
    userId: string,
    ownerId: string,
  ): Promise<boolean> {
    const db = await this.dbPromise;
    const user = await db.get("users", userId);
    return user?.isAdmin || userId === ownerId;
  }

  auth = {
    requestPhoneOTP: async (
      phone: string,
    ): Promise<{ ok: boolean; cooldownUntil?: number; userId?: string }> => {
      const formattedPhone = formatPhoneNumber(phone);
      const cooldownKey = `otpCooldown:${formattedPhone}`;
      const cooldownUntil = localStorage.getItem(cooldownKey);

      if (cooldownUntil && parseInt(cooldownUntil) > Date.now()) {
        return { ok: false, cooldownUntil: parseInt(cooldownUntil) };
      }

      const db = await this.dbPromise;
      const existingUser = (await db.getAll("users")).find(
        (u) => u.phone === formattedPhone,
      );
      const userId = existingUser?.id ?? generateId();

      // Simulate OTP sending
      const newCooldownUntil = Date.now() + 60000; // 1 minute cooldown
      localStorage.setItem(cooldownKey, newCooldownUntil.toString());

      // Store the OTP for verification (in real app this would be sent via SMS)
      localStorage.setItem(`otp:${formattedPhone}`, "123456");
      localStorage.setItem(
        `otpExpiry:${formattedPhone}`,
        (Date.now() + 300000).toString(),
      ); // 5 minutes
      localStorage.setItem(`otpUser:${formattedPhone}`, userId);
      localStorage.setItem(`otpPhoneById:${userId}`, formattedPhone);

  return { ok: true, userId, cooldownUntil: newCooldownUntil };
    },

    verifyOTP: async (input: {
      userId: string;
      code: string;
    }): Promise<{ user: User; sessionToken?: string }> => {
      const formattedPhone = localStorage.getItem(
        `otpPhoneById:${input.userId}`,
      );

      if (!formattedPhone) {
        throw new Error("OTP expired or not found");
      }

      const storedOTP = localStorage.getItem(`otp:${formattedPhone}`);
      const otpExpiry = localStorage.getItem(`otpExpiry:${formattedPhone}`);

      if (!storedOTP || !otpExpiry || parseInt(otpExpiry) < Date.now()) {
        throw new Error("OTP expired or not found");
      }

      if (storedOTP !== input.code) {
        throw new Error("Invalid OTP");
      }

      // Clean up OTP
      localStorage.removeItem(`otp:${formattedPhone}`);
      localStorage.removeItem(`otpExpiry:${formattedPhone}`);
      localStorage.removeItem(`otpUser:${formattedPhone}`);
      localStorage.removeItem(`otpPhoneById:${input.userId}`);

      const db = await this.dbPromise;
      let user = await db.get("users", input.userId);

      if (!user) {
        user = await db
          .getAll("users")
          .then((users) => users.find((u) => u.phone === formattedPhone));
      }

      if (!user) {
        user = {
          id: input.userId,
          phone: formattedPhone,
          phoneVerified: true,
          isAdmin: false,
        };
        await db.put("users", user);
      } else {
        user.phoneVerified = true;
        await db.put("users", user);
      }

      // Create session
      const sessionToken = generateId();
      await db.put("sessions", {
        sessionToken,
        userId: user.id,
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      this.setCurrentSession(sessionToken);

      return { user, sessionToken };
    },

    createEmailSession: async (
      email: string,
      password: string,
    ): Promise<{ user: User }> => {
      if (email !== "admin@local.test" || password !== "adminpass") {
        throw new Error("Invalid credentials");
      }

      const db = await this.dbPromise;
      const user = await db.get("users", "admin-local");

      if (!user) {
        throw new Error("Admin user not found");
      }

      // Create session
      const sessionToken = generateId();
      await db.put("sessions", {
        sessionToken,
        userId: user.id,
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      this.setCurrentSession(sessionToken);

      return { user };
    },

    getCurrentUser: async (): Promise<User | null> => {
      const sessionToken = this.getCurrentSession();
      if (!sessionToken) return null;

      return await this.getUserFromSession(sessionToken);
    },

    logout: async (): Promise<void> => {
      const sessionToken = this.getCurrentSession();
      if (sessionToken) {
        const db = await this.dbPromise;
        await db.delete("sessions", sessionToken);
        this.clearCurrentSession();
      }
    },
  };

  db = {
    createApplication: async (app: ApplicationInput): Promise<Application> => {
      const currentUser = await this.auth.getCurrentUser();
      if (!currentUser) throw new Error("Not authenticated");

      const db = await this.dbPromise;
      const existing = await db.getAll("applications");
      const hasDuplicate = existing.some(
        (doc) =>
          doc.ownerId === currentUser.id &&
          doc.tradeName.toLowerCase() === app.tradeName.toLowerCase() &&
          doc.status === "submitted",
      );

      if (hasDuplicate) {
        throw new Error(
          "You already have a submitted application for this trade name.",
        );
      }

      const application: Application = {
        id: generateId(),
        ownerId: currentUser.id,
        ownerName: app.ownerName,
        phoneNumber: app.phoneNumber,
        tradeName: app.tradeName,
        location: app.location,
        formData: JSON.stringify(app.formData),
        status: "submitted",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await db.put("applications", application);
      return application;
    },

    listApplications: async (filter?: {
      ownerId?: string;
      offset?: number;
      limit?: number;
      sort?: string;
    }): Promise<{ documents: Application[] }> => {
      const currentUser = await this.auth.getCurrentUser();
      if (!currentUser) throw new Error("Not authenticated");

      const db = await this.dbPromise;
      let applications = await db.getAll("applications");

      // Filter by owner if not admin
      if (!currentUser.isAdmin) {
        applications = applications.filter(
          (app) => app.ownerId === currentUser.id,
        );
      } else if (filter?.ownerId) {
        applications = applications.filter(
          (app) => app.ownerId === filter.ownerId,
        );
      }

      // Sort by createdAt desc by default
      applications.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

      // Apply pagination
      const offset = filter?.offset || 0;
      const limit = filter?.limit || 100;
      applications = applications.slice(offset, offset + limit);

      return { documents: applications };
    },

    getApplication: async (applicationId: string): Promise<Application> => {
      const currentUser = await this.auth.getCurrentUser();
      if (!currentUser) throw new Error("Not authenticated");

      const db = await this.dbPromise;
      const application = await db.get("applications", applicationId);

      if (!application) {
        throw new Error("Application not found");
      }

      if (!(await this.hasPermission(currentUser.id, application.ownerId))) {
        throw new Error("Permission denied");
      }

      return application;
    },

    updateApplicationStatus: async (
      applicationId: string,
      status: "reviewing" | "approved" | "rejected",
    ): Promise<Application> => {
      const currentUser = await this.auth.getCurrentUser();
      if (!currentUser?.isAdmin) throw new Error("Admin access required");

      const db = await this.dbPromise;
      const application = await db.get("applications", applicationId);

      if (!application) {
        throw new Error("Application not found");
      }

      application.status = status;
      application.updatedAt = new Date().toISOString();

      await db.put("applications", application);
      return application;
    },

    createUploadedDocument: async (
      doc: UploadedDocumentInput,
    ): Promise<UploadedDocument> => {
      const currentUser = await this.auth.getCurrentUser();
      if (!currentUser) throw new Error("Not authenticated");

      const db = await this.dbPromise;
      const uploadedDoc: UploadedDocument = {
        id: generateId(),
        applicationId: doc.applicationId,
        ownerId: doc.ownerId,
        documentType: doc.documentType,
        fileId: doc.fileId,
        filename: doc.filename,
        uploadedAt: new Date().toISOString(),
      };

      await db.put("uploaded_documents", uploadedDoc);
      return uploadedDoc;
    },

    listUploadedDocuments: async (
      applicationId: string,
    ): Promise<UploadedDocument[]> => {
      const currentUser = await this.auth.getCurrentUser();
      if (!currentUser) throw new Error("Not authenticated");

      const db = await this.dbPromise;
      const docs = await db.getAll("uploaded_documents");

      return docs.filter((doc) => {
        if (doc.applicationId !== applicationId) return false;
        return currentUser.isAdmin || doc.ownerId === currentUser.id;
      });
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
      const currentUser = await this.auth.getCurrentUser();
      if (!currentUser) throw new Error("Not authenticated");

      // Simulate upload progress
      if (opts?.progress) {
        for (let i = 0; i <= 100; i += 10) {
          await new Promise((resolve) => setTimeout(resolve, 50));
          opts.progress(i);
        }
      }

      const fileId = generateId();
      const filename = opts?.filename || file.name;

      const db = await this.dbPromise;
      await db.put("files", {
        fileId,
        ownerId,
        filename,
        blob: file,
        uploadedAt: new Date().toISOString(),
      });

      return { fileId, filename };
    },

    getFileURL: async (fileId: string, ownerId: string): Promise<string> => {
      const currentUser = await this.auth.getCurrentUser();
      if (!currentUser) throw new Error("Not authenticated");

      if (!(await this.hasPermission(currentUser.id, ownerId))) {
        throw new Error("Permission denied");
      }

      const db = await this.dbPromise;
      const file = await db.get("files", fileId);

      if (!file) {
        throw new Error("File not found");
      }

      return URL.createObjectURL(file.blob);
    },
  };
}

export function createLocalBackend(): Backend {
  return new LocalBackend();
}
