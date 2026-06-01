"use client"

import { useMemo, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { useApi } from "@/hooks/use-api"
import { getBoothById } from "@/lib/booth-geometry"
import { ALL_ROWS } from "@/lib/constants"
import type { Industry, IndustryRangeConfig, IndustryRangeSpec } from "@/types"

const INDUSTRIES: Industry[] = [
  "AEROSPACE",
  "MECHANICAL",
  "ENERGY",
  "CHEMICALS",
  "OIL",
  "CIVIL",
  "TECH",
  "SEMICONDUCTORS",
  "OTHER",
]

type RangeErrorMap = Record<string, string>

type RangeType = "booth" | "row" | "boothList"

type RangeRow = {
  type: RangeType
  from: string
  to: string
  booths: string
}

type IndustryRangeDraft = Partial<Record<Industry, RangeRow[]>>

interface IndustryRangeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  draftId: string
  initialRanges: IndustryRangeConfig | null | undefined
  onSaved: (ranges: IndustryRangeConfig) => void
}

function normalizeBoothId(raw: string): string | null {
  const value = raw.trim().toUpperCase()
  const match = value.match(/^([A-Q])\s*-?\s*(\d{1,2})$/)
  if (!match) return null
  const row = match[1]
  const num = parseInt(match[2], 10)
  const id = `${row}-${num}`
  return getBoothById(id) ? id : null
}

function toRangeRows(specs: IndustryRangeSpec[] | undefined): RangeRow[] {
  if (!specs) return []
  return specs.map((spec) => {
    if (spec.type === "booth") {
      return { type: "booth", from: spec.from, to: spec.to, booths: "" }
    }
    if (spec.type === "row") {
      return { type: "row", from: spec.from, to: spec.to, booths: "" }
    }
    return { type: "boothList", from: "", to: "", booths: spec.booths.join(", ") }
  })
}

