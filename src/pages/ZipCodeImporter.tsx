import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Upload, CheckCircle, XCircle } from "lucide-react";

export default function ZipCodeImporter() {
  const { toast } = useToast();
  const [isImporting, setIsImporting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<{
    imported: number;
    failed: number;
    total: number;
  } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
    }
  };

  const handleImport = async () => {
    if (!file) {
      toast({
        title: "No file selected",
        description: "Please select an Excel file to import",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);
    setResult(null);

    try {
      // Create form data with the file
      const formData = new FormData();
      formData.append('file', file);

      // Call the edge function
      const { data, error } = await supabase.functions.invoke('import-zip-codes', {
        body: formData,
      });

      if (error) throw error;

      if (data.success) {
        setResult({
          imported: data.imported,
          failed: data.failed,
          total: data.total,
        });
        toast({
          title: "Import successful!",
          description: `Imported ${data.imported} zip codes into the database`,
        });
      } else {
        throw new Error(data.error || "Import failed");
      }
    } catch (error: any) {
      console.error("Import error:", error);
      toast({
        title: "Import failed",
        description: error.message || "An error occurred during import",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-4xl font-bold mb-2">Zip Code Importer</h1>
          <p className="text-muted-foreground">
            Import US zip code data from an Excel file into the database
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Upload Zip Code Data</CardTitle>
            <CardDescription>
              Select an Excel file (.xlsx) containing zip code data with columns: zip, lat, lng, city, state_id, state_name, timezone
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                disabled={isImporting}
              />
              {file && (
                <p className="text-sm text-muted-foreground">
                  Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
            </div>

            <Button
              onClick={handleImport}
              disabled={!file || isImporting}
              className="w-full"
              size="lg"
            >
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Import Zip Codes
                </>
              )}
            </Button>

            {isImporting && (
              <div className="space-y-2">
                <Progress value={undefined} className="w-full" />
                <p className="text-sm text-muted-foreground text-center">
                  Processing file and importing data...
                </p>
              </div>
            )}

            {result && (
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <h3 className="font-semibold">Import Complete</h3>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Total records:</span>
                    <strong>{result.total}</strong>
                  </div>
                  <div className="flex justify-between text-green-600">
                    <span>Successfully imported:</span>
                    <strong>{result.imported}</strong>
                  </div>
                  {result.failed > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>Failed:</span>
                      <strong>{result.failed}</strong>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <ol className="list-decimal list-inside space-y-2">
              <li>Select your Excel file (.xlsx) containing US zip code data</li>
              <li>The file should have these columns: zip, lat, lng, city, state_id, state_name, timezone</li>
              <li>Click "Import Zip Codes" to start the import process</li>
              <li>The import will clear existing data and insert all new zip codes in batches</li>
              <li>Once complete, the simulator will use this data for location-based token generation</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
