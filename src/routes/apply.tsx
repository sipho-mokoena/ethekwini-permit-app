import React, { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { FileUploader } from "../components/FileUploader";
import { useAuth } from "../hooks/useAuth";
import {
  useCreateApplication,
  useCreateUploadedDocument,
} from "../hooks/useApplications";
import { CheckCircle, FileText, Upload, Send } from "lucide-react";

export const Route = createFileRoute("/apply")({
  component: ApplyPage,
});

const REQUIRED_DOCUMENTS = [
  {
    type: "id_document",
    label: "South African ID Document",
    description: "Clear copy of your ID book or card",
  },
  {
    type: "proof_of_residence",
    label: "Proof of Residence",
    description: "Municipal account or lease agreement",
  },
  {
    type: "business_plan",
    label: "Business Plan",
    description: "Simple business plan or description",
  },
  {
    type: "site_plan",
    label: "Site Plan",
    description: "Layout of your spaza shop location",
  },
];

type Step = "checklist" | "documents" | "form" | "review" | "submit";

function ApplyPage() {
  const [currentStep, setCurrentStep] = useState<Step>("checklist");
  const [uploadedFiles, setUploadedFiles] = useState<
    Record<string, { fileId: string; filename: string; documentType: string }[]>
  >({});
  const [formData, setFormData] = useState({
    ownerName: "",
    tradeName: "",
    location: "",
    businessType: "",
    employeeCount: "",
    operatingHours: "",
    additionalInfo: "",
  });

  const { user } = useAuth();
  const navigate = useNavigate();
  const createApplication = useCreateApplication();
  const createUploadedDocument = useCreateUploadedDocument();

  const handleFilesUploaded = (
    documentType: string,
    files: { fileId: string; filename: string; documentType: string }[],
  ) => {
    setUploadedFiles((prev) => ({
      ...prev,
      [documentType]: files,
    }));
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentStep("review");
  };

  const handleFinalSubmit = async () => {
    if (!user) return;

    try {
      // Create application
      const application = await createApplication.mutateAsync({
        ownerName: formData.ownerName,
        phoneNumber: user.phone,
        tradeName: formData.tradeName,
        location: formData.location,
        formData: {
          businessType: formData.businessType,
          employeeCount: formData.employeeCount,
          operatingHours: formData.operatingHours,
          additionalInfo: formData.additionalInfo,
        },
      });

      // Create uploaded document records
      for (const [documentType, files] of Object.entries(uploadedFiles)) {
        for (const file of files) {
          await createUploadedDocument.mutateAsync({
            applicationId: application.id,
            ownerId: user.id,
            documentType,
            fileId: file.fileId,
            filename: file.filename,
          });
        }
      }

      navigate({ to: "/dashboard" });
    } catch (error) {
      console.error("Failed to submit application:", error);
    }
  };

  const canProceedFromDocuments = REQUIRED_DOCUMENTS.every(
    (doc) => uploadedFiles[doc.type]?.length > 0,
  );

  const renderChecklist = () => (
    <Card>
      <CardHeader>
        <CardTitle>Required Documents Checklist</CardTitle>
        <CardDescription>
          Make sure you have all these documents ready before starting your
          application
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {REQUIRED_DOCUMENTS.map((doc) => (
            <div key={doc.type} className="flex items-start space-x-3">
              <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
              <div>
                <h4 className="font-medium">{doc.label}</h4>
                <p className="text-sm text-muted-foreground">
                  {doc.description}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6">
          <Button
            onClick={() => setCurrentStep("documents")}
            className="w-full"
          >
            I have all documents ready
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderDocuments = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Upload Documents</h2>
        <p className="text-muted-foreground">
          Upload all required documents. Each file must be under 8MB.
        </p>
      </div>

      {REQUIRED_DOCUMENTS.map((doc) => (
        <Card key={doc.type}>
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <FileText className="w-5 h-5 mr-2" />
              {doc.label}
              {uploadedFiles[doc.type]?.length > 0 && (
                <CheckCircle className="w-5 h-5 text-green-500 ml-2" />
              )}
            </CardTitle>
            <CardDescription>{doc.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <FileUploader
              documentType={doc.type}
              onFilesUploaded={(files) => handleFilesUploaded(doc.type, files)}
              maxFiles={3}
            />
          </CardContent>
        </Card>
      ))}

      <div className="flex space-x-4">
        <Button variant="outline" onClick={() => setCurrentStep("checklist")}>
          Back
        </Button>
        <Button
          onClick={() => setCurrentStep("form")}
          disabled={!canProceedFromDocuments}
          className="flex-1"
        >
          Continue to Application Form
        </Button>
      </div>
    </div>
  );

  const renderForm = () => (
    <Card>
      <CardHeader>
        <CardTitle>Application Form</CardTitle>
        <CardDescription>Fill in your business details</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Owner Name *
            </label>
            <Input
              value={formData.ownerName}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, ownerName: e.target.value }))
              }
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Trade Name *
            </label>
            <Input
              value={formData.tradeName}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, tradeName: e.target.value }))
              }
              placeholder="Name of your spaza shop"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Location *</label>
            <Input
              value={formData.location}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, location: e.target.value }))
              }
              placeholder="Physical address of your shop"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Business Type
            </label>
            <Input
              value={formData.businessType}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  businessType: e.target.value,
                }))
              }
              placeholder="e.g., General goods, Groceries, etc."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Number of Employees
            </label>
            <Input
              type="number"
              value={formData.employeeCount}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  employeeCount: e.target.value,
                }))
              }
              placeholder="Including yourself"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Operating Hours
            </label>
            <Input
              value={formData.operatingHours}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  operatingHours: e.target.value,
                }))
              }
              placeholder="e.g., 7:00 AM - 8:00 PM"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Additional Information
            </label>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={formData.additionalInfo}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  additionalInfo: e.target.value,
                }))
              }
              placeholder="Any additional information about your business"
            />
          </div>

          <div className="flex space-x-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCurrentStep("documents")}
            >
              Back
            </Button>
            <Button type="submit" className="flex-1">
              Review Application
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );

  const renderReview = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Review Your Application</h2>
        <p className="text-muted-foreground">
          Please review all information before submitting
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Business Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <strong>Owner:</strong> {formData.ownerName}
          </div>
          <div>
            <strong>Trade Name:</strong> {formData.tradeName}
          </div>
          <div>
            <strong>Location:</strong> {formData.location}
          </div>
          <div>
            <strong>Phone:</strong> {user?.phone}
          </div>
          {formData.businessType && (
            <div>
              <strong>Business Type:</strong> {formData.businessType}
            </div>
          )}
          {formData.employeeCount && (
            <div>
              <strong>Employees:</strong> {formData.employeeCount}
            </div>
          )}
          {formData.operatingHours && (
            <div>
              <strong>Hours:</strong> {formData.operatingHours}
            </div>
          )}
          {formData.additionalInfo && (
            <div>
              <strong>Additional Info:</strong> {formData.additionalInfo}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Uploaded Documents</CardTitle>
        </CardHeader>
        <CardContent>
          {REQUIRED_DOCUMENTS.map((doc) => (
            <div
              key={doc.type}
              className="flex items-center justify-between py-2"
            >
              <span>{doc.label}</span>
              <div className="flex items-center text-green-600">
                <CheckCircle className="w-4 h-4 mr-1" />
                {uploadedFiles[doc.type]?.length || 0} file(s)
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex space-x-4">
        <Button variant="outline" onClick={() => setCurrentStep("form")}>
          Back to Form
        </Button>
        <Button
          onClick={handleFinalSubmit}
          disabled={createApplication.isPending}
          className="flex-1"
        >
          <Send className="w-4 h-4 mr-2" />
          {createApplication.isPending ? "Submitting..." : "Submit Application"}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto">
      {currentStep === "checklist" && renderChecklist()}
      {currentStep === "documents" && renderDocuments()}
      {currentStep === "form" && renderForm()}
      {currentStep === "review" && renderReview()}
    </div>
  );
}
