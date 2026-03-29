import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { BatchAnalysisResponse, DatabaseQuery } from "../lib/types"

interface ReportState {
  report: BatchAnalysisResponse | null
  pendingFiles: File[] | null
  pendingDbQuery: DatabaseQuery | null
  setReport: (report: BatchAnalysisResponse) => void
  setPendingFiles: (files: File[]) => void
  setPendingDbQuery: (query: DatabaseQuery) => void
  clear: () => void
}

export const useReportStore = create<ReportState>()(
  persist(
    (set) => ({
      report: null,
      pendingFiles: null,
      pendingDbQuery: null,
      setReport: (report) => set({ report }),
      setPendingFiles: (files) => set({ pendingFiles: files }),
      setPendingDbQuery: (query) => set({ pendingDbQuery: query }),
      clear: () => set({ report: null, pendingFiles: null, pendingDbQuery: null }),
    }),
    {
      name: "minimemo-report",
      // File objects can't be serialized — only persist the report data
      partialize: (state) => ({ report: state.report }),
    },
  ),
)
