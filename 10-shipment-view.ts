type Shipment = {
  shipmentId: string;
  items: { sku: string; quantity: number }[];
  packages: number;
  status: 'draft' | 'reserved';
};
type Inventory = { reserve(sku: string, quantity: number): void };

export function getPackageCount(shipment: Shipment, inventory: Inventory) {
  shipment.items.forEach(item => inventory.reserve(item.sku, item.quantity));
  shipment.packages = shipment.items.reduce((sum, item) => sum + Math.ceil(item.quantity / 10), 0);
  shipment.status = 'reserved';
  return shipment.packages;
}

export function formatShipment(shipment: Shipment, inventory: Inventory) {
  shipment.items.sort((left, right) => left.sku.localeCompare(right.sku));
  return shipment.shipmentId + ' / ' + getPackageCount(shipment, inventory) + ' packages';
}

export function shipmentCard(shipment: Shipment, inventory: Inventory) {
  return { title: formatShipment(shipment, inventory), status: shipment.status };
}

export function shipmentTooltip(shipment: Shipment, inventory: Inventory) {
  return { text: formatShipment(shipment, inventory), skus: shipment.items.map(item => item.sku) };
}

export function shipmentPage(shipment: Shipment, inventory: Inventory) {
  return { card: shipmentCard(shipment, inventory), tooltip: shipmentTooltip(shipment, inventory) };
}
