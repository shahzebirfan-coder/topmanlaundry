/* ============================================================
   Inventory Auto-Deduction
   Automatically deducts hangers/shoppers when an order is created.
   Triggered from POS payment confirmation.
   ============================================================ */

/* Calculate how much of each supply an order uses */
function calculateSupplyUsage(order) {
  const totalPcs = (order.items || []).reduce((sum, it) => sum + (it.qty || 0), 0);
  const delType = (order.deliveryType || 'hanger').toLowerCase();
  const usesHangers = delType === 'hanger' || delType === 'both';

  return {
    hanger: usesHangers ? totalPcs : 0,
    shopper: totalPcs  // 1 shopper per piece (always)
  };
}

/* Deduct inventory for an order — returns list of low-stock alerts */
function autoDeductInventory(order) {
  const usage = calculateSupplyUsage(order);
  const alerts = [];
  const inventory = DB.all('inventory');

  inventory.forEach(item => {
    if (!item.autoDeduct) return;
    const used = usage[item.autoDeduct];
    if (!used || used <= 0) return;

    const newStock = Math.max(0, (item.stock || 0) - used);
    const wasLow = (item.stock || 0) <= (item.minStock || 0);
    const isLow = newStock <= (item.minStock || 0);

    DB.update('inventory', item.id, {
      stock: newStock,
      updatedAt: new Date().toISOString()
    });

    // Log movement
    DB.insert('inventoryMovements', {
      itemId: item.id,
      itemName: item.name,
      type: 'out',
      qty: used,
      note: `Auto-deducted for order ${order.invoiceNo ? 'INV-' + order.invoiceNo : '#' + order.id.slice(-6)}`,
      orderId: order.id,
      userId: DB.currentUser()?.id || ''
    });

    // Alert if newly low
    if (!wasLow && isLow) {
      alerts.push({ name: item.name, stock: newStock, min: item.minStock, unit: item.unit });
    } else if (newStock === 0) {
      alerts.push({ name: item.name, stock: 0, min: item.minStock, unit: item.unit, critical: true });
    }
  });

  return alerts;
}

/* Show low-stock alert UI */
function showLowStockAlert(alerts) {
  if (!alerts || !alerts.length) return;

  alerts.forEach(a => {
    const isCritical = a.critical || a.stock === 0;
    const msg = isCritical
      ? `🚨 OUT OF STOCK: ${a.name}! Order more urgently.`
      : `⚠️ LOW STOCK: ${a.name} (${a.stock} ${a.unit} left, min ${a.min})`;
    if (typeof toast === 'function') {
      toast(msg, isCritical ? 'error' : 'warning');
    }
    // Log to audit
    if (typeof logAction === 'function') {
      logAction('inventory.low', `${a.name}: ${a.stock} ${a.unit} remaining`);
    }
  });
}

/* Get low-stock items for dashboard banner */
function getLowStockItems() {
  return DB.all('inventory').filter(i => (i.stock || 0) <= (i.minStock || 0));
}

/* Get critical (out of stock) items */
function getOutOfStockItems() {
  return DB.all('inventory').filter(i => (i.stock || 0) === 0);
}

/* Restore stock if order is cancelled/deleted */
function restoreInventory(order) {
  const usage = calculateSupplyUsage(order);
  const inventory = DB.all('inventory');
  inventory.forEach(item => {
    if (!item.autoDeduct) return;
    const used = usage[item.autoDeduct];
    if (!used || used <= 0) return;

    DB.update('inventory', item.id, {
      stock: (item.stock || 0) + used,
      updatedAt: new Date().toISOString()
    });

    DB.insert('inventoryMovements', {
      itemId: item.id,
      itemName: item.name,
      type: 'in',
      qty: used,
      note: `Restored from cancelled order ${order.invoiceNo ? 'INV-' + order.invoiceNo : '#' + order.id.slice(-6)}`,
      orderId: order.id,
      userId: DB.currentUser()?.id || ''
    });
  });
}
