import React from "react";
import { Plus } from "lucide-react";
import { db } from "@/db";
import { brands, categories } from "@/db/schema";
import { sql } from "drizzle-orm";
import { Badge, Card, Field, PageHeader, inputClass } from "@/components/ui";
import { Flash } from "@/components/ui/Flash";
import { createBrand, createCategory, deleteBrand, deleteCategory } from "../actions";
import { ensureSeed } from "@/lib/seed";

export const dynamic = "force-dynamic";

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  await ensureSeed();
  const sp = await searchParams;

  const catRows = await db
    .select({
      id: categories.id,
      name: categories.name,
      description: categories.description,
      isActive: categories.isActive,
      productCount: sql<string>`(select count(*) from products p where p.category_id = ${categories.id})`,
    })
    .from(categories)
    .orderBy(categories.name);

  const brandRows = await db
    .select({
      id: brands.id,
      name: brands.name,
      isActive: brands.isActive,
      productCount: sql<string>`(select count(*) from products p where p.brand_id = ${brands.id})`,
    })
    .from(brands)
    .orderBy(brands.name);

  return (
    <div>
      <PageHeader title="Categories & Brands" subtitle="Organise your catalogue so products are easy to find." />
      <Flash saved={sp.saved} error={sp.error} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Product Categories">
          <form action={createCategory} className="p-5 border-b border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <Field label="Category name" required>
              <input name="name" className={inputClass} placeholder="e.g. Blockboard" required />
            </Field>
            <Field label="Description">
              <input name="description" className={inputClass} placeholder="Optional" />
            </Field>
            <button className="inline-flex h-[38px] items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700">
              <Plus size={16} /> Add
            </button>
          </form>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-2 text-left font-semibold">Category</th>
                <th className="px-5 py-2 text-right font-semibold">Products</th>
                <th className="px-5 py-2 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {catRows.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/70">
                  <td className="px-5 py-2.5">
                    <div className="font-medium text-slate-800 flex items-center gap-2">
                      {c.name}
                      {!c.isActive && <Badge tone="slate">Inactive</Badge>}
                    </div>
                    {c.description && <div className="text-xs text-slate-500">{c.description}</div>}
                  </td>
                  <td className="px-5 py-2.5 text-right">{c.productCount}</td>
                  <td className="px-5 py-2.5 text-right">
                    <form action={deleteCategory}>
                      <input type="hidden" name="id" value={c.id} />
                      <button className="text-xs font-medium text-red-600 hover:underline">Remove</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="Brands">
          <form action={createBrand} className="p-5 border-b border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <Field label="Brand name" required className="sm:col-span-2">
              <input name="name" className={inputClass} placeholder="e.g. Greenply" required />
            </Field>
            <button className="inline-flex h-[38px] items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700">
              <Plus size={16} /> Add
            </button>
          </form>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-2 text-left font-semibold">Brand</th>
                <th className="px-5 py-2 text-right font-semibold">Products</th>
                <th className="px-5 py-2 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {brandRows.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50/70">
                  <td className="px-5 py-2.5 font-medium text-slate-800 flex items-center gap-2">
                    {b.name}
                    {!b.isActive && <Badge tone="slate">Inactive</Badge>}
                  </td>
                  <td className="px-5 py-2.5 text-right">{b.productCount}</td>
                  <td className="px-5 py-2.5 text-right">
                    <form action={deleteBrand}>
                      <input type="hidden" name="id" value={b.id} />
                      <button className="text-xs font-medium text-red-600 hover:underline">Remove</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
