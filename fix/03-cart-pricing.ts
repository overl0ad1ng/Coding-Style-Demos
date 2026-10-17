import { calculateCartTotal } from './pricing.js';

type Cart = { member: boolean; express: boolean; itemTotalsCents: number[] };

export function previewCart(cart: Cart) {
  const subtotalCents = cart.itemTotalsCents.reduce((sum, value) => sum + value, 0);
  return calculateCartTotal(subtotalCents, cart.member, cart.express);
}

export function submitCart(cart: Cart, save: (amountCents: number) => void) {
  const amountCents = previewCart(cart);
  save(amountCents);
  return amountCents;
}

export function receiptTotal(cart: Cart) {
  return previewCart(cart);
}

export function checkoutPage(cart: Cart, save: (amountCents: number) => void) {
  return {
    displayedCents: previewCart(cart),
    chargedCents: submitCart(cart, save),
    receiptCents: receiptTotal(cart),
  };
}
