export type ReportRow = { tenantId: string; amountCents: number; settled: boolean };
type ReportScope = { tenantId: string; preview: boolean };

// 租户约束在正式和预览模式下都成立；模式只决定是否包含未结算记录。
export function selectReportRows(rows: ReportRow[], scope: ReportScope) {
  return rows.filter(row => row.tenantId === scope.tenantId && (scope.preview || row.settled));
}
