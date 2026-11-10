import {
  pgTable,
  pgEnum,
  text,
  integer,
  boolean,
  timestamp,
  real,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const saleStatus = pgEnum("sale_status", ["DRAFT", "PAID", "INVOICED", "REFUNDED"]);
export const shelfKind = pgEnum("shelf_kind", ["OPEN", "CLOSE"]);
export const actionStatus = pgEnum("action_status", [
  "PROPOSED",
  "CONFIRMED",
  "DONE",
  "FAILED",
  "CANCELLED",
]);

export const stalls = pgTable("stall", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  ownerEmail: text("owner_email").notNull(),
  ownerPasscodeHash: text("owner_passcode_hash").notNull(),
  currency: text("currency").notNull().default("USD"),
  thankYou: text("thank_you").notNull().default("Thank you for being honest."),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const products = pgTable(
  "product",
  {
    id: text("id").primaryKey(),
    stallId: text("stall_id")
      .notNull()
      .references(() => stalls.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    unit: text("unit").notNull(),
    priceCents: integer("price_cents").notNull(),
    currency: text("currency").notNull().default("USD"),
    referenceImageUrl: text("reference_image_url"),
    lowStockAt: integer("low_stock_at").notNull().default(2),
    active: boolean("active").notNull().default(true),
    sort: integer("sort").notNull().default(0),
  },
  (t) => [index("product_stall_idx").on(t.stallId)],
);

export const sales = pgTable(
  "sale",
  {
    id: text("id").primaryKey(),
    stallId: text("stall_id")
      .notNull()
      .references(() => stalls.id, { onDelete: "cascade" }),
    status: saleStatus("status").notNull().default("DRAFT"),
    totalCents: integer("total_cents").notNull(),
    tipCents: integer("tip_cents").notNull().default(0),
    currency: text("currency").notNull().default("USD"),
    source: text("source").notNull().default("STALL"), // STALL or AGENT
    customerEmail: text("customer_email"),
    paypalOrderId: text("paypal_order_id"),
    paypalCaptureId: text("paypal_capture_id"),
    paypalInvoiceId: text("paypal_invoice_id"),
    paypalRefundId: text("paypal_refund_id"),
    photoId: text("photo_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
  },
  (t) => [
    index("sale_stall_created_idx").on(t.stallId, t.createdAt),
    index("sale_capture_idx").on(t.paypalCaptureId),
    index("sale_invoice_idx").on(t.paypalInvoiceId),
  ],
);

export const saleItems = pgTable(
  "sale_item",
  {
    id: text("id").primaryKey(),
    saleId: text("sale_id")
      .notNull()
      .references(() => sales.id, { onDelete: "cascade" }),
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
    name: text("name").notNull(), // snapshot of the product name at sale time
    quantity: integer("quantity").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    aiConfidence: real("ai_confidence"),
    editedByCustomer: boolean("edited_by_customer").notNull().default(false),
  },
  (t) => [index("sale_item_sale_idx").on(t.saleId)],
);

export const shelfCounts = pgTable(
  "shelf_count",
  {
    id: text("id").primaryKey(),
    stallId: text("stall_id")
      .notNull()
      .references(() => stalls.id, { onDelete: "cascade" }),
    takenAt: timestamp("taken_at", { withTimezone: true }).notNull().defaultNow(),
    kind: shelfKind("kind").notNull(),
    photoId: text("photo_id"),
  },
  (t) => [index("shelf_stall_taken_idx").on(t.stallId, t.takenAt)],
);

export const shelfCountItems = pgTable("shelf_count_item", {
  id: text("id").primaryKey(),
  shelfCountId: text("shelf_count_id")
    .notNull()
    .references(() => shelfCounts.id, { onDelete: "cascade" }),
  productId: text("product_id")
    .notNull()
    .references(() => products.id),
  units: integer("units").notNull(),
});

export const webhookEvents = pgTable("webhook_event", {
  id: text("id").primaryKey(), // PayPal event id
  type: text("type").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  verified: boolean("verified").notNull().default(true),
});

export const agentActions = pgTable(
  "agent_action",
  {
    id: text("id").primaryKey(),
    stallId: text("stall_id")
      .notNull()
      .references(() => stalls.id, { onDelete: "cascade" }),
    tool: text("tool").notNull(),
    argsJson: jsonb("args_json").notNull(),
    summary: text("summary").notNull(),
    status: actionStatus("status").notNull().default("PROPOSED"),
    resultJson: jsonb("result_json"),
    paypalDebugId: text("paypal_debug_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("agent_action_stall_idx").on(t.stallId, t.createdAt)],
);

export const contacts = pgTable("contact", {
  id: text("id").primaryKey(),
  stallId: text("stall_id")
    .notNull()
    .references(() => stalls.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email").notNull(),
});

// Photos are kept in Postgres so they survive redeploys on hosts with no disk.
export const photos = pgTable("photo", {
  id: text("id").primaryKey(),
  stallId: text("stall_id").references(() => stalls.id, { onDelete: "cascade" }),
  mime: text("mime").notNull(),
  dataBase64: text("data_base64").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const salesRelations = relations(sales, ({ many }) => ({ items: many(saleItems) }));
export const saleItemsRelations = relations(saleItems, ({ one }) => ({
  sale: one(sales, { fields: [saleItems.saleId], references: [sales.id] }),
}));
export const shelfCountsRelations = relations(shelfCounts, ({ many }) => ({
  items: many(shelfCountItems),
}));
export const shelfCountItemsRelations = relations(shelfCountItems, ({ one }) => ({
  shelfCount: one(shelfCounts, {
    fields: [shelfCountItems.shelfCountId],
    references: [shelfCounts.id],
  }),
}));

export type Stall = typeof stalls.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Sale = typeof sales.$inferSelect;
export type SaleItem = typeof saleItems.$inferSelect;
export type AgentAction = typeof agentActions.$inferSelect;
