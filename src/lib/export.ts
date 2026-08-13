import { prisma } from "@/lib/prisma"

// Helper functions for formatting booth IDs and days
function formatBoothIds(boothIds: string[]) {
    return [...boothIds]
      .sort((a, b) => {
        const [rowA, numA] = a.split("-")
        const [rowB, numB] = b.split("-")
        if (rowA !== rowB) return rowA.localeCompare(rowB)
        return parseInt(numA) - parseInt(numB)
      })
      .map((id) => id.replace("-", ""))
      .join(", ")
}

function formatDays(day: string | null, companyDays: string[]) {
    if (day === null) return "Wednesday Thursday"
    if (day === "WEDNESDAY") return "Wednesday"
    if (day === "THURSDAY") return "Thursday"
    return companyDays.map((d) => d === "WEDNESDAY" ? "Wednesday" : "Thursday").join(" ")
}

export async function getDraftExportRows(draftId: string) {
  const draft = await prisma.draft.findFirst({
    where: { id: draftId },
    include: {
      assignments: { include: { company: true } },
    },
  })

  if (!draft) {
    throw new Error("Draft not found")
  }

  return draft.assignments
    .map((a) => ({
      Name: a.company.name,
      "DAYS REGISTERED": formatDays(a.day, a.company.days),
      ASSIGNMENT: formatBoothIds(a.boothIds),
    }))
    .sort((a, b) => {
      const aFirst = a.ASSIGNMENT.split(",")[0].trim()
      const bFirst = b.ASSIGNMENT.split(",")[0].trim()
      const aRow = aFirst.match(/^([A-Q])/)?.[1] || ""
      const bRow = bFirst.match(/^([A-Q])/)?.[1] || ""
      if (aRow !== bRow) return aRow.localeCompare(bRow)
      const aNum = parseInt(aFirst.slice(1)) || 0
      const bNum = parseInt(bFirst.slice(1)) || 0
      return aNum - bNum
    })
}
