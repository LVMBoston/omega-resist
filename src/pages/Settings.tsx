import { useState } from "react";
import { useSettings } from "@/hooks/useSettings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Save } from "lucide-react";
import { LogoUpload } from "@/components/LogoUpload";

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
  const brandingSettings = settings?.filter((s) => s.category === "branding") || [];
  const qrDefaultsSettings = settings?.filter((s) => s.category === "qr_defaults") || [];

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
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="email">Email Templates</TabsTrigger>
            <TabsTrigger value="sms">SMS Templates</TabsTrigger>
            <TabsTrigger value="utm">UTM Vocabularies</TabsTrigger>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="branding">Branding</TabsTrigger>
            <TabsTrigger value="qr_defaults">QR Defaults</TabsTrigger>
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

          <TabsContent value="branding" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-3">
              {[1, 2, 3].map((num) => {
                const logoSetting = brandingSettings.find((s) => s.key === `logo_${num}`);
                const defaultSetting = brandingSettings.find((s) => s.key === "default_logo");
                
                if (!logoSetting) return null;

                const logoValue = getValue(logoSetting);
                const defaultValue = getValue(defaultSetting);
                // Check if this logo is the default (number format)
                const isDefault = defaultValue?.selected === num;

                return (
                  <LogoUpload
                    key={num}
                    logoNumber={num as 1 | 2 | 3}
                    currentUrl={logoValue?.url || null}
                    isDefault={isDefault}
                    onUpload={(url) => {
                      const newValue = { ...logoValue, url };
                      setValue(logoSetting.id, newValue);
                      // Force immediate save
                      updateSetting({ id: logoSetting.id, value: newValue });
                    }}
                    onDelete={() => {
                      setValue(logoSetting.id, { ...logoValue, url: null });
                      handleSave(logoSetting.id);
                      
                      // If this was the default, clear default selection
                      if (isDefault && defaultSetting) {
                        setValue(defaultSetting.id, { selected: null });
                        handleSave(defaultSetting.id);
                      }
                    }}
                    onSelectDefault={() => {
                      if (defaultSetting) {
                        console.log('Setting default logo to:', num);
                        console.log('Default setting ID:', defaultSetting.id);
                        const newValue = { selected: num };
                        console.log('New value:', newValue);
                        setValue(defaultSetting.id, newValue);
                        // Force immediate save
                        updateSetting({ id: defaultSetting.id, value: newValue });
                      } else {
                        console.error('Default setting not found!');
                      }
                    }}
                  />
                );
              })}
            </div>
            
            {brandingSettings.find((s) => s.key === "default_logo")?.value?.selected && (
              <Card className="bg-muted/50">
                <CardHeader>
                  <CardTitle>Default Logo</CardTitle>
                  <CardDescription>
                    Logo {brandingSettings.find((s) => s.key === "default_logo")?.value?.selected} is currently set as the default logo for QR codes and other branding materials.
                  </CardDescription>
                </CardHeader>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="qr_defaults" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>QR Code Generation Defaults</CardTitle>
                <CardDescription>
                  Configure default settings for QR code generation. These settings will be applied when generating new L00 tokens.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {qrDefaultsSettings.map((setting) => {
                  const value = getValue(setting);
                  
                  // Size preset selector
                  if (setting.key === "size_preset") {
                    return (
                      <div key={setting.id} className="space-y-2">
                        <Label>{setting.description}</Label>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { key: "small", label: "Small (255x255)", size: "255px, 12pt font" },
                            { key: "medium", label: "Medium (512x512)", size: "512px, 24pt font" },
                            { key: "large", label: "Large (1000x1000)", size: "1000px, 48pt font" },
                          ].map((preset) => (
                            <Button
                              key={preset.key}
                              variant={value?.selected === preset.key ? "default" : "outline"}
                              onClick={() => {
                                setValue(setting.id, { selected: preset.key });
                                handleSave(setting.id);
                              }}
                              className="flex flex-col h-auto py-3"
                            >
                              <span className="font-semibold">{preset.label}</span>
                              <span className="text-xs opacity-70">{preset.size}</span>
                            </Button>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  
                  // Caption fields
                  if (setting.key === "top_caption" || setting.key === "bottom_caption") {
                    return (
                      <div key={setting.id} className="space-y-2">
                        <Label htmlFor={setting.id}>{setting.description}</Label>
                        <Input
                          id={setting.id}
                          value={value?.text || ""}
                          onChange={(e) => setValue(setting.id, { ...value, text: e.target.value })}
                          placeholder={setting.key === "bottom_caption" ? "Use {eoa_title} as placeholder" : "Leave empty for no caption"}
                        />
                        {setting.key === "bottom_caption" && (
                          <p className="text-xs text-muted-foreground">
                            Use {"{eoa_title}"} to automatically insert the Event/Action title
                          </p>
                        )}
                        <Button
                          onClick={() => handleSave(setting.id)}
                          disabled={editedValues[setting.id] === undefined}
                          size="sm"
                        >
                          <Save className="mr-2 h-4 w-4" />
                          Save
                        </Button>
                      </div>
                    );
                  }
                  
                  // Color fields
                  if (setting.key.includes("color")) {
                    return (
                      <div key={setting.id} className="space-y-2">
                        <Label htmlFor={setting.id}>{setting.description}</Label>
                        <div className="flex gap-2">
                          <Input
                            type="color"
                            value={value?.value || "#000000"}
                            onChange={(e) => setValue(setting.id, { ...value, value: e.target.value })}
                            className="w-20 h-10 p-1"
                          />
                          <Input
                            value={value?.value || "#000000"}
                            onChange={(e) => setValue(setting.id, { ...value, value: e.target.value })}
                            placeholder="#000000"
                          />
                        </div>
                        <Button
                          onClick={() => handleSave(setting.id)}
                          disabled={editedValues[setting.id] === undefined}
                          size="sm"
                        >
                          <Save className="mr-2 h-4 w-4" />
                          Save
                        </Button>
                      </div>
                    );
                  }
                  
                  // Numeric fields
                  return (
                    <div key={setting.id} className="space-y-2">
                      <Label htmlFor={setting.id}>{setting.description}</Label>
                      <Input
                        id={setting.id}
                        type="number"
                        value={value?.value || 0}
                        onChange={(e) => setValue(setting.id, { ...value, value: Number(e.target.value) })}
                        min={0}
                      />
                      <Button
                        onClick={() => handleSave(setting.id)}
                        disabled={editedValues[setting.id] === undefined}
                        size="sm"
                      >
                        <Save className="mr-2 h-4 w-4" />
                        Save
                      </Button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
