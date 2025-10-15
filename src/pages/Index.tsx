import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";

const Index = () => {
  useEffect(() => {
    document.title = "Democracy Forge | Event Management System";
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8">
      <div className="max-w-md text-center space-y-6">
        <h1 className="text-3xl font-bold">Event Management System</h1>
        <p className="text-muted-foreground">
          Manage your campaigns, decks, and analytics
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button asChild>
            <Link to="/admin">
              Admin Dashboard
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/simulator">
              Simulator
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
