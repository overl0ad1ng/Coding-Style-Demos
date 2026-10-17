const assert = require('node:assert/strict');
const { test } = require('node:test');
const { load } = require('./load-typescript.cjs');

const order = {
  id: 'o1', tenantId: 'a', confirmed: true, paid: true, cancelled: false,
  customer: { active: true, member: true, email: 'c@example.com' },
  address: { country: 'US', city: 'Shanghai', street: 'Road' },
  items: [{ sku: 's1', quantity: 1, priceCents: 10000, stock: 1 }],
};
const options = {
  tenantId: 'a', allowBackorder: false, express: false, sendEmail: true,
  now: new Date('2026-10-17T00:00:00.000Z'), exchangeRate: 1,
};

test('order processing uses the same shipping policy and records preparation before email', () => {
  const { processOrder } = load('01-order-processing.ts');
  const audit = [];
  const result = processOrder(order, options, audit);
  assert.equal(result.amountCents, 9000);
  assert.equal(result.shipmentStatus, 'ready');
  assert.deepEqual(audit, [
    'stock-ok:s1', 'prepared:a:o1', 'address:Shanghai Road',
    'amount:9000', 'at:2026-10-17T00:00:00.000Z', 'email:c@example.com',
  ]);
});

test('order validation preserves error precedence and does not audit rejected orders', () => {
  const { processOrder } = load('01-order-processing.ts');
  const cases = [
    [{ tenantId: 'b', confirmed: false }, 'tenant'], [{ confirmed: false }, 'unconfirmed'],
    [{ cancelled: true }, 'cancelled'], [{ paid: false }, 'payment'],
    [{ customer: { ...order.customer, active: false } }, 'customer'],
    [{ address: null, items: [] }, 'address'], [{ items: [] }, 'empty'],
  ];
  for (const [changes, expected] of cases) {
    const audit = [];
    assert.deepEqual(processOrder({ ...order, ...changes }, options, audit), { error: expected });
    assert.deepEqual(audit, []);
  }
});

test('backorders, invalid quantities and email warnings retain their distinct outcomes', () => {
  const { processOrder } = load('01-order-processing.ts');
  const shortage = { ...order, items: [{ ...order.items[0], stock: 0 }] };
  assert.deepEqual(processOrder(shortage, options, []), { error: 'stock' });
  const audit = [];
  assert.equal(processOrder(shortage, { ...options, allowBackorder: true }, audit).amountCents, 9000);
  assert.equal(audit[0], 'backorder:s1');
  const invalid = { ...order, items: [{ ...order.items[0], quantity: 0 }] };
  assert.deepEqual(processOrder(invalid, options, []), { error: 'quantity' });
  const email = { ...order, customer: { ...order.customer, email: '' } };
  assert.equal(processOrder(email, options, []).warning, 'email');
});

const invoice = { orderId: 'o1', confirmed: true, paid: true, pdf: 'invoice.pdf' };
const customer = { emailAddress: 'c@example.com', unsubscribed: false, name: 'A & B' };
const notification = { channelEnabled: true, prefix: '', locale: 'zh', includeGreeting: true, format: 'text' };

test('each invoice eligibility requirement independently prevents delivery', async () => {
  const { sendInvoice } = load('02-invoice-notifications.ts');
  const cases = [
    [{ confirmed: false }, {}, {}], [{ paid: false }, {}, {}], [{ pdf: '' }, {}, {}],
    [{}, { emailAddress: '' }, {}], [{}, { unsubscribed: true }, {}],
    [{}, {}, { channelEnabled: false }],
  ];
  for (const [invoiceChanges, customerChanges, optionChanges] of cases) {
    const audit = [];
    const sender = async () => { assert.fail('ineligible invoices must not reach the sender'); };
    const sent = await sendInvoice({ ...invoice, ...invoiceChanges }, { ...customer, ...customerChanges }, sender, { ...notification, ...optionChanges }, audit);
    assert.equal(sent, false);
    assert.deepEqual(audit, ['skipped:o1']);
  }
});

test('invoice success is audited only after the sender resolves', async () => {
  const { sendInvoice } = load('02-invoice-notifications.ts');
  const audit = [];
  const sender = async (...args) => {
    assert.deepEqual(audit, []);
    assert.deepEqual(args, ['c@example.com', '发票:o1', 'Hello A & B', 'invoice.pdf']);
  };
  assert.equal(await sendInvoice(invoice, customer, sender, notification, audit), true);
  assert.deepEqual(audit, ['sent:o1']);
  const failedAudit = [];
  await assert.rejects(sendInvoice(invoice, customer, async () => { throw new Error('mail offline'); }, notification, failedAudit), /mail offline/);
  assert.deepEqual(failedAudit, []);
});

test('cart policy preserves ordinary shipping, membership discount and express surcharge', () => {
  const { previewCart } = load('03-cart-pricing.ts');
  const cases = [
    [{ member: false, express: false, itemTotalsCents: [10000] }, 10800],
    [{ member: true, express: false, itemTotalsCents: [9999] }, 9799],
    [{ member: true, express: true, itemTotalsCents: [10000] }, 10500],
    [{ member: true, express: false, itemTotalsCents: [6000, 6000] }, 10800],
  ];
  for (const [cart, expected] of cases) assert.equal(previewCart(cart), expected);
});

test('status reads retry transient failures and keep the terminal read error', async () => {
  const { fetchPaymentStatus } = load('04-payment-gateway.ts');
  let attempts = 0;
  const transport = async request => {
    assert.equal(request.method, 'GET');
    attempts++;
    return { status: attempts < 3 ? 503 : 200, body: 'status' };
  };
  assert.deepEqual(await fetchPaymentStatus(transport, 'o1'), { status: 200, body: 'status' });
  assert.equal(attempts, 3);
  await assert.rejects(fetchPaymentStatus(async () => { throw new Error('offline'); }, 'o1'), /offline/);
});

