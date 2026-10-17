type Cart = { member: boolean; express: boolean; itemTotalsCents: number[] };

export function previewCart(cart: Cart) {
  const subtotal = cart.itemTotalsCents.reduce((sum, value) => sum + value, 0);
  const discount = cart.member ? Math.round(subtotal * 0.1) : 0;
  const shipping = cart.member && subtotal >= 10000 ? 0 : 800;
  return subtotal - discount + shipping + (cart.express ? 1500 : 0);
}

export function submitCart(cart: Cart, save: (amountCents: number) => void) {
  const amount = cart.itemTotalsCents.reduce((sum, value) => sum + value, 0);
  const reduction = cart.member ? Math.round(amount * 0.1) : 0;
  const delivery = cart.member && amount - reduction >= 10000 ? 0 : 800;
  const payable = amount - reduction + delivery + (cart.express ? 1500 : 0);
  save(payable);
  return payable;
}

export function receiptTotal(cart: Cart) {
  const base = cart.itemTotalsCents.reduce((sum, value) => sum + value, 0);
  const rebate = cart.member ? Math.round(base * 0.1) : 0;
  const freight = cart.member && base > 10000 ? 0 : 800;
  return base - rebate + freight + (cart.express ? 1500 : 0);
}

export function checkoutPage(cart: Cart, save: (amountCents: number) => void) {
  return {
    displayedCents: previewCart(cart),
    chargedCents: submitCart(cart, save),
    receiptCents: receiptTotal(cart),
  };
}
