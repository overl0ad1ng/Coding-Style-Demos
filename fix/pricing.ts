// README 约定：免配送门槛使用商品原价，加急费不参与减免。
export function calculateCartTotal(subtotalCents: number, member: boolean, express: boolean) {
  const discountCents = member ? Math.round(subtotalCents * 0.1) : 0;
  const shippingCents = member && subtotalCents >= 10000 ? 0 : 800;
  const expressCents = express ? 1500 : 0;
  return subtotalCents - discountCents + shippingCents + expressCents;
}
