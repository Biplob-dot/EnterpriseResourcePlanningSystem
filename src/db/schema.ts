import { pgTable, serial, text, varchar, decimal, integer, timestamp, boolean, pgEnum, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const transactionTypeEnum = pgEnum('transaction_type', ['PURCHASE', 'SALE', 'RETURN_SALE', 'RETURN_PURCHASE', 'ADJUSTMENT', 'TRANSFER']);
export const poStatusEnum = pgEnum('po_status', ['DRAFT', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED']);
export const soStatusEnum = pgEnum('so_status', ['DRAFT', 'CONFIRMED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'COMPLETED', 'CANCELLED']);
export const invoiceStatusEnum = pgEnum('invoice_status', ['UNPAID', 'PARTIALLY_PAID', 'PAID', 'OVERDUE']);
export const quoteStatusEnum = pgEnum('quote_status', ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED']);

// Settings
export const settings = pgTable('settings', {
  id: serial('id').primaryKey(),
  businessName: varchar('business_name', { length: 255 }).notNull(),
  address: text('address'),
  phone: varchar('phone', { length: 50 }),
  email: varchar('email', { length: 255 }),
  panVatNumber: varchar('pan_vat_number', { length: 100 }),
  logoUrl: text('logo_url'),
  invoicePrefix: varchar('invoice_prefix', { length: 20 }).default('INV-'),
  startingInvoiceNumber: integer('starting_invoice_number').default(1),
  invoiceFooter: text('invoice_footer'),
  termsAndConditions: text('terms_and_conditions'),
  defaultUnitId: integer('default_unit_id'),
  defaultWarehouseId: integer('default_warehouse_id'),
  lowStockThreshold: integer('low_stock_threshold').default(10),
  taxName: varchar('tax_name', { length: 100 }).default('VAT'),
  taxRate: decimal('tax_rate', { precision: 5, scale: 2 }).default('0.00'),
  taxInclusive: boolean('tax_inclusive').default(false),
  currencySymbol: varchar('currency_symbol', { length: 10 }).default('$'),
  currencyFormat: varchar('currency_format', { length: 50 }).default('en-US'),
  demoDataCleared: boolean('demo_data_cleared').default(false),
});

// Inventory Basics
export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  isActive: boolean('is_active').default(true),
});

export const brands = pgTable('brands', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  isActive: boolean('is_active').default(true),
});

export const units = pgTable('units', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 50 }).notNull(),
  symbol: varchar('symbol', { length: 20 }).notNull(),
});

export const unitConversions = pgTable('unit_conversions', {
  id: serial('id').primaryKey(),
  fromUnitId: integer('from_unit_id').references(() => units.id),
  toUnitId: integer('to_unit_id').references(() => units.id),
  multiplier: decimal('multiplier', { precision: 18, scale: 4 }).notNull(),
});

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 100 }).unique().notNull(),
  barcode: varchar('barcode', { length: 100 }),
  name: varchar('name', { length: 255 }).notNull(),
  categoryId: integer('category_id').references(() => categories.id),
  brandId: integer('brand_id').references(() => brands.id),
  description: text('description'),
  imageUrl: text('image_url'),
  purchasePrice: decimal('purchase_price', { precision: 18, scale: 2 }).default('0.00'),
  sellingPrice: decimal('selling_price', { precision: 18, scale: 2 }).default('0.00'),
  minStockLevel: decimal('min_stock_level', { precision: 18, scale: 2 }).default('0.00'),
  reorderLevel: decimal('reorder_level', { precision: 18, scale: 2 }).default('0.00'),
  taxRate: decimal('tax_rate', { precision: 5, scale: 2 }).default('0.00'),
  unitId: integer('unit_id').references(() => units.id),
  isActive: boolean('is_active').default(true),
  trackBatches: boolean('track_batches').default(false),

  // Plywood Specifics
  thickness: varchar('thickness', { length: 50 }),
  length: decimal('length', { precision: 18, scale: 2 }),
  width: decimal('width', { precision: 18, scale: 2 }),
  area: decimal('area', { precision: 18, scale: 2 }),
  grade: varchar('grade', { length: 50 }),
  finish: varchar('finish', { length: 50 }),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Warehouse
export const warehouses = pgTable('warehouses', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  location: text('location'),
  isActive: boolean('is_active').default(true),
});

export const warehouseZones = pgTable('warehouse_zones', {
  id: serial('id').primaryKey(),
  warehouseId: integer('warehouse_id').references(() => warehouses.id),
  name: varchar('name', { length: 100 }).notNull(),
});

