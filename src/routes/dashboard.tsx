import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle, Clock, Eye, FileText, Plus, XCircle } from "lucide-react";
import React from "react";
import { Button } from "../components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/Card";
import { useApplications } from "../hooks/useApplications";
import { useAuth } from "../hooks/useAuth";
import { isLocalMode } from "../lib/backend";
import { migrateLocalToAppwrite } from "../scripts/migrateLocalToAppwrite";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { user } = useAuth();
  const { data: applications, isLoading } = useApplications({
    ownerId: user?.id,
  });

  // React.useEffect(() => {
  //   if (!isLocalMode) {
  //     migrateLocalToAppwrite();
  //   }
  // }, []);

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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Dashboard</h1>
        </div>
        <div className="text-center py-8">Loading applications...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {user?.ownerName || user?.phone}
          </p>
        </div>
        <Link to="/apply">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Application
          </Button>
        </Link>
      </div>

      {!applications?.documents.length ? (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No applications yet</h3>
            <p className="text-muted-foreground mb-4">
              Start by submitting your first spaza shop permit application
            </p>
            <Link to="/apply">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Submit Application
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {applications.documents.map((application) => (
            <Card key={application.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    {application.tradeName}
                  </CardTitle>
                  <div
                    className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(application.status)}`}
                  >
                    <div className="flex items-center space-x-1">
                      {getStatusIcon(application.status)}
                      <span className="capitalize">{application.status}</span>
                    </div>
                  </div>
                </div>
                <CardDescription>
                  Submitted on{" "}
                  {new Date(application.createdAt).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">Owner:</span>{" "}
                    {application.ownerName}
                  </div>
                  <div>
                    <span className="font-medium">Phone:</span>{" "}
                    {application.phoneNumber}
                  </div>
                  {application.location && (
                    <div>
                      <span className="font-medium">Location:</span>{" "}
                      {application.location}
                    </div>
                  )}
                </div>
                <div className="mt-4">
                  <Link to="/application/$id" params={{ id: application.id }}>
                    <Button variant="outline" size="sm">
                      View Details
                    </Button>
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
