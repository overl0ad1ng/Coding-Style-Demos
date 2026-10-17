import { selectReportRows, type ReportRow } from './13-report-runtime.js';

export function reportScreen(rows: ReportRow[], tenantId: string, preview: boolean) {
  const selectedRows = selectReportRows(rows, { tenantId, preview });
  const amountCents = selectedRows.reduce((sum, row) => sum + row.amountCents, 0);
  return { amountCents, tenantId };
}
