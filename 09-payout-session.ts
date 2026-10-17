type Transfer = { tenantId: string; accountId: string; amountCents: number };
type Bank = { send(transfer: Transfer): Promise<string> };

let tenantId = '';
let accountId = '';
let grossCents = 0;
let feeCents = 0;

export function selectTenant(value: string) {
  tenantId = value;
}

export function selectAccount(value: string) {
  accountId = value;
}

export function setGrossAmount(value: number) {
  grossCents = value;
}

export function calculateFee() {
  feeCents = Math.round(grossCents * 0.02);
}

export function submitTransfer(bank: Bank) {
  return bank.send({ tenantId, accountId, amountCents: grossCents - feeCents });
}

export async function payMerchant(
  merchant: { tenantId: string; accountId: string; grossCents: number },
  bank: Bank,
  loadAdjustment: (tenantId: string) => Promise<number>,
) {
  selectTenant(merchant.tenantId);
  selectAccount(merchant.accountId);
  setGrossAmount(merchant.grossCents);
  calculateFee();
  const adjustment = await loadAdjustment(merchant.tenantId);
  setGrossAmount(merchant.grossCents + adjustment);
  return submitTransfer(bank);
}

export function payMerchants(
  merchants: { tenantId: string; accountId: string; grossCents: number }[],
  bank: Bank,
  loadAdjustment: (tenantId: string) => Promise<number>,
) {
  return Promise.all(merchants.map(merchant => payMerchant(merchant, bank, loadAdjustment)));
}
