type Request = { method: 'GET' | 'POST'; path: string; body?: string };
type Response = { status: number; body: string };
type Transport = (request: Request) => Promise<Response>;

export async function retryRequest(transport: Transport, request: Request) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await transport(request);
      if (response.status >= 500) {
        throw new Error(response.body);
      }
      return response;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

export function fetchPaymentStatus(transport: Transport, orderId: string) {
  return retryRequest(transport, { method: 'GET', path: '/payments/' + orderId });
}

export async function capturePayment(transport: Transport, orderId: string, amountCents: number) {
  try {
    const response = await retryRequest(transport, {
      method: 'POST',
      path: '/payments/capture',
      body: JSON.stringify({ orderId, amountCents }),
    });
    return { paid: response.status === 200, reference: response.body };
  } catch {
    return { paid: false, reference: '' };
  }
}

export async function payOrder(transport: Transport, orderId: string, amountCents: number) {
  const result = await capturePayment(transport, orderId, amountCents);
  return result.paid ? 'complete' : 'try-again';
}
