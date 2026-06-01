import { create } from "zustand"
import type {
  Company,
  BoothAssignment,
  BoothDefinition,
  Day,
  Sponsorship,
  SidebarFilter,
} from "@/types"
import { getBoothLayout } from "@/lib/booth-geometry"
import { authFetch } from "@/lib/auth-fetch"
import { toast } from "sonner"

interface MapStore {
  // Data
  draftId: string | null
  companies: Company[]
  assignments: BoothAssignment[]
  booths: BoothDefinition[]

  // UI State
  activeDay: Day
  draggedCompany: Company | null
  hoveredBooths: string[]
  hoveredValid: boolean
  selectedCompany: string | null
  repositioning: boolean  // true when a selected company is being moved
  tooltip: { x: number; y: number; boothId: string; companyName: string; sponsorship: string; boothIds: string[] } | null
  contextMenu: { x: number; y: number; boothId: string; companyId: string | null; assignmentId: string | null } | null

  // Export
  exportMapFn: (() => void) | null
  setExportMapFn: (fn: (() => void) | null) => void

  // Filters
  sidebarFilter: SidebarFilter

  // Data actions
  setDraftId: (id: string) => void
  setCompanies: (companies: Company[]) => void
  setAssignments: (assignments: BoothAssignment[]) => void
  addCompany: (company: Company) => void
  updateCompany: (id: string, updates: Partial<Company>) => Promise<void>

  // Assignment actions
  assignCompany: (companyId: string, boothIds: string[], day: Day | null) => Promise<void>
  unassignCompany: (companyId: string) => Promise<void>
  unassignAll: () => Promise<void>
  moveCompany: (assignmentId: string, newBoothIds?: string[], newDay?: Day | null) => Promise<void>
  autoPlaceCompanies: (day: Day) => Promise<{
    created: BoothAssignment[]
    placedCount: number
    unassignedCount: number
    skippedCount: number
  }>
  blockBooth: (boothId: string, day: Day) => Promise<void>
  unblockBooth: (assignmentId: string) => Promise<void>

  // UI actions
  setActiveDay: (day: Day) => void
  setDraggedCompany: (company: Company | null) => void
  setHoveredBooths: (boothIds: string[], valid: boolean) => void
  setSelectedCompany: (companyId: string | null) => void
  startRepositioning: (companyId: string) => void
  cancelRepositioning: () => void
  setTooltip: (tooltip: MapStore["tooltip"]) => void
  setContextMenu: (menu: MapStore["contextMenu"]) => void
  setSidebarFilter: (filter: Partial<SidebarFilter>) => void

  // Derived helpers
  getAssignmentsForDay: (day: Day) => BoothAssignment[]
  getUnassignedCompanies: (day: Day) => Company[]
  getBoothOccupant: (boothId: string, day: Day) => { company: Company; assignment: BoothAssignment } | null
  isBoothAvailable: (boothId: string, day: Day) => boolean
  getOccupiedBoothIds: (day: Day) => Set<string>
  getAssignmentForCompany: (companyId: string) => BoothAssignment | undefined
}

