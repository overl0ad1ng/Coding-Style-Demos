const assert = require('node:assert/strict');
const { test } = require('node:test');
const { load } = require('./load-typescript.cjs');

test('cart preview, charge and receipt agree at the inclusive free-shipping boundary', () => {
  const { checkoutPage } = load('03-cart-pricing.ts');
  const saved = [];
  const result = checkoutPage({ member: true, express: false, itemTotalsCents: [10000] }, amount => saved.push(amount));
  assert.deepEqual(result, { displayedCents: 9000, chargedCents: 9000, receiptCents: 9000 });
  assert.deepEqual(saved, [9000]);
});

test('a lost capture response is sent once and requires status confirmation', async () => {
  const { payOrder } = load('04-payment-gateway.ts');
  let attempts = 0;
  const transport = async () => { attempts++; throw new Error('response lost'); };
  assert.equal(await payOrder(transport, 'order-1', 1000), 'check-status');
  assert.equal(attempts, 1);
});

test('export remains pending until the customer has actually been saved', async () => {
  const { runExport } = load('06-customer-export.ts');
  let release;
  let finished = false;
  const store = { save: () => new Promise(resolve => { release = resolve; }) };
  const pending = runExport([{ customerId: 'c1', emailAddress: 'c@example.com' }], store);
  pending.then(() => { finished = true; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(finished, false);
  release();
  assert.equal((await pending).saved, 1);
});

test('a failed save cannot report successful export', async () => {
  const { exportFromButton } = load('06-customer-export.ts');
  const store = { save: async () => { throw new Error('disk full'); } };
  const message = await exportFromButton([{ customerId: 'c1', emailAddress: 'c@example.com' }], store);
  assert.equal(message, '导出失败');
});

test('account settings waits for persistence errors', async () => {
  const { customerSettings } = load('07-customer-accounts.ts');
  const repository = {
    find: async () => ({ customerId: 'c1', emailAddress: 'old@example.com', suspended: false }),
    save: async () => { throw new Error('disk full'); },
  };
  assert.equal(await customerSettings(repository, 'c1', 'new@example.com'), 'disk full');
});

test('concurrent payouts keep each merchant identity and charge the adjusted amount', async () => {
  const { payMerchants } = load('09-payout-session.ts');
  const transfers = [];
  let releaseFirst;
  const firstAdjustment = new Promise(resolve => { releaseFirst = resolve; });
  const merchants = [
    { tenantId: 'a', accountId: 'bank-a', grossCents: 10000 },
    { tenantId: 'b', accountId: 'bank-b', grossCents: 20000 },
  ];
  const bank = { send: async transfer => { transfers.push(transfer); return transfer.accountId; } };
  const pending = payMerchants(merchants, bank, tenant => tenant === 'a' ? firstAdjustment : Promise.resolve(2000));
  await new Promise(resolve => setImmediate(resolve));
  releaseFirst(1000);
  await pending;
  transfers.sort((left, right) => left.tenantId.localeCompare(right.tenantId));
  assert.deepEqual(transfers, [
    { tenantId: 'a', accountId: 'bank-a', amountCents: 10780 },
    { tenantId: 'b', accountId: 'bank-b', amountCents: 21560 },
  ]);
});

test('rendering shipment views neither reserves stock nor mutates existing shipment data', () => {
  const { shipmentPage } = load('10-shipment-view.ts');
  const shipment = { shipmentId: 's1', items: [{ sku: 'z', quantity: 11 }, { sku: 'a', quantity: 1 }], packages: 7, status: 'draft' };
  const before = structuredClone(shipment);
  const inventory = { reserve: () => { throw new Error('display must not reserve'); } };
  const page = shipmentPage(shipment, inventory);
  assert.equal(page.card.title, 's1 / 7 packages');
  assert.deepEqual(shipment, before);
});

const deadline = 7 * 24 * 60 * 60 * 1000;
const refundOrder = { orderId: 'o1', amountCents: 5000, paidAt: 0, settled: true, fulfillment: 'unshipped' };

test('all refund surfaces allow the exact deadline', async () => {
  const actions = load('12-refund-actions.ts');
  const refunds = [];
  const store = { create: async (orderId, amountCents) => { refunds.push({ orderId, amountCents }); } };
  assert.equal(actions.refundButton(refundOrder, deadline).enabled, true);
  assert.equal((await actions.requestRefund(refundOrder, deadline, store)).accepted, true);
  assert.equal(actions.refundEmail(refundOrder, deadline).showRefundLink, true);
  assert.equal(actions.refundAdminRow(refundOrder, deadline).refundable, true);
  assert.deepEqual(refunds, [{ orderId: 'o1', amountCents: 5000 }]);
});

test('shipped orders cannot be refunded through the API or administration list', async () => {
  const actions = load('12-refund-actions.ts');
  const order = { ...refundOrder, fulfillment: 'shipped' };
  const store = { create: async () => { throw new Error('must reject before persistence'); } };
  assert.equal((await actions.requestRefund(order, deadline, store)).accepted, false);
  assert.equal(actions.refundAdminRow(order, deadline).refundable, false);
});

test('report preview includes unsettled rows without exposing another tenant', () => {
  const { reportScreen } = load('14-report-screen.ts');
  const rows = [
    { tenantId: 'a', settled: true, amountCents: 100 },
    { tenantId: 'a', settled: false, amountCents: 200 },
    { tenantId: 'b', settled: true, amountCents: 10000 },
  ];
  assert.deepEqual(reportScreen(rows, 'a', false), { amountCents: 100, tenantId: 'a' });
  assert.deepEqual(reportScreen(rows, 'a', true), { amountCents: 300, tenantId: 'a' });
});
