import { createRuntime, decorate, invoke, put, register, take } from './13-report-runtime.js';

type Row = { tenantId: string; amountCents: number; settled: boolean };
type Runtime = ReturnType<typeof createRuntime>;

function installReport(runtime: Runtime) {
  register(runtime, 'report.source', () => take(runtime, 'records'));
  register(runtime, 'report.select', rows => rows.filter((row: Row) => row.settled));
  register(runtime, 'report.total', rows => rows.reduce((sum: number, row: Row) => sum + row.amountCents, 0));
  register(runtime, 'report.view', amount => ({ amountCents: amount, tenantId: take(runtime, 'scope') }));
}

function installTenant(runtime: Runtime, tenantId: string) {
  put(runtime, 'scope', tenantId);
  decorate(runtime, 'report.select', select => rows => select(rows).filter((row: Row) => row.tenantId === tenantId));
}

function installPreview(runtime: Runtime) {
  register(runtime, 'report.select', rows => rows);
}

function render(runtime: Runtime) {
  const rows = invoke(runtime, 'report.source', undefined);
  const selected = invoke(runtime, 'report.select', rows);
  const amount = invoke(runtime, 'report.total', selected);
  return invoke(runtime, 'report.view', amount);
}

export function reportScreen(rows: Row[], tenantId: string, preview: boolean) {
  const runtime = createRuntime();
  put(runtime, 'records', rows);
  installReport(runtime);
  installTenant(runtime, tenantId);
  if (preview) installPreview(runtime);
  return render(runtime);
}
