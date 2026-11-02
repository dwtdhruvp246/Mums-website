import { z } from "zod";
import { type Workspace, customerSchema, categorySchema, menuSchema, menuVariationSchema, orderSchema, paymentSchema, settingsSchema, STATUSES, orderTotal } from "./domain";

const id=z.string().uuid(),createdAt=z.string().datetime();
const schema=z.object({
  settings:settingsSchema,
  customers:z.array(customerSchema.extend({id,createdAt})),
  categories:z.array(categorySchema.extend({id})),
  menuItems:z.array(menuSchema.and(z.object({id,createdAt,variations:z.array(menuVariationSchema.and(z.object({id}))).optional()}))),
  orders:z.array(orderSchema.and(z.object({id,customerId:id,orderNumber:z.string().min(1).max(160),status:z.enum(STATUSES),totalCents:z.number().int().min(0).max(10_000_000_000),createdAt}))),
  payments:z.array(paymentSchema.extend({id,createdAt}))
});

export function parseWorkspace(value:unknown):Workspace{
  const result=schema.safeParse(value);
  const invalid=()=>new Error("The saved workspace could not be read safely. Contact your administrator; your records have not been replaced.");
  if(!result.success)throw invalid();
  const w=result.data;
  for(const records of [w.customers,w.categories,w.menuItems,w.orders,w.payments])if(new Set(records.map(r=>r.id)).size!==records.length)throw invalid();
  const customers=new Set(w.customers.map(c=>c.id)),categories=new Set(w.categories.map(c=>c.id)),orders=new Set(w.orders.map(o=>o.id));
  if(w.orders.some(o=>!customers.has(o.customerId)||(o.categoryId&&!categories.has(o.categoryId))||orderTotal(o)!==o.totalCents))throw invalid();
  if(w.payments.some(p=>!orders.has(p.orderId)))throw invalid();
  return w;
}
