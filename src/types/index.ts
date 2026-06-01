export type Day = "WEDNESDAY" | "THURSDAY"
export type Sponsorship = "MAROON" | "DIAMOND" | "GOLD" | "SILVER" | "BASIC"
export type Industry = 
  "AEROSPACE" |
  "MECHANICAL" |
  "ENERGY" |
  "CHEMICALS" |
  "OIL" |
  "CIVIL" |
  "TECH" |
  "SEMICONDUCTORS" |
  "OTHER"

export type IndustryRangeSpec =
  | { type: "row"; from: string; to: string }
  | { type: "booth"; from: string; to: string }
  | { type: "boothList"; booths: string[] }

export type IndustryRangeConfig = Partial<Record<Industry, IndustryRangeSpec[]>>

export interface Company {
  id: string
  name: string
  days: Day[]
  sponsorship: Sponsorship
  hasQueue: boolean
  industry: Industry
  isPlaceholder: boolean
  draftId: string
}

export interface BoothAssignment {
  id: string
  companyId: string
  draftId: string
  boothIds: string[]
  day: Day | null // null = both days
}

export interface Draft {
  id: string
  name: string
  userId: string
  companies: Company[]
  assignments: BoothAssignment[]
  industryRanges?: IndustryRangeConfig | null
  createdAt: string
  updatedAt: string
}

export interface BoothDefinition {
  id: string        // e.g. "G-14"
  row: string       // "A" through "Q"
  number: number    // 1-30 (or 1-15 for edge)
  segment: 1 | 2 | 3 | 4
  x: number         // pixel x on canvas
  y: number         // pixel y on canvas
  width: number
  height: number
}

export interface SidebarFilter {
  search: string
  sponsorship: Sponsorship | "all"
  assignmentStatus: "assigned" | "unassigned" | "all"
}
