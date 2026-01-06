ALTER TABLE "bookings" ADD COLUMN "unread" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "year" integer;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "vin_number" text;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "license_plate" text;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "host_name" text;