type Row = { tenantId: string; settled: boolean; voided: boolean; amountCents: number };

export function dailyReport(rows: Row[], tenantId: string) {
  const settledRows = rows.filter(row => row.tenantId === tenantId && row.settled && !row.voided);
  const totalCents = settledRows.reduce((sum, row) => sum + row.amountCents, 0);
  return { count: settledRows.length, totalCents };
}
