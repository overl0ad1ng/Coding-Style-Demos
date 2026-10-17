type Shipment = {
  shipmentId: string;
  items: { sku: string; quantity: number }[];
  packages: number;
  status: 'draft' | 'reserved';
};
type Inventory = { reserve(sku: string, quantity: number): void };

export function getPackageCount(shipment: Shipment) {
  return shipment.packages;
}

export function formatShipment(shipment: Shipment) {
  return shipment.shipmentId + ' / ' + getPackageCount(shipment) + ' packages';
}

export function shipmentCard(shipment: Shipment) {
  return { title: formatShipment(shipment), status: shipment.status };
}

export function shipmentTooltip(shipment: Shipment) {
  const skus = shipment.items.map(item => item.sku).sort((left, right) => left.localeCompare(right));
  return { text: formatShipment(shipment), skus };
}

export function shipmentPage(shipment: Shipment) {
  return { card: shipmentCard(shipment), tooltip: shipmentTooltip(shipment) };
}

export function confirmShipment(shipment: Shipment, inventory: Inventory) {
  if (shipment.status === 'reserved') return shipment;
  for (const item of shipment.items) inventory.reserve(item.sku, item.quantity);
  shipment.packages = shipment.items.reduce((sum, item) => sum + Math.ceil(item.quantity / 10), 0);
  shipment.status = 'reserved';
  return shipment;
}
