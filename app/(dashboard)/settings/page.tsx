import { Card, CardContent } from "@/components/ui/card"

export default function SettingsPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-6 py-6 animate-fade-in">
      <div className="space-y-1">
        <h1 className="font-grotesk text-lg font-semibold text-foreground">
          Settings
        </h1>
        <p className="text-sm text-foreground mt-0.5">
          Manage your account and preferences.
        </p>
      </div>

      <Card className="glass-card border-border">
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            Profile, authentication, and notification settings will appear here.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
