import React from "react";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { products, brands, categories, units, warehouses, bins } from "@/db/schema";
import { eq } from "drizzle-orm";
import { PageHeader } from "@/components/ui";
import { ProductForm } from "../../ProductForm";

export const dynamic = "force-dynamic";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const productId = Number(id);
  if (!Number.isFinite(productId)) notFound();

  const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
  if (!product) notFound();

  const [cats, brs, uns, whs, bns] = await Promise.all([
    db.select({ id: categories.id, name: categories.name }).from(categories),
    db.select({ id: brands.id, name: brands.name }).from(brands),
    db.select({ id: units.id, name: units.name, symbol: units.symbol }).from(units),
    db.select({ id: warehouses.id, name: warehouses.name }).from(warehouses),
    db.select({ id: bins.id, name: bins.name }).from(bins),
  ]);

  return (
    <div>
      <PageHeader title={`Edit ${product.name}`} subtitle="Update product information and pricing." />
      <ProductForm product={product} categories={cats} brands={brs} units={uns} warehouses={whs} bins={bns} />
    </div>
  );
}
