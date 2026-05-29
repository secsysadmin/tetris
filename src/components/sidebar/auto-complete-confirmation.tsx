"use client"

import { useState } from "react"
import { useMapStore } from "@/store/map-store"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Day } from "@/types"
import { toast } from "sonner"

interface AutoPlaceConfirmationProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  activeDay: Day
}

// Handles dialog for confirming auto-placement of all companies for the active day. Called from the "Auto-Place" button in the top bar.
export function AutoPlaceConfirmationDialog({
  open,
  onOpenChange,
  activeDay,
}: AutoPlaceConfirmationProps) {
  const { autoPlaceCompanies } = useMapStore()
  const [isPlacing, setIsPlacing] = useState(false)
  const dayName = activeDay === "WEDNESDAY" ? "Wednesday" : "Thursday"


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Auto-Place Confirmation</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="text-sm text-muted-foreground">
            <p><b>Are you sure you want to auto-place all {dayName} companies?</b></p>
            <p>
                This will attempt to place all unassigned companies for {dayName} into available booths.
                It will not move any already assigned companies.
                This action cannot be undone, but you can always make manual adjustments afterward.
            </p>

            <br></br>

            <Button
              variant="default"
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={async () => {
                setIsPlacing(true)
                try {
                  const result = await autoPlaceCompanies(activeDay)
                  if (result.placedCount > 0) {
                    toast.success(`Auto-placed ${result.placedCount} companies`)
                  } else {
                    toast.info("No available booths for auto-place")
                  }
                  onOpenChange(false)
                } catch {
                  // Store already showed error toast
                } finally {
                  setIsPlacing(false)
                }
              }}
              disabled={isPlacing}
            >
              {isPlacing ? "Placing..." : "Confirm"}
            </Button>

          </div>

        </div>
      </DialogContent>
    </Dialog>
  )
}
