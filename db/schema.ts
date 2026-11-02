import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const settings = sqliteTable("business_settings", {
  ownerId: text("owner_id").primaryKey(), businessName: text("business_name").notNull(), currency: text("currency").notNull(),
  phone: text("phone").notNull().default(""), address: text("address").notNull().default(""),
});
export const customers = sqliteTable("customers", {
  id: text("id").primaryKey(), ownerId: text("owner_id").notNull(), name: text("name").notNull(), phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""), address: text("address").notNull().default(""), notes: text("notes").notNull().default(""), createdAt: text("created_at").notNull(),
}, t => [index("customers_owner_idx").on(t.ownerId)]);
export const menuItems = sqliteTable("menu_items", {
  id: text("id").primaryKey(), ownerId: text("owner_id").notNull(), name: text("name").notNull(), category: text("category").notNull(),
  priceCents: integer("price_cents").notNull(), unit: text("unit").notNull(), description: text("description").notNull().default(""),
  active: integer("active", { mode: "boolean" }).notNull().default(true), createdAt: text("created_at").notNull(),
}, t => [index("menu_owner_idx").on(t.ownerId)]);
export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(), ownerId: text("owner_id").notNull(), orderNumber: text("order_number").notNull(), customerId: text("customer_id").notNull(),
  date: text("fulfilment_date").notNull(), time: text("fulfilment_time").notNull(), fulfilment: text("fulfilment").notNull(), address: text("address").notNull().default(""),
  occasion: text("occasion").notNull().default(""), notes: text("notes").notNull().default(""), status: text("status").notNull(), itemsJson: text("items_json").notNull(),
  discountCents: integer("discount_cents").notNull().default(0), deliveryFeeCents: integer("delivery_fee_cents").notNull().default(0), totalCents: integer("total_cents").notNull(), createdAt: text("created_at").notNull(),
}, t => [index("orders_owner_date_idx").on(t.ownerId,t.date),index("orders_customer_idx").on(t.ownerId,t.customerId)]);
export const payments = sqliteTable("payments", {
  id: text("id").primaryKey(), ownerId: text("owner_id").notNull(), orderId: text("order_id").notNull(), amountCents: integer("amount_cents").notNull(),
  method: text("method").notNull(), date: text("paid_on").notNull(), note: text("note").notNull().default(""), createdAt: text("created_at").notNull(),
}, t => [index("payments_owner_order_idx").on(t.ownerId,t.orderId)]);
