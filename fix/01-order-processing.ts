import { calculateCartTotal } from './pricing.js';

type Order = {
  id: string;
  tenantId: string;
  confirmed: boolean;
  paid: boolean;
  cancelled: boolean;
  customer: { active: boolean; member: boolean; email: string };
  address: { country: string; city: string; street: string } | null;
  items: { sku: string; quantity: number; priceCents: number; stock: number }[];
};

type ProcessingOptions = {
  tenantId: string;
  allowBackorder: boolean;
  express: boolean;
  sendEmail: boolean;
  now: Date;
  exchangeRate: number;
};

export function processOrder(order: Order, options: ProcessingOptions, audit: string[]) {
  const orderError = getOrderError(order, options.tenantId);

  if (orderError) return { error: orderError };
  if (!order.address) return { error: 'address' };
  if (order.items.length === 0) return { error: 'empty' };

  const items = checkStock(order.items, options.allowBackorder, audit);
  if (items.error) return { error: items.error };

  const payableCents = calculateCartTotal(items.subtotalCents, order.customer.member, options.express);
  const amountCents = Math.round(payableCents * options.exchangeRate);
  const reference = options.tenantId + ':' + order.id;
  const label = order.address.city + ' ' + order.address.street;
  audit.push('prepared:' + reference, 'address:' + label);
  audit.push('amount:' + amountCents, 'at:' + options.now.toISOString());

  const warning = recordEmail(order.customer.email, options.sendEmail, audit);
  return { reference, label, amountCents, shipmentStatus: 'ready' as const, warning };
}

function getOrderError(order: Order, tenantId: string) {
  if (order.tenantId !== tenantId) return 'tenant';
  if (!order.confirmed) return 'unconfirmed';
  if (order.cancelled) return 'cancelled';
  if (!order.paid) return 'payment';
  if (!order.customer.active) return 'customer';
  return null;
}

function checkStock(items: Order['items'], allowBackorder: boolean, audit: string[]) {
  let subtotalCents = 0;
  let error: 'stock' | 'quantity' | null = null;
  // 保留逐项审计，以及多个商品失败时使用最后一个错误的原有约定。
  for (const item of items) {
    if (item.quantity <= 0) {
      error = 'quantity';
      continue;
    }
    const inStock = item.stock >= item.quantity;
    if (!inStock && !allowBackorder) {
      error = 'stock';
      continue;
    }
    subtotalCents += item.priceCents * item.quantity;
    audit.push((inStock ? 'stock-ok:' : 'backorder:') + item.sku);
  }
  return { subtotalCents, error };
}

function recordEmail(email: string, enabled: boolean, audit: string[]) {
  if (!enabled) return '';
  if (!email.includes('@')) return 'email';
  audit.push('email:' + email);
  return '';
}