export const racks = pgTable('racks', {
  id: serial('id').primaryKey(),
  zoneId: integer('zone_id').references(() => warehouseZones.id),
  name: varchar('name', { length: 100 }).notNull(),
});

export const bins = pgTable('bins', {
  id: serial('id').primaryKey(),
  rackId: integer('rack_id').references(() => racks.id),
  name: varchar('name', { length: 100 }).notNull(),
});

export const inventoryTransactions = pgTable(
  'inventory_transactions',
  {
    id: serial('id').primaryKey(),
    productId: integer('product_id').references(() => products.id),
    warehouseId: integer('warehouse_id').references(() => warehouses.id),
    binId: integer('bin_id').references(() => bins.id),
    quantity: decimal('quantity', { precision: 18, scale: 4 }).notNull(),
    unitId: integer('unit_id').references(() => units.id),
    transactionType: transactionTypeEnum('transaction_type').notNull(),
    referenceDocument: varchar('reference_document', { length: 100 }),
    previousStock: decimal('previous_stock', { precision: 18, scale: 4 }),
    newStock: decimal('new_stock', { precision: 18, scale: 4 }),
    createdAt: timestamp('created_at').defaultNow(),
    notes: text('notes'),
  },
  (t) => [index('inv_tx_product_idx').on(t.productId), index('inv_tx_created_idx').on(t.createdAt)]
);

export const stockAdjustments = pgTable('stock_adjustments', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').references(() => products.id),
  warehouseId: integer('warehouse_id').references(() => warehouses.id),
  binId: integer('bin_id').references(() => bins.id),
  currentQuantity: decimal('current_quantity', { precision: 18, scale: 4 }),
  newQuantity: decimal('new_quantity', { precision: 18, scale: 4 }),
  adjustmentQuantity: decimal('adjustment_quantity', { precision: 18, scale: 4 }),
  reason: text('reason').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const batches = pgTable('batches', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').references(() => products.id),
  batchNumber: varchar('batch_number', { length: 100 }).notNull(),
  supplierId: integer('supplier_id'),
  purchaseDate: timestamp('purchase_date'),
  quantityReceived: decimal('quantity_received', { precision: 18, scale: 4 }),
  remainingQuantity: decimal('remaining_quantity', { precision: 18, scale: 4 }),
  cost: decimal('cost', { precision: 18, scale: 2 }),
  reference: varchar('reference', { length: 100 }),
});

