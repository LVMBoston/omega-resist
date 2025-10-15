import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";
import omegaLogo from "@/assets/omega-logo.png";
const Index = () => {
  useEffect(() => {
    document.title = "Democracy Forge | Event Management System";
  }, []);
  return <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8">
      <div className="max-w-md text-center space-y-6">
        <img src={omegaLogo} alt="Omega Resistance Logo" className="w-96 mx-auto" />
        <h1 className="font-bold text-6xl text-black">OMEGA</h1>
        <h2 className="font-bold text-4xl text-black">Tools and Infrastructure for Campaigns of Resistance</h2>
        <p className="text-muted-foreground">
          Manage your campaigns, decks, and analytics
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button asChild>
            <Link to="/admin">
              Admin Dashboard
            </Link>
          </Button>
        </div>
      </div>
    </div>;
};
export default Index;