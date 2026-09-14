import { db } from "@/db";
import {
  settings,
  units,
  unitConversions,
  categories,
  brands,
  warehouses,
  warehouseZones,
  racks,
  bins,
  products,
  inventoryTransactions,
  accounts,
  bankAccounts,
  suppliers,
  customers,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";

let seedPromise: Promise<void> | null = null;

async function runSeed() {
  const existing = await db.select({ id: settings.id }).from(settings).limit(1);
  if (existing.length > 0) return;

  // ---- Settings
  await db.insert(settings).values({
    businessName: "Shreejal Plywood & Hardware",
    address: "Balkhu Industrial Road, Kathmandu, Nepal",
    phone: "+977 9800000000",
    email: "sales@shreejalply.com",
    panVatNumber: "601234567",
    invoicePrefix: "INV-",
    startingInvoiceNumber: 1,
    invoiceFooter: "Thank you for your business.",
    termsAndConditions: "Goods once sold are only returnable within 7 days in resellable condition.",
    lowStockThreshold: 10,
    taxName: "VAT",
    taxRate: "13.00",
    currencySymbol: "Rs.",
    currencyFormat: "en-US",
  });

  // ---- Units
  const unitRows = await db
    .insert(units)
    .values([
      { name: "Sheet", symbol: "sheet" },
      { name: "Piece", symbol: "pcs" },
      { name: "Square Feet", symbol: "sq.ft" },
      { name: "Square Meter", symbol: "sq.m" },
      { name: "Bundle", symbol: "bundle" },
      { name: "Box", symbol: "box" },
      { name: "Kilogram", symbol: "kg" },
      { name: "Liter", symbol: "ltr" },
    ])
    .returning();

  const unitBy = (name: string) => unitRows.find((u) => u.name === name)!.id;

  await db.insert(unitConversions).values([
    { fromUnitId: unitBy("Sheet"), toUnitId: unitBy("Square Feet"), multiplier: "32.0000" },
    { fromUnitId: unitBy("Square Meter"), toUnitId: unitBy("Square Feet"), multiplier: "10.7639" },
    { fromUnitId: unitBy("Bundle"), toUnitId: unitBy("Piece"), multiplier: "10.0000" },
    { fromUnitId: unitBy("Box"), toUnitId: unitBy("Piece"), multiplier: "100.0000" },
  ]);

  // ---- Categories & brands
  const catRows = await db
    .insert(categories)
    .values([
      { name: "Plywood", description: "Commercial, marine and shuttering plywood sheets" },
      { name: "MDF", description: "Medium density fibreboard" },
      { name: "Veneer", description: "Natural and engineered veneers" },
      { name: "Laminate", description: "Decorative laminate sheets" },
      { name: "Hardware", description: "Hinges, screws, channels and fittings" },
      { name: "Adhesive", description: "Glues, resins and bonding agents" },
    ])
    .returning();
  const catBy = (name: string) => catRows.find((c) => c.name === name)!.id;

  const brandRows = await db
    .insert(brands)
    .values([
      { name: "Greenply" },
      { name: "Century" },
      { name: "Merino" },
      { name: "Fevicol" },
      { name: "Local" },
    ])
    .returning();
  const brandBy = (name: string) => brandRows.find((b) => b.name === name)!.id;

  // ---- Warehouse hierarchy
  const [wh] = await db
    .insert(warehouses)
    .values({ name: "Main Warehouse", location: "Balkhu, Kathmandu" })
    .returning();

  const zoneRows = await db
    .insert(warehouseZones)
    .values([
      { warehouseId: wh.id, name: "Zone A - Sheets" },
      { warehouseId: wh.id, name: "Zone B - Hardware" },
    ])
    .returning();

  const rackRows = await db
    .insert(racks)
    .values([
      { zoneId: zoneRows[0].id, name: "Rack A01" },
      { zoneId: zoneRows[0].id, name: "Rack A02" },
      { zoneId: zoneRows[1].id, name: "Rack B01" },
    ])
    .returning();

  const binRows = await db
    .insert(bins)
    .values([
      { rackId: rackRows[0].id, name: "A01-01" },
      { rackId: rackRows[0].id, name: "A01-02" },
      { rackId: rackRows[1].id, name: "A02-01" },
      { rackId: rackRows[2].id, name: "B01-01" },
    ])
    .returning();

  await db
    .update(settings)
    .set({ defaultWarehouseId: wh.id, defaultUnitId: unitBy("Sheet") });

  // ---- Products
  const productSeed = [
    {
      code: "PLY-18-CM",
      barcode: "8901234500011",
      name: "18mm Commercial Plywood 8x4",
      categoryId: catBy("Plywood"),
      brandId: brandBy("Greenply"),
      purchasePrice: "2450.00",
      sellingPrice: "2950.00",
      unitId: unitBy("Sheet"),
      thickness: "18 mm",
      length: "8.00",
      width: "4.00",
      area: "32.00",
      grade: "MR",
      finish: "Unfinished",
      minStockLevel: "10.00",
      reorderLevel: "20.00",
      taxRate: "13.00",
      opening: 85,
      binId: binRows[0].id,
    },
    {
      code: "PLY-12-MR",
      barcode: "8901234500028",
      name: "12mm MR Plywood 8x4",
      categoryId: catBy("Plywood"),
      brandId: brandBy("Century"),
      purchasePrice: "1750.00",
      sellingPrice: "2150.00",
      unitId: unitBy("Sheet"),
      thickness: "12 mm",
      length: "8.00",
      width: "4.00",
      area: "32.00",
      grade: "MR",
      finish: "Unfinished",
      minStockLevel: "10.00",
      reorderLevel: "25.00",
      taxRate: "13.00",
      opening: 42,
      binId: binRows[0].id,
    },
    {
      code: "PLY-19-MAR",
      barcode: "8901234500035",
      name: "19mm Marine Plywood 8x4",
      categoryId: catBy("Plywood"),
      brandId: brandBy("Greenply"),
      purchasePrice: "3400.00",
      sellingPrice: "4100.00",
      unitId: unitBy("Sheet"),
      thickness: "19 mm",
      length: "8.00",
      width: "4.00",
      area: "32.00",
      grade: "BWP",
      finish: "Unfinished",
      minStockLevel: "8.00",
      reorderLevel: "15.00",
      taxRate: "13.00",
      opening: 12,
      binId: binRows[1].id,
    },
    {
      code: "MDF-16-PL",
      barcode: "8901234500042",
      name: "16mm Plain MDF Board 8x4",
      categoryId: catBy("MDF"),
      brandId: brandBy("Century"),
      purchasePrice: "1580.00",
      sellingPrice: "1950.00",
      unitId: unitBy("Sheet"),
      thickness: "16 mm",
      length: "8.00",
      width: "4.00",
      area: "32.00",
      grade: "Standard",
      finish: "Plain",
      minStockLevel: "10.00",
      reorderLevel: "20.00",
      taxRate: "13.00",
      opening: 30,
      binId: binRows[2].id,
    },
    {
      code: "VEN-TEAK",
      barcode: "8901234500059",
      name: "Natural Teak Veneer 8x4",
      categoryId: catBy("Veneer"),
      brandId: brandBy("Local"),
      purchasePrice: "2100.00",
      sellingPrice: "2750.00",
      unitId: unitBy("Sheet"),
      thickness: "4 mm",
      length: "8.00",
      width: "4.00",
      area: "32.00",
      grade: "A",
      finish: "Natural",
      minStockLevel: "6.00",
      reorderLevel: "12.00",
      taxRate: "13.00",
      opening: 4,
      binId: binRows[1].id,
    },
    {
      code: "LAM-1MM-GL",
      barcode: "8901234500066",
      name: "1mm Glossy Laminate Sheet 8x4",
      categoryId: catBy("Laminate"),
      brandId: brandBy("Merino"),
      purchasePrice: "980.00",
      sellingPrice: "1350.00",
      unitId: unitBy("Sheet"),
      thickness: "1 mm",
      length: "8.00",
      width: "4.00",
      area: "32.00",
      grade: "Premium",
      finish: "Glossy",
      minStockLevel: "15.00",
      reorderLevel: "30.00",
      taxRate: "13.00",
      opening: 60,
      binId: binRows[2].id,
    },
    {
      code: "HW-HINGE-SS",
      barcode: "8901234500073",
      name: "Stainless Steel Auto Hinge",
      categoryId: catBy("Hardware"),
      brandId: brandBy("Local"),
      purchasePrice: "95.00",
      sellingPrice: "145.00",
      unitId: unitBy("Piece"),
      minStockLevel: "50.00",
      reorderLevel: "100.00",
      taxRate: "13.00",
      opening: 420,
      binId: binRows[3].id,
    },
    {
      code: "ADH-SH-5KG",
      barcode: "8901234500080",
      name: "Wood Adhesive SH 5kg",
      categoryId: catBy("Adhesive"),
      brandId: brandBy("Fevicol"),
      purchasePrice: "1150.00",
      sellingPrice: "1420.00",
      unitId: unitBy("Kilogram"),
      minStockLevel: "20.00",
      reorderLevel: "40.00",
      taxRate: "13.00",
      opening: 0,
      binId: binRows[3].id,
    },
  ];

  for (const p of productSeed) {
    const { opening, binId, ...rest } = p;
    const [created] = await db.insert(products).values(rest).returning();
    if (opening > 0) {
      await db.insert(inventoryTransactions).values({
        productId: created.id,
        warehouseId: wh.id,
        binId,
        quantity: opening.toFixed(4),
        unitId: created.unitId,
        transactionType: "ADJUSTMENT",
        referenceDocument: "OPENING-STOCK",
        previousStock: "0.0000",
        newStock: opening.toFixed(4),
        notes: "Opening stock loaded during system setup",
      });
    }
  }

  // ---- Minimal chart of accounts
  await db.insert(accounts).values([
    { code: "1000", name: "Cash in Hand", type: "Asset" },
    { code: "1010", name: "Bank Account", type: "Asset" },
    { code: "1100", name: "Accounts Receivable", type: "Asset" },
    { code: "1200", name: "Inventory", type: "Asset" },
    { code: "2000", name: "Accounts Payable", type: "Liability" },
    { code: "2100", name: "VAT Payable", type: "Liability" },
    { code: "3000", name: "Owner Equity", type: "Equity" },
    { code: "4000", name: "Sales Revenue", type: "Revenue" },
    { code: "4100", name: "Other Income", type: "Revenue" },
    { code: "5000", name: "Cost of Goods Sold", type: "Expense" },
    { code: "5100", name: "Operating Expenses", type: "Expense" },
  ]);
}

/** Idempotent extras added in later phases (safe to run on an already-seeded database). */
async function seedExtras() {
  const [bank] = await db.select({ id: bankAccounts.id }).from(bankAccounts).limit(1);
  if (!bank) {
    await db.insert(bankAccounts).values([
      { name: "Cash Drawer", type: "CASH", openingBalance: "0.00", currentBalance: "0.00" },
      { name: "Main Bank Account", type: "BANK", bankName: "Nepal Bank", openingBalance: "0.00", currentBalance: "0.00" },
    ]);
  }

  const [sr] = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.code, "4010"));
  if (!sr) {
    await db.insert(accounts).values({ code: "4010", name: "Sales Returns", type: "Revenue", parentAccountId: null, isActive: true });
  }

  // Once the user has cleared demo data, never re-seed the sample suppliers/customers.
  const [cfg] = await db.select({ cleared: settings.demoDataCleared }).from(settings).limit(1);
  if (cfg?.cleared) return;

  const [sup] = await db.select({ id: suppliers.id }).from(suppliers).limit(1);
  if (!sup) {
    await db.insert(suppliers).values([
      {
        name: "Himalayan Ply Traders",
        companyName: "Himalayan Ply Traders Pvt. Ltd.",
        contactPerson: "Ramesh Shrestha",
        phone: "+977 9841000001",
        email: "sales@himalayanply.com",
        address: "Birgunj, Nepal",
        panVatNumber: "301122334",
        paymentTerms: "Net 30",
        creditPeriod: 30,
      },
      {
        name: "Everest Hardware Supply",
        companyName: "Everest Hardware Supply",
        contactPerson: "Sita Gurung",
        phone: "+977 9841000002",
        address: "Teku, Kathmandu",
        panVatNumber: "302233445",
        paymentTerms: "Cash on delivery",
        creditPeriod: 15,
      },
    ]);
  }

  const [cust] = await db.select({ id: customers.id }).from(customers).limit(1);
  if (!cust) {
    await db.insert(customers).values([
      {
        name: "Krishna Furniture Works",
        companyName: "Krishna Furniture Works",
        contactPerson: "Krishna Maharjan",
        phone: "+977 9851000001",
        email: "krishna@furniture.com.np",
        address: "Lalitpur, Nepal",
        panVatNumber: "500122334",
      },
      {
        name: "Asha Interior Solutions",
        companyName: "Asha Interior Solutions",
        contactPerson: "Asha Thapa",
        phone: "+977 9851000002",
        address: "Kathmandu",
        panVatNumber: "500233445",
      },
      {
        name: "Walk-in Retail",
        companyName: null,
        contactPerson: null,
        phone: null,
        address: null,
        panVatNumber: null,
      },
    ]);
  }
}

export async function ensureSeed(): Promise<void> {
  if (!seedPromise) {
    seedPromise = runSeed()
      .then(() => seedExtras())
      .catch((err) => {
        seedPromise = null;
        console.error("Seed failed", err);
      });
  }
  await seedPromise;
}

export async function resetSeedFlag() {
  seedPromise = null;
  await db.execute(sql`select 1`);
}
