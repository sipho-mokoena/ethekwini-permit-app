import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  Download,
  Eye,
  FileText,
  Image as ImageIcon,
  Minus,
  Plus,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/Card";
import {
  useApplication,
  useUploadedDocuments,
} from "../../hooks/useApplications";
import { backend } from "../../lib/backend";

export const Route = createFileRoute("/application/$id")({
  component: ApplicationDetailPage,
});

function ApplicationDetailPage() {
  const { id } = Route.useParams();
  const { data: application, isLoading } = useApplication(id);
  const { data: documents } = useUploadedDocuments(id);
  const [openDocumentId, setOpenDocumentId] = useState<string | null>(null);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "submitted":
        return <Clock className="w-5 h-5 text-blue-500" />;
      case "reviewing":
        return <Eye className="w-5 h-5 text-yellow-500" />;
      case "approved":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "rejected":
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "submitted":
        return "text-blue-600 bg-blue-50 border-blue-200";
      case "reviewing":
        return "text-yellow-600 bg-yellow-50 border-yellow-200";
      case "approved":
        return "text-green-600 bg-green-50 border-green-200";
      case "rejected":
        return "text-red-600 bg-red-50 border-red-200";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  // New function to generate a permit ID based on application ID
  const generatePermitId = (applicationId: string) => {
    // Simple way to generate a permit ID from the application ID
    return `PERMIT-${applicationId.substring(0, 8).toUpperCase()}`;
  };

  const handleDownloadFile = async (
    fileId: string,
    ownerId: string,
    filename: string,
  ) => {
    try {
      const url = await backend.storage.getFileURL(fileId, ownerId);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Failed to download file:", error);
    }
  };

  const toggleDocument = (documentId: string) => {
    setOpenDocumentId(openDocumentId === documentId ? null : documentId);
  };

  const isViewableDocument = (filename: string) => {
    const extension = filename.split(".").pop()?.toLowerCase();
    return (
      extension === "pdf" ||
      extension === "jpg" ||
      extension === "jpeg" ||
      extension === "png"
    );
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading application...</div>;
  }

  if (!application) {
    return (
      <div className="text-center py-8">
        <h2 className="text-xl font-semibold mb-2">Application not found</h2>
        <Link to="/dashboard">
          <Button variant="outline">Back to Dashboard</Button>
        </Link>
      </div>
    );
  }

  const formData = JSON.parse(application.formData || "{}");

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center space-x-4">
        <Link to="/dashboard">
          <Button variant="outline" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">{application.tradeName}</h1>
          <p className="text-muted-foreground">
            Application submitted on{" "}
            {new Date(application.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      <div
        className={`inline-flex items-center space-x-2 px-4 py-2 rounded-full border ${getStatusColor(application.status)}`}
      >
        {getStatusIcon(application.status)}
        <span className="font-medium capitalize">{application.status}</span>
      </div>



      {/* Permit Component - Display when application is approved */}
      {application.status === "approved" && (
        <Card className="border-2 border-green-500 bg-gradient-to-br from-green-50 to-white">
          <CardHeader className="text-center pb-4">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl text-green-800">Business Permit Approved</CardTitle>
            <CardDescription className="text-green-600">
              Official permit issued by eThekwini Municipality
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-medium text-gray-500">Permit Number</p>
                <p className="font-mono text-lg">{generatePermitId(application.id)}</p>
              </div>
              <div>
                <p className="font-medium text-gray-500">Issue Date</p>
                <p>{new Date(application.updatedAt).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="font-medium text-gray-500">Business Name</p>
                <p className="font-semibold">{application.tradeName}</p>
              </div>
              <div>
                <p className="font-medium text-gray-500">Owner Name</p>
                <p>{application.ownerName}</p>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200">
              <p className="text-center text-xs text-gray-500">
                This permit is valid for the operation of the business at the registered location.
                Please display this permit prominently at your place of business.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Business Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <span className="font-medium">Owner Name:</span>
              <p>{application.ownerName}</p>
            </div>
            <div>
              <span className="font-medium">Phone Number:</span>
              <p>{application.phoneNumber}</p>
            </div>
            <div>
              <span className="font-medium">Trade Name:</span>
              <p>{application.tradeName}</p>
            </div>
            {application.location && (
              <div>
                <span className="font-medium">Location:</span>
                <p>{application.location}</p>
              </div>
            )}
            {formData.businessType && (
              <div>
                <span className="font-medium">Business Type:</span>
                <p>{formData.businessType}</p>
              </div>
            )}
            {formData.employeeCount && (
              <div>
                <span className="font-medium">Number of Employees:</span>
                <p>{formData.employeeCount}</p>
              </div>
            )}
            {formData.operatingHours && (
              <div>
                <span className="font-medium">Operating Hours:</span>
                <p>{formData.operatingHours}</p>
              </div>
            )}
            {formData.additionalInfo && (
              <div>
                <span className="font-medium">Additional Information:</span>
                <p>{formData.additionalInfo}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Uploaded Documents</CardTitle>
            <CardDescription>
              {documents?.length || 0} document(s) uploaded
            </CardDescription>
          </CardHeader>
          <CardContent>
            {documents?.length ? (
              <div className="space-y-3">
                {documents.map((doc) => (
                  <div key={doc.id} className="border rounded-lg">
                    <button
                      type="button"
                      className="flex items-center justify-between w-full p-3 text-left cursor-pointer hover:bg-muted/50"
                      onClick={() =>
                        isViewableDocument(doc.filename) &&
                        toggleDocument(doc.id)
                      }
                      aria-expanded={openDocumentId === doc.id}
                      aria-controls={`document-preview-${doc.id}`}
                    >
                      <div className="flex items-center space-x-2">
                        {isViewableDocument(doc.filename) ? (
                          openDocumentId === doc.id ? (
                            <Minus className="w-4 h-4" />
                          ) : (
                            <Plus className="w-4 h-4" />
                          )
                        ) : (
                          <FileText className="w-4 h-4" />
                        )}
                        <div>
                          <p className="font-medium">{doc.filename}</p>
                          <p className="text-sm text-muted-foreground capitalize">
                            {doc.documentType.replace("_", " ")}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadFile(
                            doc.fileId,
                            doc.ownerId,
                            doc.filename,
                          );
                        }}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </button>

                    {isViewableDocument(doc.filename) &&
                      openDocumentId === doc.id && (
                        <div
                          id={`document-preview-${doc.id}`}
                          className="p-3 border-t bg-muted/30"
                        >
                          <div className="mb-2 flex items-center space-x-2">
                            <ImageIcon className="w-4 h-4" />
                            <span className="text-sm font-medium">Preview</span>
                          </div>
                          <div className="flex justify-center">
                            <p className="text-muted-foreground">
                              Click "Open Document" to view the file
                            </p>
                            <Button
                              size="sm"
                              variant="outline"
                              className="ml-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownloadFile(
                                  doc.fileId,
                                  doc.ownerId,
                                  doc.filename,
                                );
                              }}
                            >
                              Open Document
                            </Button>
                          </div>
                        </div>
                      )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No documents uploaded</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Application Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <div>
                <p className="font-medium">Application Submitted</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(application.createdAt).toLocaleString()}
                </p>
              </div>
            </div>

            {application.status !== "submitted" && (
              <div className="flex items-center space-x-3">
                <div
                  className={`w-2 h-2 rounded-full ${application.status === "reviewing"
                    ? "bg-yellow-500"
                    : application.status === "approved"
                      ? "bg-green-500"
                      : "bg-red-500"
                    }`}
                ></div>
                <div>
                  <p className="font-medium capitalize">
                    Status: {application.status}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(application.updatedAt).toLocaleString()}
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
