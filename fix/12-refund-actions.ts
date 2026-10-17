import { canRefund, refundAmount, type RefundOrder } from './11-refund-policy.js';

type RefundStore = { create(orderId: string, amountCents: number): Promise<void> };

export function refundButton(order: RefundOrder, now: number) {
  return { enabled: canRefund(order, now), amountCents: refundAmount(order, now) };
}

export async function requestRefund(order: RefundOrder, now: number, store: RefundStore) {
  if (!canRefund(order, now)) return { accepted: false };
  await store.create(order.orderId, refundAmount(order, now));
  return { accepted: true };
}

export function refundEmail(order: RefundOrder, now: number) {
  return { showRefundLink: canRefund(order, now), advertisedAmountCents: refundAmount(order, now) };
}

export function refundAdminRow(order: RefundOrder, now: number) {
  return { refundable: canRefund(order, now), orderId: order.orderId };
}
