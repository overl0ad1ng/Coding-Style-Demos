export type RefundOrder = {
  orderId: string;
  amountCents: number;
  paidAt: number;
  settled: boolean;
  fulfillment: 'unshipped' | 'shipped';
};

export const refundWindowDays = 7;

export function getRefundFacts(order: RefundOrder, now: number) {
  return {
    age: (now - order.paidAt) / 86400000,
    payment: order.settled ? 'captured' : 'open',
    delivery: order.fulfillment === 'unshipped' ? 'pending' : 'complete',
  };
}

export function canRefund(order: RefundOrder, now: number) {
  const facts = getRefundFacts(order, now);
  return facts.age <= refundWindowDays && facts.payment === 'captured' && facts.delivery === 'pending';
}

export function refundAmount(order: RefundOrder, now: number) {
  return canRefund(order, now) ? order.amountCents : 0;
}
