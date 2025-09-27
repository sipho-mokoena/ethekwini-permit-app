import React, { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Select } from "../../../components/ui/Select";
import {
  useApplication,
  useUploadedDocuments,
  useUpdateApplicationStatus,
} from "../../../hooks/useApplications";
import {
  ArrowLeft,
  Download,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
} from "lucide-react";
import { backend } from "../../../lib/backend";

export const Route = createFileRoute("/admin/application/$id")({
  component: AdminApplicationDetailPage,
});

function AdminApplicationDetailPage() {
  const { id } = Route.useParams();
  const { data: application, isLoading } = useApplication(id);
  const { data: documents } = useUploadedDocuments(id);
  const updateStatus = useUpdateApplicationStatus();
  const [selectedStatus, setSelectedStatus] = useState("");

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

  const handleStatusUpdate = async () => {
    if (!selectedStatus || !application) return;

    try {
      await updateStatus.mutateAsync({
        applicationId: application.id,
        status: selectedStatus as "reviewing" | "approved" | "rejected",
      });
      setSelectedStatus("");
    } catch (error) {
      console.error("Failed to update status:", error);
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
        <Link to="/admin/applications">
          <Button variant="outline">Back to Applications</Button>
        </Link>
      </div>
    );
  }

  const formData = JSON.parse(application.formData || "{}");

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center space-x-4">
        <Link to="/admin/applications">
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

      <div className="flex items-center justify-between">
        <div
          className={`inline-flex items-center space-x-2 px-4 py-2 rounded-full border ${getStatusColor(application.status)}`}
        >
          {getStatusIcon(application.status)}
          <span className="font-medium capitalize">{application.status}</span>
        </div>

        <div className="flex items-center space-x-2">
          <Select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option value="">Update Status</option>
            <option value="reviewing">Reviewing</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </Select>
          <Button
            onClick={handleStatusUpdate}
            disabled={!selectedStatus || updateStatus.isPending}
          >
            {updateStatus.isPending ? "Updating..." : "Update"}
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Business Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <span className="font-medium text-sm text-muted-foreground">
                    Owner Name
                  </span>
                  <p className="text-lg">{application.ownerName}</p>
                </div>
                <div>
                  <span className="font-medium text-sm text-muted-foreground">
                    Phone Number
                  </span>
                  <p className="text-lg">{application.phoneNumber}</p>
                </div>
                <div>
                  <span className="font-medium text-sm text-muted-foreground">
                    Trade Name
                  </span>
                  <p className="text-lg">{application.tradeName}</p>
                </div>
                {application.location && (
                  <div>
                    <span className="font-medium text-sm text-muted-foreground">
                      Location
                    </span>
                    <p className="text-lg">{application.location}</p>
                  </div>
                )}
              </div>

              {(formData.businessType ||
                formData.employeeCount ||
                formData.operatingHours) && (
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">Additional Details</h4>
                  <div className="grid md:grid-cols-2 gap-4">
                    {formData.businessType && (
                      <div>
                        <span className="font-medium text-sm text-muted-foreground">
                          Business Type
                        </span>
                        <p>{formData.businessType}</p>
                      </div>
                    )}
                    {formData.employeeCount && (
                      <div>
                        <span className="font-medium text-sm text-muted-foreground">
                          Number of Employees
                        </span>
                        <p>{formData.employeeCount}</p>
                      </div>
                    )}
                    {formData.operatingHours && (
                      <div className="md:col-span-2">
                        <span className="font-medium text-sm text-muted-foreground">
                          Operating Hours
                        </span>
                        <p>{formData.operatingHours}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {formData.additionalInfo && (
                <div className="border-t pt-4">
                  <span className="font-medium text-sm text-muted-foreground">
                    Additional Information
                  </span>
                  <p className="mt-1">{formData.additionalInfo}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Application Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
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
                      className={`w-3 h-3 rounded-full ${
                        application.status === "reviewing"
                          ? "bg-yellow-500"
                          : application.status === "approved"
                            ? "bg-green-500"
                            : "bg-red-500"
                      }`}
                    ></div>
                    <div>
                      <p className="font-medium capitalize">
                        Status Updated: {application.status}
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

        <div>
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
                    <div key={doc.id} className="p-3 border rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {doc.filename}
                          </p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {doc.documentType.replace("_", " ")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(doc.uploadedAt).toLocaleDateString()}
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
                          <Download className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  No documents uploaded
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
