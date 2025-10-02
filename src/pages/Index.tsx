import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderOpen, Play } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-6 py-6">
          <h1 className="text-3xl font-bold">Deck System</h1>
          <p className="text-muted-foreground mt-1">Content preparation for tracking</p>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12">
        <div className="max-w-4xl mx-auto grid gap-6 md:grid-cols-2">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5" />
                Build Deck
              </CardTitle>
              <CardDescription>
                Upload a ZIP file of PNG or JPG images to create a new slide deck
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/build">
                <Button className="w-full">
                  Create New Deck
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="h-5 w-5" />
                View Deck
              </CardTitle>
              <CardDescription>
                Enter a deck slug to view it in carousel mode
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  After building a deck, access it at:
                </p>
                <code className="block p-3 bg-muted rounded-lg text-sm">
                  /deck/your-deck-slug
                </code>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Index;
