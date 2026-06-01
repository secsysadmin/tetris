"use client"

import { useState } from "react"
import { useMapStore } from "@/store/map-store"
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

        <DialogDescription>
          <br/>
          <b><u>YOU MUST DEFINE RANGES IN "Industry Ranges" FIRST</u></b> <br/> <br/>
          <b><i>Are you sure you want to auto-place all companies for <u>{dayName}</u></i>? </b> <br/> <br/>
          This will attempt to place all unassigned companies for {dayName} into available booths. It will not move any already assigned companies. This action cannot be undone, but you can always make manual adjustments afterward. <br/> <br/>
    
          This process places companies in order of sponsorship level (Maroon first, Diamond second, etc) and then alphabetically, so if there are not enough booths for all companies, some lower priority ones may not get placed. Additionally, it places companies from the top of a row to bottom as viewed on the map (e.g. 16 to 30 then 15 to 1).
        </DialogDescription>

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

      </DialogContent>
    </Dialog>
  )
}
