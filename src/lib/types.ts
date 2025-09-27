export interface User {
  id: string;
  phone: string;
  ownerName?: string;
  phoneVerified: boolean;
  isAdmin: boolean;
  email?: string;
}

export interface Application {
  id: string;
  ownerId: string;
  ownerName: string;
  phoneNumber: string;
  tradeName: string;
  location?: string;
  formData: string; // JSON string
  status: "submitted" | "reviewing" | "approved" | "rejected";
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationInput {
  ownerName: string;
  phoneNumber: string;
  tradeName: string;
  location?: string;
  formData: Record<string, any>;
}

export interface UploadedDocument {
  id: string;
  applicationId: string;
  ownerId: string;
  documentType: string;
  fileId: string;
  filename: string;
  uploadedAt: string;
}

export interface UploadedDocumentInput {
  applicationId: string;
  ownerId: string;
  documentType: string;
  fileId: string;
  filename: string;
}

export interface FileUploadResult {
  fileId: string;
  filename: string;
}

export interface Backend {
  auth: {
    requestPhoneOTP(
      phone: string,
    ): Promise<{ ok: boolean; cooldownUntil?: number }>;
    verifyOTP(
      phone: string,
      code: string,
    ): Promise<{ user: User; sessionToken?: string }>;
    createEmailSession(
      email: string,
      password: string,
    ): Promise<{ user: User }>;
    getCurrentUser(): Promise<User | null>;
    logout(): Promise<void>;
  };
  db: {
    createApplication(app: ApplicationInput): Promise<Application>;
    listApplications(filter?: {
      ownerId?: string;
      offset?: number;
      limit?: number;
      sort?: string;
    }): Promise<{ documents: Application[] }>;
    getApplication(applicationId: string): Promise<Application>;
    updateApplicationStatus(
      applicationId: string,
      status: "reviewing" | "approved" | "rejected",
    ): Promise<Application>;
    createUploadedDocument(
      doc: UploadedDocumentInput,
    ): Promise<UploadedDocument>;
    listUploadedDocuments(applicationId: string): Promise<UploadedDocument[]>;
  };
  storage: {
    uploadFile(
      file: File,
      ownerId: string,
      opts?: {
        filename?: string;
        documentType?: string;
        progress?: (p: number) => void;
      },
    ): Promise<FileUploadResult>;
    getFileURL(fileId: string, ownerId: string): Promise<string>;
  };
}
