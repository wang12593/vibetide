ALTER TYPE "public"."mission_task_status" ADD VALUE 'paused' BEFORE 'completed';--> statement-breakpoint
ALTER TABLE "mission_tasks" ADD COLUMN "pause_reason" text;--> statement-breakpoint
ALTER TABLE "mission_tasks" ADD COLUMN "pending_input_fields" jsonb;--> statement-breakpoint
ALTER TABLE "mission_tasks" ADD COLUMN "user_input" jsonb;--> statement-breakpoint
ALTER TABLE "employee_memories" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "employee_memories" ADD CONSTRAINT "employee_memories_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;