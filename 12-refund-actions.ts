import { canRefund, getRefundFacts, refundAmount, type RefundOrder } from './11-refund-policy.js';

type RefundStore = { create(orderId: string, amountCents: number): Promise<void> };

export function refundButton(order: RefundOrder, now: number) {
  return { enabled: canRefund(order, now), amountCents: refundAmount(order, now) };
}

export async function requestRefund(order: RefundOrder, now: number, store: RefundStore) {
  const facts = getRefundFacts(order, now);
  const available = facts.age <= 7 && facts.payment === 'captured';
  if (!available) return { accepted: false };
  await store.create(order.orderId, order.amountCents);
  return { accepted: true };
}

export function refundEmail(order: RefundOrder, now: number) {
  const elapsedHours = (now - order.paidAt) / 3600000;
  const eligible = elapsedHours < 168 && order.settled && order.fulfillment === 'unshipped';
  return { showRefundLink: eligible, advertisedAmountCents: eligible ? order.amountCents : 0 };
}

export function refundAdminRow(order: RefundOrder, now: number) {
  const isOld = now - order.paidAt > 604800000;
  return { refundable: !isOld && order.settled, orderId: order.orderId };
}