export const useMapStore = create<MapStore>((set, get) => ({
  // Initial state
  draftId: null,
  companies: [],
  assignments: [],
  booths: getBoothLayout(),

  activeDay: "WEDNESDAY",
  draggedCompany: null,
  hoveredBooths: [],
  hoveredValid: true,
  selectedCompany: null,
  repositioning: false,
  tooltip: null,
  contextMenu: null,
  exportMapFn: null,

  sidebarFilter: {
    search: "",
    sponsorship: "all",
    assignmentStatus: "all",
  },

  // Data actions
  setDraftId: (id) => set({ draftId: id }),
  setCompanies: (companies) => set({ companies }),
  setAssignments: (assignments) => set({ assignments }),

  addCompany: (company) =>
    set((state) => ({ companies: [...state.companies, company] })),

  updateCompany: async (id, updates) => {
    const snapshot = get().companies
    // Optimistic update
    set((state) => ({
      companies: state.companies.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    }))
    try {
      const res = await authFetch(`/api/companies/${id}`, {
        method: "PUT",
        body: JSON.stringify(updates),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to update company")
      }
      const updated = await res.json()
      set((state) => ({
        companies: state.companies.map((c) =>
          c.id === id ? { ...c, ...updated } : c
        ),
      }))
    } catch (e) {
      set({ companies: snapshot })
      toast.error(e instanceof Error ? e.message : "Failed to update company")
      throw e
    }
  },

  // Assignment actions
  assignCompany: async (companyId, boothIds, day) => {
    const { draftId } = get()
    if (!draftId) return

    const tempId = `temp-${Date.now()}`
    const tempAssignment: BoothAssignment = {
      id: tempId,
      companyId,
      draftId,
      boothIds,
      day,
    }
    // Optimistic update
    set((state) => ({
      assignments: [...state.assignments, tempAssignment],
      selectedCompany: null,
    }))
    try {
      const res = await authFetch("/api/assignments", {
        method: "POST",
        body: JSON.stringify({ companyId, draftId, boothIds, day }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to assign company")
      }
      const assignment: BoothAssignment = await res.json()
      // Replace temp with real assignment
      set((state) => ({
        assignments: state.assignments.map((a) =>
          a.id === tempId ? assignment : a
        ),
      }))
    } catch (e) {
      // Rollback: remove the temp assignment
      set((state) => ({
        assignments: state.assignments.filter((a) => a.id !== tempId),
      }))
      toast.error(e instanceof Error ? e.message : "Failed to assign company")
      throw e
    }
  },

  unassignCompany: async (companyId) => {
    const { assignments } = get()
    const assignment = assignments.find((a) => a.companyId === companyId)
    if (!assignment) return

    // Optimistic update
    set((state) => ({
      assignments: state.assignments.filter((a) => a.id !== assignment.id),
      selectedCompany: null,
    }))
    try {
      const res = await authFetch(`/api/assignments/${assignment.id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to unassign company")
      }
    } catch (e) {
      // Rollback: re-add the assignment
      set((state) => ({
        assignments: [...state.assignments, assignment],
      }))
      toast.error(e instanceof Error ? e.message : "Failed to unassign company")
      throw e
    }
  },

  unassignAll: async () => {
    const { draftId, assignments, companies } = get()
    if (!draftId || assignments.length === 0) return

    const snapshotAssignments = assignments
    const snapshotCompanies = companies
    // Optimistic update
    set({
      assignments: [],
      companies: companies.filter((c) => !c.isPlaceholder),
      selectedCompany: null,
    })
    try {
      const res = await authFetch("/api/assignments", {
        method: "DELETE",
        body: JSON.stringify({ draftId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to unassign all")
      }
    } catch (e) {
      set({ assignments: snapshotAssignments, companies: snapshotCompanies })
      toast.error(e instanceof Error ? e.message : "Failed to unassign all")
      throw e
    }
  },

  moveCompany: async (assignmentId, newBoothIds, newDay) => {
    const snapshot = get().assignments
    const original = snapshot.find((a) => a.id === assignmentId)
    if (!original) return

    // Optimistic update
    set((state) => ({
      assignments: state.assignments.map((a) => {
        if (a.id !== assignmentId) return a
        return {
          ...a,
          ...(newBoothIds && { boothIds: newBoothIds }),
          ...(newDay !== undefined && { day: newDay }),
        }
      }),
    }))
    try {
      const body: Record<string, unknown> = {}
      if (newBoothIds) body.boothIds = newBoothIds
      if (newDay !== undefined) body.day = newDay
      const res = await authFetch(`/api/assignments/${assignmentId}/move`, {
        method: "PUT",
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to move company")
      }
      const updated: BoothAssignment = await res.json()
      set((state) => ({
        assignments: state.assignments.map((a) =>
          a.id === assignmentId ? updated : a
        ),
      }))
    } catch (e) {
      set({ assignments: snapshot })
      toast.error(e instanceof Error ? e.message : "Failed to move company")
      throw e
    }
  },

  autoPlaceCompanies: async (day) => {
    const { draftId } = get()
    if (!draftId) {
      return { created: [], placedCount: 0, unassignedCount: 0, skippedCount: 0 }
    }

    try {
      const res = await authFetch("/api/assignments/auto-place", {
        method: "POST",
        body: JSON.stringify({ draftId, day }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to auto-place companies")
      }

      const data = await res.json()
      set((state) => {
        const existingIds = new Set(state.assignments.map((a) => a.id))
        const created = (data.created || []).filter(
          (a: BoothAssignment) => !existingIds.has(a.id)
        )
        return {
          assignments: [...state.assignments, ...created],
          selectedCompany: null,
        }
      })

      return data
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to auto-place companies")
      throw e
    }
  },

  blockBooth: async (boothId, day) => {
    const { draftId } = get()
    if (!draftId) return

    try {
      const res = await authFetch("/api/assignments/block", {
        method: "POST",
        body: JSON.stringify({ draftId, boothId, day }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to block booth")
      }

      const data = await res.json()
      set((state) => ({
        companies: [...state.companies, data.company],
        assignments: [...state.assignments, data.assignment],
      }))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to block booth")
      throw e
    }
  },

  unblockBooth: async (assignmentId) => {
    const { assignments, companies } = get()
    const assignment = assignments.find((a) => a.id === assignmentId)
    if (!assignment) return

    try {
      const res = await authFetch("/api/assignments/block", {
        method: "DELETE",
        body: JSON.stringify({ assignmentId }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to unblock booth")
      }

      const company = companies.find((c) => c.id === assignment.companyId)

      set((state) => ({
        assignments: state.assignments.filter((a) => a.id !== assignmentId),
        companies: company?.isPlaceholder
          ? state.companies.filter((c) => c.id !== assignment.companyId)
          : state.companies,
      }))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to unblock booth")
      throw e
    }
  },

  // UI actions
  setActiveDay: (day) => set({ activeDay: day, selectedCompany: null }),
  setDraggedCompany: (company) => set({ draggedCompany: company }),
  setHoveredBooths: (boothIds, valid) =>
    set({ hoveredBooths: boothIds, hoveredValid: valid }),
  setSelectedCompany: (companyId) => set({ selectedCompany: companyId, repositioning: false }),
  startRepositioning: (companyId) => set({ selectedCompany: companyId, repositioning: true, hoveredBooths: [], hoveredValid: true }),
  cancelRepositioning: () => set({ selectedCompany: null, repositioning: false, hoveredBooths: [], hoveredValid: true }),
  setTooltip: (tooltip) => set({ tooltip }),
  setContextMenu: (menu) => set({ contextMenu: menu }),
  setExportMapFn: (fn) => set({ exportMapFn: fn }),
  setSidebarFilter: (filter) =>
    set((state) => ({
      sidebarFilter: { ...state.sidebarFilter, ...filter },
    })),

  // Derived helpers
  getAssignmentsForDay: (day) => {
    const { assignments } = get()
    return assignments.filter((a) => a.day === null || a.day === day)
  },

  getUnassignedCompanies: (day) => {
    const { companies, assignments } = get()
    const assignedCompanyIds = new Set(assignments.map((a) => a.companyId))
    return companies.filter(
      (c) =>
        !c.isPlaceholder &&
        !assignedCompanyIds.has(c.id) &&
        c.days.includes(day)
    )
  },

  getBoothOccupant: (boothId, day) => {
    const { assignments, companies } = get()
    for (const a of assignments) {
      if (
        a.boothIds.includes(boothId) &&
        (a.day === null || a.day === day)
      ) {
        const company = companies.find((c) => c.id === a.companyId)
        if (company) return { company, assignment: a }
      }
    }
    return null
  },

  isBoothAvailable: (boothId, day) => {
    return get().getBoothOccupant(boothId, day) === null
  },

  getOccupiedBoothIds: (day) => {
    const { assignments } = get()
    const occupied = new Set<string>()
    for (const a of assignments) {
      if (a.day === null || a.day === day) {
        for (const bid of a.boothIds) {
          occupied.add(bid)
        }
      }
    }
    return occupied
  },

  getAssignmentForCompany: (companyId) => {
    return get().assignments.find((a) => a.companyId === companyId)
  },
}))
