"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface GoogleSheetsExportCardProps {
  googleSheetUrl: string
  googleWorksheetName: string
  googleConnectionEmail: string | null
  googleBusy: boolean
  onGoogleSheetUrlChange: (value: string) => void
  onGoogleWorksheetNameChange: (value: string) => void
  onSaveGoogleSettings: () => void
  onConnectGoogle: () => void
  onTestGoogleConnection: () => void
  onUpdateGoogleSheet: () => void
  onDisconnectGoogle: () => void
}

export function GoogleSheetsExportCard({
  googleSheetUrl,
  googleWorksheetName,
  googleConnectionEmail,
  googleBusy,
  onGoogleSheetUrlChange,
  onGoogleWorksheetNameChange,
  onSaveGoogleSettings,
  onConnectGoogle,
  onTestGoogleConnection,
  onUpdateGoogleSheet,
  onDisconnectGoogle,
}: GoogleSheetsExportCardProps) {
  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>Google Sheets Export</CardTitle>
        <CardDescription>Connect a Google account and send the current draft into a spreadsheet.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="google-sheet-url">Google Sheet URL</Label>
          <Input
            id="google-sheet-url"
            placeholder="https://docs.google.com/spreadsheets/d/..."
            value={googleSheetUrl}
            onChange={(e) => onGoogleSheetUrlChange(e.target.value)}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="google-worksheet-name">Worksheet Name</Label>
          <Input
            id="google-worksheet-name"
            value={googleWorksheetName}
            onChange={(e) => onGoogleWorksheetNameChange(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onSaveGoogleSettings}>
            Save Settings
          </Button>
          {googleConnectionEmail ? (
            <>
              <Button type="button" variant="outline" size="sm" onClick={onTestGoogleConnection} disabled={googleBusy}>
                Test Connection
              </Button>
              <Button type="button" variant="default" size="sm" onClick={onUpdateGoogleSheet} disabled={googleBusy}>
                Update Google Sheet
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={onDisconnectGoogle} disabled={googleBusy}>
                Disconnect
              </Button>
            </>
          ) : (
            <Button type="button" variant="default" size="sm" onClick={onConnectGoogle} disabled={googleBusy}>
              Connect Google Account
            </Button>
          )}
        </div>

        {googleConnectionEmail ? (
          <p className="text-sm text-muted-foreground">Connected account: {googleConnectionEmail}</p>
        ) : (
          <p className="text-sm text-muted-foreground">No Google account connected yet.</p>
        )}
      </CardContent>
    </Card>
  )
}
