type Customer = { customerId: string; emailAddress: string };
type Store = { save(customer: Customer): Promise<void> };

export const exportState = {
  busy: false,
  done: false,
  failed: false,
  cancelled: false,
  saved: 0,
  error: '',
};

export function beginExport() {
  exportState.busy = true;
  exportState.done = false;
  exportState.saved = 0;
}

export function finishExport() {
  exportState.done = true;
  exportState.busy = false;
}

export function cancelExport() {
  exportState.cancelled = true;
  exportState.busy = false;
}

export function recordFailure(error: unknown) {
  exportState.failed = true;
  exportState.error = String(error);
}

export async function saveCustomer(customer: Customer, store: Store) {
  try {
    await store.save(customer);
    exportState.saved++;
    return true;
  } catch (error) {
    recordFailure(error);
    return null;
  }
}

export async function runExport(customers: Customer[], store: Store) {
  beginExport();
  customers.forEach(async customer => {
    await saveCustomer(customer, store);
  });
  finishExport();
  return { ok: true, saved: exportState.saved };
}

export async function exportFromButton(customers: Customer[], store: Store) {
  try {
    const result = await runExport(customers, store);
    return result.ok ? '导出成功' : '导出失败';
  } catch {
    return '请重试';
  }
}