// Parties
export const suppliers = pgTable('suppliers', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  companyName: varchar('company_name', { length: 255 }),
  contactPerson: varchar('contact_person', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  email: varchar('email', { length: 255 }),
  address: text('address'),
  panVatNumber: varchar('pan_vat_number', { length: 100 }),
  paymentTerms: text('payment_terms'),
  creditPeriod: integer('credit_period'),
  outstandingBalance: decimal('outstanding_balance', { precision: 18, scale: 2 }).default('0.00'),
  notes: text('notes'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

export const supplierTransactions = pgTable(
  'supplier_transactions',
  {
    id: serial('id').primaryKey(),
    supplierId: integer('supplier_id').references(() => suppliers.id).notNull(),
    date: timestamp('date').defaultNow().notNull(),
    type: varchar('type', { length: 30 }).notNull(), // OPENING, PURCHASE, PAYMENT, RETURN, ADJUSTMENT
    reference: varchar('reference', { length: 100 }),
    referenceId: integer('reference_id'),
    debit: decimal('debit', { precision: 18, scale: 2 }).default('0.00').notNull(), // reduces what we owe
    credit: decimal('credit', { precision: 18, scale: 2 }).default('0.00').notNull(), // increases what we owe
    balanceAfter: decimal('balance_after', { precision: 18, scale: 2 }),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (t) => [index('sup_tx_supplier_idx').on(t.supplierId)]
);

export const customers = pgTable('customers', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  companyName: varchar('company_name', { length: 255 }),
  contactPerson: varchar('contact_person', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  email: varchar('email', { length: 255 }),
  address: text('address'),
  panVatNumber: varchar('pan_vat_number', { length: 100 }),
  outstandingBalance: decimal('outstanding_balance', { precision: 18, scale: 2 }).default('0.00'),
  notes: text('notes'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

export const customerTransactions = pgTable(
  'customer_transactions',
  {
    id: serial('id').primaryKey(),
    customerId: integer('customer_id').references(() => customers.id).notNull(),
    date: timestamp('date').defaultNow().notNull(),
    type: varchar('type', { length: 30 }).notNull(), // OPENING, INVOICE, PAYMENT, RETURN, ADJUSTMENT
    reference: varchar('reference', { length: 100 }),
    referenceId: integer('reference_id'),
    debit: decimal('debit', { precision: 18, scale: 2 }).default('0.00').notNull(), // increases what they owe
    credit: decimal('credit', { precision: 18, scale: 2 }).default('0.00').notNull(), // reduces what they owe
    balanceAfter: decimal('balance_after', { precision: 18, scale: 2 }),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (t) => [index('cus_tx_customer_idx').on(t.customerId)]
);

// Purchasing
export const purchaseOrders = pgTable('purchase_orders', {
  id: serial('id').primaryKey(),
  poNumber: varchar('po_number', { length: 100 }).unique().notNull(),
  supplierId: integer('supplier_id').references(() => suppliers.id),
  date: timestamp('date').defaultNow(),
  expectedDeliveryDate: timestamp('expected_delivery_date'),
  status: poStatusEnum('status').default('DRAFT'),
  subtotal: decimal('subtotal', { precision: 18, scale: 2 }).default('0.00'),
  totalAmount: decimal('total_amount', { precision: 18, scale: 2 }).default('0.00'),
  taxAmount: decimal('tax_amount', { precision: 18, scale: 2 }).default('0.00'),
  discountAmount: decimal('discount_amount', { precision: 18, scale: 2 }).default('0.00'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const purchaseOrderItems = pgTable('purchase_order_items', {
  id: serial('id').primaryKey(),
  poId: integer('po_id').references(() => purchaseOrders.id),
  productId: integer('product_id').references(() => products.id),
  quantity: decimal('quantity', { precision: 18, scale: 4 }).notNull(),
  receivedQuantity: decimal('received_quantity', { precision: 18, scale: 4 }).default('0.0000'),
  unitId: integer('unit_id').references(() => units.id),
  unitPrice: decimal('unit_price', { precision: 18, scale: 2 }).notNull(),
  discount: decimal('discount', { precision: 18, scale: 2 }).default('0.00'),
  taxRate: decimal('tax_rate', { precision: 5, scale: 2 }),
  total: decimal('total', { precision: 18, scale: 2 }),
});

export const goodsReceipts = pgTable('goods_receipts', {
  id: serial('id').primaryKey(),
  grnNumber: varchar('grn_number', { length: 100 }).unique().notNull(),
  supplierId: integer('supplier_id').references(() => suppliers.id),
  poId: integer('po_id').references(() => purchaseOrders.id),
  date: timestamp('date').defaultNow(),
  subtotal: decimal('subtotal', { precision: 18, scale: 2 }).default('0.00'),
  discountAmount: decimal('discount_amount', { precision: 18, scale: 2 }).default('0.00'),
  taxAmount: decimal('tax_amount', { precision: 18, scale: 2 }).default('0.00'),
  totalAmount: decimal('total_amount', { precision: 18, scale: 2 }),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const goodsReceiptItems = pgTable('goods_receipt_items', {
  id: serial('id').primaryKey(),
  grnId: integer('grn_id').references(() => goodsReceipts.id),
  poItemId: integer('po_item_id').references(() => purchaseOrderItems.id),
  productId: integer('product_id').references(() => products.id),
  warehouseId: integer('warehouse_id').references(() => warehouses.id),
  binId: integer('bin_id').references(() => bins.id),
  quantityReceived: decimal('quantity_received', { precision: 18, scale: 4 }).notNull(),
  quantityDamaged: decimal('quantity_damaged', { precision: 18, scale: 4 }).default('0.00'),
  unitPrice: decimal('unit_price', { precision: 18, scale: 2 }),
  discount: decimal('discount', { precision: 18, scale: 2 }).default('0.00'),
  taxRate: decimal('tax_rate', { precision: 5, scale: 2 }),
  total: decimal('total', { precision: 18, scale: 2 }),
  batchNumber: varchar('batch_number', { length: 100 }),
});

export const purchaseReturns = pgTable('purchase_returns', {
  id: serial('id').primaryKey(),
  returnNumber: varchar('return_number', { length: 100 }).unique().notNull(),
  supplierId: integer('supplier_id').references(() => suppliers.id),
  originalPurchaseId: integer('original_purchase_id').references(() => goodsReceipts.id),
  date: timestamp('date').defaultNow(),
  subtotal: decimal('subtotal', { precision: 18, scale: 2 }).default('0.00'),
  taxAmount: decimal('tax_amount', { precision: 18, scale: 2 }).default('0.00'),
  totalAmount: decimal('total_amount', { precision: 18, scale: 2 }),
  reason: text('reason'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const purchaseReturnItems = pgTable('purchase_return_items', {
  id: serial('id').primaryKey(),
  returnId: integer('return_id').references(() => purchaseReturns.id),
  productId: integer('product_id').references(() => products.id),
  quantity: decimal('quantity', { precision: 18, scale: 4 }).notNull(),
  unitPrice: decimal('unit_price', { precision: 18, scale: 2 }),
  taxRate: decimal('tax_rate', { precision: 5, scale: 2 }),
  total: decimal('total', { precision: 18, scale: 2 }),
});

// Sales
export const quotations = pgTable('quotations', {
  id: serial('id').primaryKey(),
  quoteNumber: varchar('quote_number', { length: 100 }).unique().notNull(),
  customerId: integer('customer_id').references(() => customers.id),
  date: timestamp('date').defaultNow(),
  validUntil: timestamp('valid_until'),
  status: quoteStatusEnum('status').default('DRAFT'),
  subtotal: decimal('subtotal', { precision: 18, scale: 2 }).default('0.00'),
  totalAmount: decimal('total_amount', { precision: 18, scale: 2 }).default('0.00'),
  taxAmount: decimal('tax_amount', { precision: 18, scale: 2 }).default('0.00'),
  discountAmount: decimal('discount_amount', { precision: 18, scale: 2 }).default('0.00'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const quotationItems = pgTable('quotation_items', {
  id: serial('id').primaryKey(),
  quoteId: integer('quote_id').references(() => quotations.id),
  productId: integer('product_id').references(() => products.id),
  quantity: decimal('quantity', { precision: 18, scale: 4 }).notNull(),
  unitId: integer('unit_id').references(() => units.id),
  unitPrice: decimal('unit_price', { precision: 18, scale: 2 }).notNull(),
  discount: decimal('discount', { precision: 18, scale: 2 }).default('0.00'),
  taxRate: decimal('tax_rate', { precision: 5, scale: 2 }),
  total: decimal('total', { precision: 18, scale: 2 }),
});

export const salesOrders = pgTable('sales_orders', {
  id: serial('id').primaryKey(),
  soNumber: varchar('so_number', { length: 100 }).unique().notNull(),
  customerId: integer('customer_id').references(() => customers.id),
  quoteId: integer('quote_id').references(() => quotations.id),
  date: timestamp('date').defaultNow(),
  deliveryDate: timestamp('delivery_date'),
  status: soStatusEnum('status').default('DRAFT'),
  subtotal: decimal('subtotal', { precision: 18, scale: 2 }).default('0.00'),
  totalAmount: decimal('total_amount', { precision: 18, scale: 2 }).default('0.00'),
  taxAmount: decimal('tax_amount', { precision: 18, scale: 2 }).default('0.00'),
  discountAmount: decimal('discount_amount', { precision: 18, scale: 2 }).default('0.00'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const salesOrderItems = pgTable('sales_order_items', {
  id: serial('id').primaryKey(),
  soId: integer('so_id').references(() => salesOrders.id),
  productId: integer('product_id').references(() => products.id),
  quantity: decimal('quantity', { precision: 18, scale: 4 }).notNull(),
  deliveredQuantity: decimal('delivered_quantity', { precision: 18, scale: 4 }).default('0.0000'),
  unitId: integer('unit_id').references(() => units.id),
  unitPrice: decimal('unit_price', { precision: 18, scale: 2 }).notNull(),
  discount: decimal('discount', { precision: 18, scale: 2 }).default('0.00'),
  taxRate: decimal('tax_rate', { precision: 5, scale: 2 }),
  total: decimal('total', { precision: 18, scale: 2 }),
});

export const deliveryNotes = pgTable('delivery_notes', {
  id: serial('id').primaryKey(),
  dnNumber: varchar('dn_number', { length: 100 }).unique().notNull(),
  customerId: integer('customer_id').references(() => customers.id),
  soId: integer('so_id').references(() => salesOrders.id),
  invoiceId: integer('invoice_id'),
  date: timestamp('date').defaultNow(),
  address: text('address'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const deliveryNoteItems = pgTable('delivery_note_items', {
  id: serial('id').primaryKey(),
  dnId: integer('dn_id').references(() => deliveryNotes.id),
  soItemId: integer('so_item_id').references(() => salesOrderItems.id),
  productId: integer('product_id').references(() => products.id),
  quantity: decimal('quantity', { precision: 18, scale: 4 }).notNull(),
  unitId: integer('unit_id').references(() => units.id),
});

export const invoices = pgTable('invoices', {
  id: serial('id').primaryKey(),
  invoiceNumber: varchar('invoice_number', { length: 100 }).unique().notNull(),
  customerId: integer('customer_id').references(() => customers.id),
  soId: integer('so_id').references(() => salesOrders.id),
  quoteId: integer('quote_id').references(() => quotations.id),
  date: timestamp('date').defaultNow(),
  dueDate: timestamp('due_date'),
  status: invoiceStatusEnum('status').default('UNPAID'),
  isCancelled: boolean('is_cancelled').default(false),
  subtotal: decimal('subtotal', { precision: 18, scale: 2 }).default('0.00'),
  totalAmount: decimal('total_amount', { precision: 18, scale: 2 }).default('0.00'),
  taxAmount: decimal('tax_amount', { precision: 18, scale: 2 }).default('0.00'),
  discountAmount: decimal('discount_amount', { precision: 18, scale: 2 }).default('0.00'),
  transportAmount: decimal('transport_amount', { precision: 18, scale: 2 }).default('0.00'),
  amountPaid: decimal('amount_paid', { precision: 18, scale: 2 }).default('0.00'),
  amountDue: decimal('amount_due', { precision: 18, scale: 2 }).default('0.00'),
  costOfGoods: decimal('cost_of_goods', { precision: 18, scale: 2 }).default('0.00'),
  paymentMethod: varchar('payment_method', { length: 50 }),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const invoiceItems = pgTable('invoice_items', {
  id: serial('id').primaryKey(),
  invoiceId: integer('invoice_id').references(() => invoices.id),
  productId: integer('product_id').references(() => products.id),
  quantity: decimal('quantity', { precision: 18, scale: 4 }).notNull(),
  unitId: integer('unit_id').references(() => units.id),
  unitPrice: decimal('unit_price', { precision: 18, scale: 2 }).notNull(),
  unitCost: decimal('unit_cost', { precision: 18, scale: 2 }).default('0.00'),
  discount: decimal('discount', { precision: 18, scale: 2 }).default('0.00'),
  taxRate: decimal('tax_rate', { precision: 5, scale: 2 }),
  transport: decimal('transport', { precision: 18, scale: 2 }).default('0.00'),
  total: decimal('total', { precision: 18, scale: 2 }),
});

export const salesReturns = pgTable('sales_returns', {
  id: serial('id').primaryKey(),
  returnNumber: varchar('return_number', { length: 100 }).unique().notNull(),
  customerId: integer('customer_id').references(() => customers.id),
  originalInvoiceId: integer('original_invoice_id').references(() => invoices.id),
  date: timestamp('date').defaultNow(),
  subtotal: decimal('subtotal', { precision: 18, scale: 2 }).default('0.00'),
  taxAmount: decimal('tax_amount', { precision: 18, scale: 2 }).default('0.00'),
  totalAmount: decimal('total_amount', { precision: 18, scale: 2 }),
  reason: text('reason'),
  condition: varchar('condition', { length: 100 }),
  createdAt: timestamp('created_at').defaultNow(),
});

export const salesReturnItems = pgTable('sales_return_items', {
  id: serial('id').primaryKey(),
  returnId: integer('return_id').references(() => salesReturns.id),
  productId: integer('product_id').references(() => products.id),
  quantity: decimal('quantity', { precision: 18, scale: 4 }).notNull(),
  unitPrice: decimal('unit_price', { precision: 18, scale: 2 }),
  taxRate: decimal('tax_rate', { precision: 5, scale: 2 }),
  total: decimal('total', { precision: 18, scale: 2 }),
});

// Bank & cash
export const bankAccounts = pgTable('bank_accounts', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  type: varchar('type', { length: 20 }).notNull(), // CASH | BANK
  bankName: varchar('bank_name', { length: 100 }),
  accountNumber: varchar('account_number', { length: 100 }),
  openingBalance: decimal('opening_balance', { precision: 18, scale: 2 }).default('0.00'),
  currentBalance: decimal('current_balance', { precision: 18, scale: 2 }).default('0.00'),
  isActive: boolean('is_active').default(true),
});

export const bankTransactions = pgTable('bank_transactions', {
  id: serial('id').primaryKey(),
  bankAccountId: integer('bank_account_id').references(() => bankAccounts.id).notNull(),
  date: timestamp('date').defaultNow().notNull(),
  type: varchar('type', { length: 30 }).notNull(), // DEPOSIT, WITHDRAWAL, TRANSFER_IN, TRANSFER_OUT, PAYMENT_IN, PAYMENT_OUT, EXPENSE, INCOME
  amount: decimal('amount', { precision: 18, scale: 2 }).notNull(), // signed: + in, - out
  reference: varchar('reference', { length: 100 }),
  description: text('description'),
  isReconciled: boolean('is_reconciled').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// Payments
export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  paymentNumber: varchar('payment_number', { length: 100 }).unique().notNull(),
  customerId: integer('customer_id').references(() => customers.id),
  supplierId: integer('supplier_id').references(() => suppliers.id),
  bankAccountId: integer('bank_account_id').references(() => bankAccounts.id),
  date: timestamp('date').defaultNow(),
  amount: decimal('amount', { precision: 18, scale: 2 }).notNull(),
  paymentMethod: varchar('payment_method', { length: 50 }),
  reference: varchar('reference', { length: 255 }),
  status: varchar('status', { length: 20 }).default('COMPLETED'), // COMPLETED | VOID
  // Cheque-specific tracking
  chequeDate: timestamp('cheque_date'),
  chequeCleared: boolean('cheque_cleared').default(false),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const paymentAllocations = pgTable('payment_allocations', {
  id: serial('id').primaryKey(),
  paymentId: integer('payment_id').references(() => payments.id),
  invoiceId: integer('invoice_id').references(() => invoices.id),
  amountAllocated: decimal('amount_allocated', { precision: 18, scale: 2 }).notNull(),
});

// Accounting
export const accounts = pgTable('accounts', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 50 }).unique().notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  parentAccountId: integer('parent_account_id'),
  isActive: boolean('is_active').default(true),
});

export const journalEntries = pgTable('journal_entries', {
  id: serial('id').primaryKey(),
  date: timestamp('date').defaultNow(),
  reference: varchar('reference', { length: 100 }),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const journalEntryLines = pgTable('journal_entry_lines', {
  id: serial('id').primaryKey(),
  entryId: integer('entry_id').references(() => journalEntries.id),
  accountId: integer('account_id').references(() => accounts.id),
  debit: decimal('debit', { precision: 18, scale: 2 }).default('0.00'),
  credit: decimal('credit', { precision: 18, scale: 2 }).default('0.00'),
});

export const expenses = pgTable('expenses', {
  id: serial('id').primaryKey(),
  date: timestamp('date').defaultNow(),
  category: varchar('category', { length: 100 }).notNull(),
  amount: decimal('amount', { precision: 18, scale: 2 }).notNull(),
  paymentMethod: varchar('payment_method', { length: 50 }),
  bankAccountId: integer('bank_account_id').references(() => bankAccounts.id),
  description: text('description'),
  receiptUrl: text('receipt_url'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const income = pgTable('income', {
  id: serial('id').primaryKey(),
  date: timestamp('date').defaultNow(),
  category: varchar('category', { length: 100 }).notNull(),
  amount: decimal('amount', { precision: 18, scale: 2 }).notNull(),
  paymentMethod: varchar('payment_method', { length: 50 }),
  bankAccountId: integer('bank_account_id').references(() => bankAccounts.id),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Audit
export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  action: varchar('action', { length: 100 }).notNull(),
  tableName: varchar('table_name', { length: 100 }),
  recordId: integer('record_id'),
  previousValue: text('previous_value'),
  newValue: text('new_value'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Relations
export const productsRelations = relations(products, ({ one }) => ({
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  brand: one(brands, { fields: [products.brandId], references: [brands.id] }),
  unit: one(units, { fields: [products.unitId], references: [units.id] }),
}));

export const inventoryTransactionsRelations = relations(inventoryTransactions, ({ one }) => ({
  product: one(products, { fields: [inventoryTransactions.productId], references: [products.id] }),
  warehouse: one(warehouses, { fields: [inventoryTransactions.warehouseId], references: [warehouses.id] }),
  bin: one(bins, { fields: [inventoryTransactions.binId], references: [bins.id] }),
}));

export const invoiceRelations = relations(invoices, ({ one, many }) => ({
  customer: one(customers, { fields: [invoices.customerId], references: [customers.id] }),
  items: many(invoiceItems),
}));

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, { fields: [invoiceItems.invoiceId], references: [invoices.id] }),
  product: one(products, { fields: [invoiceItems.productId], references: [products.id] }),
}));