test('non-successful capture responses remain unknown without a documented decline contract', async () => {
  const { capturePayment } = load('04-payment-gateway.ts');
  for (const status of [202, 400, 408, 409, 500]) {
    let attempts = 0;
    const result = await capturePayment(async () => { attempts++; return { status, body: 'unconfirmed' }; }, 'o1', 1000);
    assert.equal(result.status, 'unknown');
    assert.equal(attempts, 1);
  }
});

test('daily reports exclude voided, unsettled and foreign-tenant records', () => {
  const { dailyReport } = load('05-report-pipeline.ts');
  const rows = [
    { tenantId: 'a', settled: true, voided: false, amountCents: 100 },
    { tenantId: 'b', settled: true, voided: false, amountCents: 200 },
    { tenantId: 'a', settled: false, voided: false, amountCents: 400 },
    { tenantId: 'a', settled: true, voided: true, amountCents: 800 },
  ];
  assert.deepEqual(dailyReport(rows, 'a'), { count: 1, totalCents: 100 });
});

test('cancelling export aborts active storage and skips later customers', async () => {
  const session = load('06-customer-export.ts').createExportSession();
  const attempted = [];
  const customers = [{ customerId: 'c1', emailAddress: 'c@example.com' }, { customerId: 'c2', emailAddress: 'd@example.com' }];
  const store = { save: (customer, signal) => new Promise((resolve, reject) => {
    attempted.push(customer.customerId);
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  }) };
  const pending = session.runExport(customers, store);
  session.cancelExport();
  assert.deepEqual(await pending, { ok: false, saved: 0, status: 'cancelled' });
  assert.deepEqual(attempted, ['c1']);
  assert.deepEqual(session.state, { status: 'cancelled', saved: 0 });
  assert.deepEqual(await session.runExport(customers, { save: async () => {} }), { ok: true, saved: 2, status: 'succeeded' });
});

test('export sessions isolate state and reject overlapping runs in the same session', async () => {
  const { createExportSession } = load('06-customer-export.ts');
  const first = createExportSession();
  const second = createExportSession();
  let release;
  const customers = [{ customerId: 'c1', emailAddress: 'c@example.com' }];
  const pending = first.runExport(customers, { save: () => new Promise(resolve => { release = resolve; }) });
  await assert.rejects(first.runExport([], { save: async () => {} }), /already running/);
  assert.equal(second.state.status, 'idle');
  const isolatedResult = await second.runExport([], { save: async () => {} });
  assert.equal(isolatedResult.ok, true);
  assert.equal(first.state.status, 'running');
  release();
  await pending;
});

test('a new export clears the preceding failure state', async () => {
  const session = load('06-customer-export.ts').createExportSession();
  const customers = [{ customerId: 'c1', emailAddress: 'c@example.com' }];
  assert.equal((await session.runExport(customers, { save: async () => { throw new Error('offline'); } })).ok, false);
  assert.equal(session.state.status, 'failed');
  await session.runExport([], { save: async () => {} });
  assert.deepEqual(session.state, { status: 'succeeded', saved: 0 });
});

test('account updates persist normalized values and distinguish missing customers', async () => {
  const accounts = load('07-customer-accounts.ts');
  const saved = [];
  const original = { customerId: 'c1', emailAddress: 'old@example.com', suspended: false };
  const repository = { find: async () => original, save: async value => { saved.push(value); } };
  assert.equal(await accounts.customerSettings(repository, 'c1', ' new@example.com '), '已保存');
  assert.deepEqual(saved[0], { ...original, emailAddress: 'new@example.com' });
  assert.deepEqual(await accounts.suspendFromAdmin(repository, 'c1'), { success: true });
  assert.equal(saved[1].suspended, true);
  assert.equal(original.suspended, false);
  const missing = { find: async () => null, save: async () => { assert.fail('missing customer'); } };
  assert.equal(await accounts.customerSettings(missing, 'missing', 'x@example.com'), '客户不存在');
});

test('only shipment confirmation reserves stock and repeated confirmation is harmless', () => {
  const { confirmShipment } = load('10-shipment-view.ts');
  const shipment = { shipmentId: 's1', items: [{ sku: 's1', quantity: 11 }], packages: 0, status: 'draft' };
  const reservations = [];
  const inventory = { reserve: (sku, quantity) => reservations.push({ sku, quantity }) };
  confirmShipment(shipment, inventory);
  confirmShipment(shipment, inventory);
  assert.deepEqual(reservations, [{ sku: 's1', quantity: 11 }]);
  assert.equal(shipment.packages, 2);
  assert.equal(shipment.status, 'reserved');
});

test('all refund surfaces reject expired, unpaid and future-payment orders', async () => {
  const actions = load('12-refund-actions.ts');
  const order = { orderId: 'o1', amountCents: 5000, paidAt: 100, settled: true, fulfillment: 'unshipped' };
  const deadline = 100 + 7 * 24 * 60 * 60 * 1000;
  const store = { create: async () => { assert.fail('refund must be rejected'); } };
  for (const [candidate, now] of [[order, deadline + 1], [{ ...order, settled: false }, deadline], [order, 99]]) {
    assert.equal(actions.refundButton(candidate, now).enabled, false);
    assert.equal((await actions.requestRefund(candidate, now, store)).accepted, false);
    assert.equal(actions.refundEmail(candidate, now).advertisedAmountCents, 0);
    assert.equal(actions.refundAdminRow(candidate, now).refundable, false);
  }
});
