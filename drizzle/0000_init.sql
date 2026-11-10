CREATE TYPE "public"."action_status" AS ENUM('PROPOSED', 'CONFIRMED', 'DONE', 'FAILED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."sale_status" AS ENUM('DRAFT', 'PAID', 'INVOICED', 'REFUNDED');--> statement-breakpoint
CREATE TYPE "public"."shelf_kind" AS ENUM('OPEN', 'CLOSE');--> statement-breakpoint
CREATE TABLE "agent_action" (
	"id" text PRIMARY KEY NOT NULL,
	"stall_id" text NOT NULL,
	"tool" text NOT NULL,
	"args_json" jsonb NOT NULL,
	"summary" text NOT NULL,
	"status" "action_status" DEFAULT 'PROPOSED' NOT NULL,
	"result_json" jsonb,
	"paypal_debug_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact" (
	"id" text PRIMARY KEY NOT NULL,
	"stall_id" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "photo" (
	"id" text PRIMARY KEY NOT NULL,
	"stall_id" text,
	"mime" text NOT NULL,
	"data_base64" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product" (
	"id" text PRIMARY KEY NOT NULL,
	"stall_id" text NOT NULL,
	"name" text NOT NULL,
	"unit" text NOT NULL,
	"price_cents" integer NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"reference_image_url" text,
	"low_stock_at" integer DEFAULT 2 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale_item" (
	"id" text PRIMARY KEY NOT NULL,
	"sale_id" text NOT NULL,
	"product_id" text NOT NULL,
	"name" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"ai_confidence" real,
	"edited_by_customer" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale" (
	"id" text PRIMARY KEY NOT NULL,
	"stall_id" text NOT NULL,
	"status" "sale_status" DEFAULT 'DRAFT' NOT NULL,
	"total_cents" integer NOT NULL,
	"tip_cents" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"source" text DEFAULT 'STALL' NOT NULL,
	"customer_email" text,
	"paypal_order_id" text,
	"paypal_capture_id" text,
	"paypal_invoice_id" text,
	"paypal_refund_id" text,
	"photo_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "shelf_count_item" (
	"id" text PRIMARY KEY NOT NULL,
	"shelf_count_id" text NOT NULL,
	"product_id" text NOT NULL,
	"units" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shelf_count" (
	"id" text PRIMARY KEY NOT NULL,
	"stall_id" text NOT NULL,
	"taken_at" timestamp with time zone DEFAULT now() NOT NULL,
	"kind" "shelf_kind" NOT NULL,
	"photo_id" text
);
--> statement-breakpoint
CREATE TABLE "stall" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"owner_email" text NOT NULL,
	"owner_passcode_hash" text NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"thank_you" text DEFAULT 'Thank you for being honest.' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stall_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "webhook_event" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"verified" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_action" ADD CONSTRAINT "agent_action_stall_id_stall_id_fk" FOREIGN KEY ("stall_id") REFERENCES "public"."stall"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact" ADD CONSTRAINT "contact_stall_id_stall_id_fk" FOREIGN KEY ("stall_id") REFERENCES "public"."stall"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo" ADD CONSTRAINT "photo_stall_id_stall_id_fk" FOREIGN KEY ("stall_id") REFERENCES "public"."stall"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_stall_id_stall_id_fk" FOREIGN KEY ("stall_id") REFERENCES "public"."stall"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_item" ADD CONSTRAINT "sale_item_sale_id_sale_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sale"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_item" ADD CONSTRAINT "sale_item_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale" ADD CONSTRAINT "sale_stall_id_stall_id_fk" FOREIGN KEY ("stall_id") REFERENCES "public"."stall"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shelf_count_item" ADD CONSTRAINT "shelf_count_item_shelf_count_id_shelf_count_id_fk" FOREIGN KEY ("shelf_count_id") REFERENCES "public"."shelf_count"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shelf_count_item" ADD CONSTRAINT "shelf_count_item_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shelf_count" ADD CONSTRAINT "shelf_count_stall_id_stall_id_fk" FOREIGN KEY ("stall_id") REFERENCES "public"."stall"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_action_stall_idx" ON "agent_action" USING btree ("stall_id","created_at");--> statement-breakpoint
CREATE INDEX "product_stall_idx" ON "product" USING btree ("stall_id");--> statement-breakpoint
CREATE INDEX "sale_item_sale_idx" ON "sale_item" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "sale_stall_created_idx" ON "sale" USING btree ("stall_id","created_at");--> statement-breakpoint
CREATE INDEX "sale_capture_idx" ON "sale" USING btree ("paypal_capture_id");--> statement-breakpoint
CREATE INDEX "sale_invoice_idx" ON "sale" USING btree ("paypal_invoice_id");--> statement-breakpoint
CREATE INDEX "shelf_stall_taken_idx" ON "shelf_count" USING btree ("stall_id","taken_at");