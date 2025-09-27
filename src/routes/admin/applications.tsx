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
import { useApplications } from "../../hooks/useApplications";
import { FileText, Clock, CheckCircle, XCircle, Eye } from "lucide-react";

export const Route = createFileRoute("/admin/applications")({
  component: AdminApplicationsPage,
});

function AdminApplicationsPage() {
  const { data: applications, isLoading } = useApplications();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "submitted":
        return <Clock className="w-4 h-4 text-blue-500" />;
      case "reviewing":
        return <Eye className="w-4 h-4 text-yellow-500" />;
      case "approved":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "rejected":
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "submitted":
        return "text-blue-600 bg-blue-50";
      case "reviewing":
        return "text-yellow-600 bg-yellow-50";
      case "approved":
        return "text-green-600 bg-green-50";
      case "rejected":
        return "text-red-600 bg-red-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  const getStatusCounts = () => {
    if (!applications?.documents)
      return { submitted: 0, reviewing: 0, approved: 0, rejected: 0 };

    return applications.documents.reduce(
      (acc, app) => {
        acc[app.status as keyof typeof acc]++;
        return acc;
      },
      { submitted: 0, reviewing: 0, approved: 0, rejected: 0 },
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Applications Management</h1>
        <div className="text-center py-8">Loading applications...</div>
      </div>
    );
  }

  const statusCounts = getStatusCounts();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Applications Management</h1>
        <p className="text-muted-foreground">
          Review and manage spaza shop permit applications
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{statusCounts.submitted}</p>
                <p className="text-sm text-muted-foreground">Submitted</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Eye className="w-5 h-5 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">{statusCounts.reviewing}</p>
                <p className="text-sm text-muted-foreground">Reviewing</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{statusCounts.approved}</p>
                <p className="text-sm text-muted-foreground">Approved</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <XCircle className="w-5 h-5 text-red-500" />
              <div>
                <p className="text-2xl font-bold">{statusCounts.rejected}</p>
                <p className="text-sm text-muted-foreground">Rejected</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {!applications?.documents.length ? (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No applications yet</h3>
            <p className="text-muted-foreground">
              Applications will appear here once users start submitting them
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {applications.documents.map((application) => (
            <Card key={application.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      {application.tradeName}
                    </CardTitle>
                    <CardDescription>
                      Owner: {application.ownerName} • Phone:{" "}
                      {application.phoneNumber}
                    </CardDescription>
                  </div>
                  <div
                    className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(application.status)}`}
                  >
                    <div className="flex items-center space-x-1">
                      {getStatusIcon(application.status)}
                      <span className="capitalize">{application.status}</span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="space-y-1 text-sm">
                    <div>
                      <span className="font-medium">Submitted:</span>{" "}
                      {new Date(application.createdAt).toLocaleDateString()}
                    </div>
                    {application.location && (
                      <div>
                        <span className="font-medium">Location:</span>{" "}
                        {application.location}
                      </div>
                    )}
                  </div>
                  <Link
                    to="/admin/application/$id"
                    params={{ id: application.id }}
                  >
                    <Button variant="outline">Review Application</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
