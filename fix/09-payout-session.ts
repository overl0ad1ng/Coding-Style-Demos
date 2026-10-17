type Merchant = { tenantId: string; accountId: string; grossCents: number };
type Transfer = { tenantId: string; accountId: string; amountCents: number };
type Bank = { send(transfer: Transfer): Promise<string> };
type LoadAdjustment = (tenantId: string) => Promise<number>;

export async function payMerchant(merchant: Merchant, bank: Bank, loadAdjustment: LoadAdjustment) {
  const adjustmentCents = await loadAdjustment(merchant.tenantId);
  const adjustedGrossCents = merchant.grossCents + adjustmentCents;
  const feeCents = Math.round(adjustedGrossCents * 0.02);
  return bank.send({
    tenantId: merchant.tenantId,
    accountId: merchant.accountId,
    amountCents: adjustedGrossCents - feeCents,
  });
}

export function payMerchants(merchants: Merchant[], bank: Bank, loadAdjustment: LoadAdjustment) {
  // 每笔提现的状态属于本次调用；批量并发无需共享可变会话。
  return Promise.all(merchants.map(merchant => payMerchant(merchant, bank, loadAdjustment)));
}
