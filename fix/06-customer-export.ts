type Customer = { customerId: string; emailAddress: string };
// save 必须观察 signal，中止正在执行的 I/O，并在停止后才拒绝 Promise。
type Store = { save(customer: Customer, signal: AbortSignal): Promise<void> };
type ExportState =
  | { status: 'idle' | 'running' | 'cancelling' | 'succeeded' | 'cancelled'; saved: number }
  | { status: 'failed'; saved: number; error: string };
type ExportResult = { ok: boolean; saved: number; status: ExportState['status'] };

export function createExportSession() {
  let state: ExportState = { status: 'idle', saved: 0 };
  let controller: AbortController | null = null;

  async function runExport(customers: Customer[], store: Store): Promise<ExportResult> {
    if (controller) throw new Error('An export is already running');
    const current = new AbortController();
    controller = current;
    state = { status: 'running', saved: 0 };
    try {
      for (const customer of customers) {
        current.signal.throwIfAborted();
        await store.save(customer, current.signal);
        state = { status: state.status, saved: state.saved + 1 };
      }
      current.signal.throwIfAborted();
      state = { status: 'succeeded', saved: state.saved };
    } catch (error) {
      state = current.signal.aborted
        ? { status: 'cancelled', saved: state.saved }
        : { status: 'failed', saved: state.saved, error: String(error) };
    } finally {
      controller = null;
    }
    return { ok: state.status === 'succeeded', saved: state.saved, status: state.status };
  }

  function cancelExport() {
    if (!controller) return;
    state = { status: 'cancelling', saved: state.saved };
    controller.abort();
  }

  return {
    get state(): Readonly<ExportState> { return { ...state }; },
    runExport,
    cancelExport,
  };
}

const buttonSession = createExportSession();
export const runExport = buttonSession.runExport;
export const cancelExport = buttonSession.cancelExport;

export async function exportFromButton(customers: Customer[], store: Store) {
  try {
    const result = await runExport(customers, store);
    if (result.status === 'cancelled') return '导出已取消';
    return result.ok ? '导出成功' : '导出失败';
  } catch {
    return '请重试';
  }
}
