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

export function processOrder(
  order: Order,
  tenantId: string,
  allowBackorder: boolean,
  express: boolean,
  sendEmail: boolean,
  audit: string[],
  now: Date,
  exchangeRate: number,
) {
  let result: any = null;
  let total = 0;
  let canShip = true;
  let fee = 0;
  let discount = 0;
  let message = '';
  if (order.tenantId === tenantId) {
    if (order.confirmed) {
      if (!order.cancelled) {
        if (order.paid) {
          if (order.customer.active) {
            if (order.address) {
              if (order.items.length > 0) {
                for (const item of order.items) {
                  if (item.quantity > 0) {
                    if (item.stock >= item.quantity) {
                      total += item.priceCents * item.quantity;
                      audit.push('stock-ok:' + item.sku);
                    } else {
                      if (allowBackorder) {
                        total += item.priceCents * item.quantity;
                        audit.push('backorder:' + item.sku);
                      } else {
                        canShip = false;
                        message = 'stock';
                      }
                    }
                  } else {
                    canShip = false;
                    message = 'quantity';
                  }
                }
                if (canShip) {
                  if (order.customer.member) {
                    discount = Math.round(total * 0.1);
                  }
                  if (order.address.country === 'CN') {
                    fee = 800;
                  } else {
                    fee = 2500;
                  }
                  if (order.customer.member && total >= 10000) {
                    fee = 0;
                  }
                  if (express) {
                    fee += 1500;
                  }
                  const net = total - discount;
                  const converted = Math.round((net + fee) * exchangeRate);
                  const label = order.address.city + ' ' + order.address.street;
                  const reference = tenantId + ':' + order.id;
                  const date = now.toISOString();
                  audit.push('prepared:' + reference);
                  audit.push('address:' + label);
                  audit.push('amount:' + converted);
                  audit.push('at:' + date);
                  if (sendEmail) {
                    if (order.customer.email.includes('@')) {
                      audit.push('email:' + order.customer.email);
                    } else {
                      message = 'email';
                    }
                  }
                  result = {
                    reference,
                    label,
                    amountCents: converted,
                    shipmentStatus: 'ready',
                    warning: message,
                  };
                } else {
                  result = { error: message };
                }
              } else {
                result = { error: 'empty' };
              }
            } else {
              result = { error: 'address' };
            }
          } else {
            result = { error: 'customer' };
          }
        } else {
          result = { error: 'payment' };
        }
      } else {
        result = { error: 'cancelled' };
      }
    } else {
      result = { error: 'unconfirmed' };
    }
  } else {
    result = { error: 'tenant' };
  }
  return result;
}
