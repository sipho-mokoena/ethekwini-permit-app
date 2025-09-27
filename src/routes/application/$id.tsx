import React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import {
  useApplication,
  useUploadedDocuments,
} from "../../hooks/useApplications";
import {
  ArrowLeft,
  Download,
  Eye,
  Clock,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { backend } from "../../lib/backend";

export const Route = createFileRoute("/application/$id")({
  component: ApplicationDetailPage,
});

function ApplicationDetailPage() {
  const { id } = Route.useParams();
  const { data: application, isLoading } = useApplication(id);
  const { data: documents } = useUploadedDocuments(id);

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
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{doc.filename}</p>
                      <p className="text-sm text-muted-foreground capitalize">
                        {doc.documentType.replace("_", " ")}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        handleDownloadFile(
                          doc.fileId,
                          doc.ownerId,
                          doc.filename,
                        )
                      }
                    >
                      <Download className="w-4 h-4" />
                    </Button>
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
                  className={`w-2 h-2 rounded-full ${
                    application.status === "reviewing"
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
