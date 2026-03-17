import { create } from "zustand"
import type { AnalysisResponse } from "../lib/types"

interface ReportState {
  report: AnalysisResponse | null
  setReport: (report: AnalysisResponse) => void
  clear: () => void
}

export const useReportStore = create<ReportState>((set) => ({
  report: null,
  setReport: (report) => set({ report }),
  clear: () => set({ report: null }),
}))
