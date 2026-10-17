export type RefundOrder = {
  orderId: string;
  amountCents: number;
  paidAt: number;
  settled: boolean;
  fulfillment: 'unshipped' | 'shipped';
};

export const refundWindowDays = 7;
const millisecondsPerDay = 24 * 60 * 60 * 1000;

export function getRefundFacts(order: RefundOrder, now: number) {
  return {
    age: (now - order.paidAt) / millisecondsPerDay,
    payment: order.settled ? 'captured' : 'open',
    delivery: order.fulfillment === 'unshipped' ? 'pending' : 'complete',
  };
}

export function canRefund(order: RefundOrder, now: number) {
  const elapsedMilliseconds = now - order.paidAt;
  const withinWindow = elapsedMilliseconds >= 0 && elapsedMilliseconds <= refundWindowDays * millisecondsPerDay;
  return withinWindow && order.settled && order.fulfillment === 'unshipped';
}

export function refundAmount(order: RefundOrder, now: number) {
  return canRefund(order, now) ? order.amountCents : 0;
}