export function IndustryRangeDialog({
  open,
  onOpenChange,
  draftId,
  initialRanges,
  onSaved,
}: IndustryRangeDialogProps) {
  const { apiFetch } = useApi()
  const [errors, setErrors] = useState<RangeErrorMap>({})
  const [saving, setSaving] = useState(false)

  const [ranges, setRanges] = useState<IndustryRangeDraft>(() =>
    INDUSTRIES.reduce<IndustryRangeDraft>((acc, industry) => {
      acc[industry] = toRangeRows(initialRanges?.[industry])
      return acc
    }, {})
  )

  const industryRows = useMemo(
    () =>
      INDUSTRIES.map((industry) => ({
        industry,
        rows: ranges[industry] || [],
      })),
    [ranges]
  )

  function resetState() {
    setRanges(
      INDUSTRIES.reduce<IndustryRangeDraft>((acc, industry) => {
        acc[industry] = toRangeRows(initialRanges?.[industry])
        return acc
      }, {})
    )
    setErrors({})
    setSaving(false)
  }

  function updateRange(
    industry: Industry,
    index: number,
    field: "from" | "to" | "booths" | "type",
    value: string
  ) {
    setRanges((prev) => {
      const current = prev[industry] || []
      const next = current.map((row, idx) => {
        if (idx !== index) return row
        if (field === "type") {
          const nextType = value as RangeType
          return {
            type: nextType,
            from: nextType === "row" ? row.from : row.from,
            to: nextType === "row" ? row.to : row.to,
            booths: nextType === "boothList" ? row.booths : "",
          }
        }
        return { ...row, [field]: value }
      })
      return { ...prev, [industry]: next }
    })
    setErrors((prev) => {
      const next = { ...prev }
      if (field === "type") {
        delete next[`${industry}-${index}-from`]
        delete next[`${industry}-${index}-to`]
        delete next[`${industry}-${index}-booths`]
        return next
      }
      const key = `${industry}-${index}-${field}`
      if (!next[key]) return prev
      delete next[key]
      return next
    })
  }

  function addRange(industry: Industry) {
    setRanges((prev) => {
      const current = prev[industry] || []
      return {
        ...prev,
        [industry]: [...current, { type: "booth", from: "", to: "", booths: "" }],
      }
    })
  }

  function removeRange(industry: Industry, index: number) {
    setRanges((prev) => {
      const current = prev[industry] || []
      return { ...prev, [industry]: current.filter((_, idx) => idx !== index) }
    })
    setErrors((prev) => {
      const next = { ...prev }
      delete next[`${industry}-${index}-from`]
      delete next[`${industry}-${index}-to`]
      delete next[`${industry}-${index}-booths`]
      return next
    })
  }

  function normalizeRow(value: string): string | null {
    const row = value.trim().toUpperCase()
    return (ALL_ROWS as readonly string[]).includes(row) ? row : null
  }

  function parseBoothList(value: string): string[] {
    return value
      .split(",")
      .map((token) => token.trim())
      .filter((token) => token.length > 0)
  }

  function validateRanges(): { valid: boolean; cleaned: IndustryRangeConfig } {
    const nextErrors: RangeErrorMap = {}
    const cleaned: IndustryRangeConfig = {}

    for (const industry of INDUSTRIES) {
      const rows = ranges[industry] || []
      const specs: IndustryRangeSpec[] = []

      rows.forEach((row, index) => {
        if (row.type === "booth") {
          const fromId = normalizeBoothId(row.from)
          const toId = normalizeBoothId(row.to)

          if (!fromId) nextErrors[`${industry}-${index}-from`] = "Invalid booth"
          if (!toId) nextErrors[`${industry}-${index}-to`] = "Invalid booth"

          if (fromId && toId) {
            specs.push({ type: "booth", from: fromId, to: toId })
          }
        } else if (row.type === "row") {
          const fromRow = normalizeRow(row.from)
          const toRow = normalizeRow(row.to || row.from)

          if (!fromRow) nextErrors[`${industry}-${index}-from`] = "Invalid row"
          if (!toRow) nextErrors[`${industry}-${index}-to`] = "Invalid row"

          if (fromRow && toRow) {
            specs.push({ type: "row", from: fromRow, to: toRow })
          }
        } else {
          const tokens = parseBoothList(row.booths)
          if (tokens.length === 0) {
            nextErrors[`${industry}-${index}-booths`] = "Add at least one booth"
            return
          }
          const normalized: string[] = []
          for (const token of tokens) {
            const id = normalizeBoothId(token)
            if (!id) {
              nextErrors[`${industry}-${index}-booths`] = "Invalid booth list"
              return
            }
            normalized.push(id)
          }
          specs.push({ type: "boothList", booths: normalized })
        }
      })

      if (specs.length > 0) cleaned[industry] = specs
    }

    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      return { valid: false, cleaned }
    }

    return { valid: true, cleaned }
  }

  async function handleSave() {
    const { valid, cleaned } = validateRanges()
    if (!valid) {
      toast.error("Fix invalid ranges before saving")
      return
    }

    setSaving(true)
    try {
      const res = await apiFetch(`/api/drafts/${draftId}`, {
        method: "PUT",
        body: JSON.stringify({ industryRanges: cleaned }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to save ranges")
      }

      onSaved(cleaned)
      toast.success("Industry ranges saved")
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save ranges")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) resetState()
        if (!nextOpen) resetState()
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Industry Ranges</DialogTitle>
        </DialogHeader>

        <DialogDescription>
            <b>Note:</b> Avoid using ranges that span multiple rows like A-14 to B-15. Instead, define separate ranges. <br/>
            <b>Example:</b> For A-1 to B-23, define one range of "Rows" as A to A and another range of "Booth range" as B-1 to B-23.<br/> <br/>
            
            The following formats are accepted for ranges:<br />
            - <b><u>Booth range:</u></b> A range of booths spanning the same row (e.g. A-1 to A-4)<br />
            - <b><u>Booth list:</u></b> A comma-separated list of booths (e.g. A-1, A-15, B-4)<br />
            - <b><u>Rows:</u></b> A range of rows (e.g. A to D to use all booths in rows A through D inclusive, A to A to use all booths in row A)<br />

        </DialogDescription>

        <div className="max-h-[60vh] overflow-y-auto pr-1">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Industry</TableHead>
                <TableHead>Ranges</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {industryRows.map(({ industry, rows }) => (
                <TableRow key={industry}>
                  <TableCell className="w-40 font-medium">{industry}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-2">
                      {rows.length === 0 && (
                        <div className="text-xs text-muted-foreground">
                          No ranges added
                        </div>
                      )}
                      {rows.map((row, index) => {
                        const fromKey = `${industry}-${index}-from`
                        const toKey = `${industry}-${index}-to`
                        const boothsKey = `${industry}-${index}-booths`
                        return (
                          <div key={`${industry}-${index}`} className="flex flex-wrap items-center gap-2">
                            <Select
                              value={row.type}
                              onValueChange={(value) => updateRange(industry, index, "type", value)}
                            >
                              <SelectTrigger className="bg-gray-300 h-8 w-[130px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-gray-300">
                                <SelectItem value="booth">Booth range</SelectItem>
                                <SelectItem value="boothList">Booth list</SelectItem>
                                <SelectItem value="row">Rows</SelectItem>
                              </SelectContent>
                            </Select>

                            {row.type === "booth" && (
                              <>
                                <div>
                                  <Input
                                    value={row.from}
                                    onChange={(event) =>
                                      updateRange(industry, index, "from", event.target.value)
                                    }
                                    placeholder="A-1"
                                    className={errors[fromKey] ? "border-destructive" : undefined}
                                  />
                                  {errors[fromKey] && (
                                    <div className="text-xs text-destructive">{errors[fromKey]}</div>
                                  )}
                                </div>
                                <span className="text-xs text-muted-foreground">to</span>
                                <div>
                                  <Input
                                    value={row.to}
                                    onChange={(event) =>
                                      updateRange(industry, index, "to", event.target.value)
                                    }
                                    placeholder="B-4"
                                    className={errors[toKey] ? "border-destructive" : undefined}
                                  />
                                  {errors[toKey] && (
                                    <div className="text-xs text-destructive">{errors[toKey]}</div>
                                  )}
                                </div>
                              </>
                            )}

                            {row.type === "row" && (
                              <>
                                <div>
                                  <Input
                                    value={row.from}
                                    onChange={(event) =>
                                      updateRange(industry, index, "from", event.target.value)
                                    }
                                    placeholder="A"
                                    className={errors[fromKey] ? "border-destructive" : undefined}
                                  />
                                  {errors[fromKey] && (
                                    <div className="text-xs text-destructive">{errors[fromKey]}</div>
                                  )}
                                </div>
                                <span className="text-xs text-muted-foreground">to</span>
                                <div>
                                  <Input
                                    value={row.to}
                                    onChange={(event) =>
                                      updateRange(industry, index, "to", event.target.value)
                                    }
                                    placeholder="B"
                                    className={errors[toKey] ? "border-destructive" : undefined}
                                  />
                                  {errors[toKey] && (
                                    <div className="text-xs text-destructive">{errors[toKey]}</div>
                                  )}
                                </div>
                              </>
                            )}

                            {row.type === "boothList" && (
                              <div className="min-w-[260px]">
                                <Input
                                  value={row.booths}
                                  onChange={(event) =>
                                    updateRange(industry, index, "booths", event.target.value)
                                  }
                                  placeholder="A-1, A-2, B-4"
                                  className={errors[boothsKey] ? "border-destructive" : undefined}
                                />
                                {errors[boothsKey] && (
                                  <div className="text-xs text-destructive">{errors[boothsKey]}</div>
                                )}
                              </div>
                            )}

                            <Button
                              type="button"
                              variant="default"
                              className="bg-red-600 hover:bg-red-700 text-white"
                              size="sm"
                              onClick={() => removeRange(industry, index)}
                            >
                              Remove
                            </Button>
                          </div>
                        )
                      })}
                      <div>
                        <Button
                          type="button"
                          variant="default"
                          size="sm"
                          onClick={() => addRange(industry)}
                        >
                          Add range
                        </Button>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
