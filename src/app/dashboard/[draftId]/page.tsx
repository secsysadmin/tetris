"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { useApi } from "@/hooks/use-api"
import { useMapStore } from "@/store/map-store"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import dynamic from "next/dynamic"
import { CompanySidebar } from "@/components/sidebar/company-sidebar"
import { ImportDialog } from "@/components/sidebar/import-dialog"
import { IndustryRangeDialog } from "@/components/sidebar/industry-range-dialog"
import { CapacityDashboard } from "@/components/dashboard/capacity-dashboard"

const BoothMap = dynamic(
  () => import("@/components/map/booth-map").then((mod) => mod.BoothMap),
  { ssr: false, loading: () => <div className="flex h-full items-center justify-center text-muted-foreground">Loading map...</div> }
)
import { ArrowLeft, Download, Upload } from "lucide-react"
import type { Day, IndustryRangeConfig } from "@/types"
import { toast } from "sonner"
import { AutoPlaceConfirmationDialog } from "@/components/sidebar/auto-complete-confirmation"

type View = "dashboard" | "map"

export default function EditorPage() {
  const params = useParams()
  const router = useRouter()
  const draftId = params.draftId as string
  const { user, loading } = useAuth()
  const { apiFetch } = useApi()
  const [draftName, setDraftName] = useState("")
  const [industryRanges, setIndustryRanges] = useState<IndustryRangeConfig | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [autoCompleteConfirmOpen, setAutoCompleteConfirmOpen] = useState(false)
  const [industryRangesOpen, setIndustryRangesOpen] = useState(false)
  const [view, setView] = useState<View>("map")

  const {
    activeDay,
    setActiveDay,
    setDraftId,
    setCompanies,
    setAssignments,
    setCapacityPerDay,
    setIndustryZones,
  } = useMapStore()

  const loadDraft = useCallback(async () => {

    setCompanies([])
    setAssignments([])
    setDraftName("")

    const res = await apiFetch(`/api/drafts/${draftId}`)
    if (res.ok) {
      const draft = await res.json()
      setDraftName(draft.name)
      setIndustryRanges(draft.industryRanges ?? {})
      setDraftId(draft.id)
      setCompanies(draft.companies)
      setAssignments(draft.assignments)
      setCapacityPerDay(draft.capacityPerDay)
      setIndustryZones(draft.industryZones)
    } else {
      router.push("/dashboard")
    }
  }, [
    apiFetch,
    draftId,
    setDraftId,
    setCompanies,
    setAssignments,
    setCapacityPerDay,
    setIndustryZones,
    router,
  ])

  useEffect(() => {
    if (!loading && !user) {
      router.push("/")
    }
  }, [user, loading, router])

  useEffect(() => {
    if (user) loadDraft() // eslint-disable-line react-hooks/set-state-in-effect
  }, [user, loadDraft])

  async function handleExportCSV(format?: "report") {
    const url = format
      ? `/api/drafts/${draftId}/export?format=${format}`
      : `/api/drafts/${draftId}/export`

    const res = await apiFetch(url)
    if (res.ok) {
      const blob = await res.blob()
      const downloadUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = downloadUrl
      a.download = format
        ? `${draftName}-Placement-Report.csv`
        : `${draftName}-Assignments.csv`
      a.click()
      URL.revokeObjectURL(downloadUrl)
      toast.success("Export downloaded")
    } else {
      toast.error("Export failed")
    }
  }

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  const onMap = view === "map"

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between gap-3 border-b bg-white px-4 py-2">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/dashboard")}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
          <h1 className="text-lg font-semibold">{draftName}</h1>
        </div>

        <Tabs value={view} onValueChange={(v) => setView(v as View)}>
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="map">Booth Map</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          {onMap && (
            <>
              <Tabs
                value={activeDay}
                onValueChange={(v) => setActiveDay(v as Day)}
              >
                <TabsList>
                  <TabsTrigger value="WEDNESDAY">Wednesday</TabsTrigger>
                  <TabsTrigger value="THURSDAY">Thursday</TabsTrigger>
                </TabsList>
              </Tabs>

              <Button
                variant="default"
                size="sm"
                onClick={() => setIndustryRangesOpen(true)}
              >
                Industry Ranges
              </Button>

              <Button
                variant="default"
                size="sm"
                onClick={() => setAutoCompleteConfirmOpen(true)}
              >
                Auto-Place
              </Button>
            </>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setImportOpen(true)}
          >
            <Upload className="mr-1 h-4 w-4" />
            Import
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="mr-1 h-4 w-4" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExportCSV()}>
                Assignments (CSV)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportCSV("report")}>
                Placement report (CSV)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                const fn = useMapStore.getState().exportMapFn
                if (fn) fn()
                else toast.error("Map not ready")
              }}>
                Map (PNG)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main content */}
      {onMap ? (
        <div className="flex flex-1 overflow-hidden">
          <CompanySidebar />
          <div className="flex-1 overflow-hidden bg-gray-100">
            <BoothMap />
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto bg-gray-50">
          <CapacityDashboard />
        </div>
      )}

      {/* Import dialog */}
      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        draftId={draftId}
        onImportComplete={loadDraft}
      />

      {/* Auto-complete confirmation dialog */}
      <AutoPlaceConfirmationDialog
        open={autoCompleteConfirmOpen}
        onOpenChange={setAutoCompleteConfirmOpen}
        activeDay={activeDay}
       />

      <IndustryRangeDialog
        open={industryRangesOpen}
        onOpenChange={setIndustryRangesOpen}
        draftId={draftId}
        initialRanges={industryRanges}
        onSaved={setIndustryRanges}
      />
      
    </div>
  )
}
