"use client"

import { useState, useRef } from "react"
import { useApi } from "@/hooks/use-api"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Day } from "@/types"

interface AutoPlaceConfirmationProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  draftId: string
  activeDay: Day
}

// Handles file upload for company import, sends to /api/drafts/[id]/import, and displays results
export function AutoPlaceConfirmationDialog({
  open,
  onOpenChange,
  draftId,
  activeDay,
}: AutoPlaceConfirmationProps) {
  const { apiFetch } = useApi()
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
                console.log("Confirmed!")
              }}
            >
              Confirm
            </Button>

          </div>

        </div>
      </DialogContent>
    </Dialog>
  )
}
