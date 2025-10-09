import { useState } from "react";
import { useSettings } from "@/hooks/useSettings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Save } from "lucide-react";

export default function Settings() {
  const { settings, isLoading, updateSetting } = useSettings();
  const [editedValues, setEditedValues] = useState<Record<string, any>>({});

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  const emailSettings = settings?.filter((s) => s.category === "email") || [];
  const smsSettings = settings?.filter((s) => s.category === "sms") || [];
  const utmSettings = settings?.filter((s) => s.category === "utm") || [];
  const generalSettings = settings?.filter((s) => s.category === "general") || [];

  const handleSave = (id: string) => {
    if (editedValues[id]) {
      updateSetting({ id, value: editedValues[id] });
      setEditedValues((prev) => {
        const newState = { ...prev };
        delete newState[id];
        return newState;
      });
    }
  };

  const getValue = (setting: any) => {
    return editedValues[setting.id] !== undefined
      ? editedValues[setting.id]
      : setting.value;
  };

  const setValue = (id: string, value: any) => {
    setEditedValues((prev) => ({ ...prev, [id]: value }));
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <h1 className="text-3xl font-bold">Application Settings</h1>
          <p className="text-muted-foreground">
            Manage email templates, SMS messages, and UTM vocabularies
          </p>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <Tabs defaultValue="email" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="email">Email Templates</TabsTrigger>
            <TabsTrigger value="sms">SMS Templates</TabsTrigger>
            <TabsTrigger value="utm">UTM Vocabularies</TabsTrigger>
            <TabsTrigger value="general">General</TabsTrigger>
          </TabsList>

          <TabsContent value="email" className="space-y-4">
            {emailSettings.map((setting) => {
              const value = getValue(setting);
              return (
                <Card key={setting.id}>
                  <CardHeader>
                    <CardTitle className="capitalize">{setting.key.replace(/_/g, " ")}</CardTitle>
                    <CardDescription>{setting.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor={`${setting.id}-subject`}>Subject</Label>
                      <Input
                        id={`${setting.id}-subject`}
                        value={value.subject || ""}
                        onChange={(e) =>
                          setValue(setting.id, { ...value, subject: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor={`${setting.id}-body`}>Body</Label>
                      <Textarea
                        id={`${setting.id}-body`}
                        value={value.body || ""}
                        onChange={(e) =>
                          setValue(setting.id, { ...value, body: e.target.value })
                        }
                        rows={6}
                        className="font-mono text-sm"
                      />
                      <p className="text-sm text-muted-foreground mt-2">
                        Use {`{{link}}`} as a placeholder for the generated link
                      </p>
                    </div>
                    <Button
                      onClick={() => handleSave(setting.id)}
                      disabled={editedValues[setting.id] === undefined}
                    >
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          <TabsContent value="sms" className="space-y-4">
            {smsSettings.map((setting) => {
              const value = getValue(setting);
              return (
                <Card key={setting.id}>
                  <CardHeader>
                    <CardTitle className="capitalize">{setting.key.replace(/_/g, " ")}</CardTitle>
                    <CardDescription>{setting.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor={`${setting.id}-body`}>Message</Label>
                      <Textarea
                        id={`${setting.id}-body`}
                        value={value.body || ""}
                        onChange={(e) =>
                          setValue(setting.id, { ...value, body: e.target.value })
                        }
                        rows={3}
                        className="font-mono text-sm"
                      />
                      <p className="text-sm text-muted-foreground mt-2">
                        Use {`{{link}}`} as a placeholder for the generated link
                      </p>
                    </div>
                    <Button
                      onClick={() => handleSave(setting.id)}
                      disabled={editedValues[setting.id] === undefined}
                    >
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          <TabsContent value="utm" className="space-y-4">
            {utmSettings.map((setting) => {
              const value = getValue(setting);
              const arrayValue = Array.isArray(value) ? value : [];
              return (
                <Card key={setting.id}>
                  <CardHeader>
                    <CardTitle className="capitalize">{setting.key.replace(/_/g, " ")}</CardTitle>
                    <CardDescription>{setting.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor={`${setting.id}-values`}>Values (comma-separated)</Label>
                      <Input
                        id={`${setting.id}-values`}
                        value={arrayValue.join(", ")}
                        onChange={(e) =>
                          setValue(
                            setting.id,
                            e.target.value.split(",").map((v) => v.trim()).filter(Boolean)
                          )
                        }
                        placeholder="value1, value2, value3"
                      />
                    </div>
                    <Button
                      onClick={() => handleSave(setting.id)}
                      disabled={editedValues[setting.id] === undefined}
                    >
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          <TabsContent value="general" className="space-y-4">
            {generalSettings.map((setting) => {
              const value = getValue(setting);
              return (
                <Card key={setting.id}>
                  <CardHeader>
                    <CardTitle className="capitalize">{setting.key.replace(/_/g, " ")}</CardTitle>
                    <CardDescription>{setting.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor={`${setting.id}-value`}>Value</Label>
                      <Input
                        id={`${setting.id}-value`}
                        value={value.value || ""}
                        onChange={(e) =>
                          setValue(setting.id, { ...value, value: e.target.value })
                        }
                      />
                    </div>
                    <Button
                      onClick={() => handleSave(setting.id)}
                      disabled={editedValues[setting.id] === undefined}
                    >
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
