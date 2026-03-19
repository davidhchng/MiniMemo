import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { BatchAnalysisResponse } from "../lib/types"

interface ReportState {
  report: BatchAnalysisResponse | null
  pendingFiles: File[] | null
  setReport: (report: BatchAnalysisResponse) => void
  setPendingFiles: (files: File[]) => void
  clear: () => void
}

export const useReportStore = create<ReportState>()(
  persist(
    (set) => ({
      report: null,
      pendingFiles: null,
      setReport: (report) => set({ report }),
      setPendingFiles: (files) => set({ pendingFiles: files }),
      clear: () => set({ report: null, pendingFiles: null }),
    }),
    {
      name: "minimemo-report",
      // File objects can't be serialized — only persist the report data
      partialize: (state) => ({ report: state.report }),
    },
  ),
)
