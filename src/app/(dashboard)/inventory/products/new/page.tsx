import React from "react";
import { db } from "@/db";
import { brands, categories, units, warehouses, bins } from "@/db/schema";
import { PageHeader } from "@/components/ui";
import { ProductForm } from "../ProductForm";
import { ensureSeed } from "@/lib/seed";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  await ensureSeed();
  const [cats, brs, uns, whs, bns] = await Promise.all([
    db.select({ id: categories.id, name: categories.name }).from(categories),
    db.select({ id: brands.id, name: brands.name }).from(brands),
    db.select({ id: units.id, name: units.name, symbol: units.symbol }).from(units),
    db.select({ id: warehouses.id, name: warehouses.name }).from(warehouses),
    db.select({ id: bins.id, name: bins.name }).from(bins),
  ]);

  return (
    <div>
      <PageHeader title="New Product" subtitle="Add an item to your catalogue." />
      <ProductForm categories={cats} brands={brs} units={uns} warehouses={whs} bins={bns} />
    </div>
  );
}
