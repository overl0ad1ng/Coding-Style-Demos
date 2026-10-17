type Request = { method: 'GET' | 'POST'; path: string; body?: string };
type Response = { status: number; body: string };
type Transport = (request: Request) => Promise<Response>;
type CaptureResult =
  | { status: 'paid'; reference: string }
  | { status: 'unknown'; reason: string };

async function retryPaymentRead(transport: Transport, path: string) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await transport({ method: 'GET', path });
      if (response.status >= 500) throw new Error(response.body);
      return response;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

export function fetchPaymentStatus(transport: Transport, orderId: string) {
  return retryPaymentRead(transport, '/payments/' + encodeURIComponent(orderId));
}

export async function capturePayment(
  transport: Transport, orderId: string, amountCents: number,
): Promise<CaptureResult> {
  try {
    // 扣款不保证幂等；连接失败或服务端异常不能证明扣款没有发生。
    const response = await transport({
      method: 'POST', path: '/payments/capture',
      body: JSON.stringify({ orderId, amountCents }),
    });
    if (response.status === 200) return { status: 'paid', reference: response.body };
    // 样例没有约定可确认未扣款的错误码，其他响应均交由状态查询确认。
    return { status: 'unknown', reason: response.body };
  } catch (error) {
    return { status: 'unknown', reason: String(error) };
  }
}

export async function payOrder(transport: Transport, orderId: string, amountCents: number) {
  const result = await capturePayment(transport, orderId, amountCents);
  return result.status === 'paid' ? 'complete' : 'check-status';
}
