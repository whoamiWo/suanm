CREATE TABLE "billing_accounts" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"balance_micros" bigint DEFAULT 0 NOT NULL,
	"deduct_order" text DEFAULT 'subscription' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"amount_micros" bigint NOT NULL,
	"wallet_micros" bigint DEFAULT 0 NOT NULL,
	"subscription_parts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"idempotency_key" text,
	"model_key" text,
	"usage" jsonb,
	"source" text DEFAULT '' NOT NULL,
	"reference_type" text,
	"reference_id" text,
	"description" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trade_no" text NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"plan_id" uuid,
	"credit_micros" bigint,
	"pay_amount" numeric(12, 2) NOT NULL,
	"pay_currency" text DEFAULT 'CNY' NOT NULL,
	"provider" text DEFAULT 'epay' NOT NULL,
	"pay_method" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"provider_trade_no" text,
	"provider_payload" jsonb,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "redemption_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"kind" text NOT NULL,
	"amount_micros" bigint,
	"plan_id" uuid,
	"status" text DEFAULT 'unused' NOT NULL,
	"used_by" uuid,
	"used_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"batch_note" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_plan_limits" (
	"plan_id" uuid NOT NULL,
	"period" text NOT NULL,
	"allowance_micros" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"subtitle" text DEFAULT '' NOT NULL,
	"features" text DEFAULT '{}'::text[] NOT NULL,
	"price_cny" numeric(10, 2) DEFAULT '0' NOT NULL,
	"duration_unit" text DEFAULT 'month' NOT NULL,
	"duration_value" integer DEFAULT 1 NOT NULL,
	"max_per_user" integer,
	"purchasable" integer DEFAULT 1 NOT NULL,
	"enabled" integer DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_subscription_limits" (
	"subscription_id" uuid NOT NULL,
	"period" text NOT NULL,
	"allowance_micros" bigint NOT NULL,
	"used_micros" bigint DEFAULT 0 NOT NULL,
	"next_reset_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plan_id" uuid,
	"title" text NOT NULL,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"source" text NOT NULL,
	"order_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "birth_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"calendar_type" text DEFAULT 'solar' NOT NULL,
	"birth_year" integer NOT NULL,
	"birth_month" integer NOT NULL,
	"birth_day" integer NOT NULL,
	"birth_hour" integer,
	"birth_minute" integer,
	"gender" text NOT NULL,
	"is_leap_month" integer DEFAULT 0 NOT NULL,
	"birth_place" text,
	"longitude_micros" integer,
	"timezone" text DEFAULT 'Asia/Shanghai' NOT NULL,
	"day_boundary" text DEFAULT 'midnight' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chart_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"method" text NOT NULL,
	"input_hash" text NOT NULL,
	"input" jsonb NOT NULL,
	"canonical_json" jsonb NOT NULL,
	"text_output" text NOT NULL,
	"rules" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"chart_id" uuid,
	"tier" text DEFAULT 'summary' NOT NULL,
	"model" text,
	"prompt_version" text,
	"content_md" text NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"cost_micros" bigint,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemption_codes" ADD CONSTRAINT "redemption_codes_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_plan_limits" ADD CONSTRAINT "subscription_plan_limits_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscription_limits" ADD CONSTRAINT "user_subscription_limits_subscription_id_user_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."user_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "billing_ledger_idempotency_key_uq" ON "billing_ledger" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "billing_ledger_user_idx" ON "billing_ledger" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_orders_trade_no_uq" ON "payment_orders" USING btree ("trade_no");--> statement-breakpoint
CREATE INDEX "payment_orders_user_idx" ON "payment_orders" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "redemption_codes_code_uq" ON "redemption_codes" USING btree ("code");--> statement-breakpoint
CREATE INDEX "redemption_codes_status_idx" ON "redemption_codes" USING btree ("status","kind");--> statement-breakpoint
CREATE INDEX "subscription_plan_limits_plan_idx" ON "subscription_plan_limits" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "user_subscription_limits_sub_idx" ON "user_subscription_limits" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "user_subscriptions_user_idx" ON "user_subscriptions" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "user_subscriptions_ends_idx" ON "user_subscriptions" USING btree ("ends_at");--> statement-breakpoint
CREATE INDEX "birth_profiles_user_idx" ON "birth_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chart_results_method_input_uq" ON "chart_results" USING btree ("method","input_hash");--> statement-breakpoint
CREATE INDEX "chart_results_user_idx" ON "chart_results" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "reports_user_idx" ON "reports" USING btree ("user_id","created_at");