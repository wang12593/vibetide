ALTER TABLE "benchmark_accounts" DROP CONSTRAINT "uq_benchmark_acc_global";--> statement-breakpoint
DROP INDEX "idx_benchmark_acc_org";--> statement-breakpoint
CREATE UNIQUE INDEX "uq_benchmark_acc_global" ON "benchmark_accounts" USING btree ("platform","handle","organization_id");--> statement-breakpoint
CREATE INDEX "idx_benchmark_acc_org" ON "benchmark_accounts" USING btree ("organization_id") WHERE "benchmark_accounts"."organization_id" IS NOT NULL;