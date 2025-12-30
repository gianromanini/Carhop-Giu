CREATE TABLE "bookings" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_code" text NOT NULL,
	"date" text NOT NULL,
	"status" text DEFAULT 'Active' NOT NULL,
	"car_name" text NOT NULL,
	"vehicle_id" integer,
	"location" text NOT NULL,
	"start_date" text NOT NULL,
	"start_time" text NOT NULL,
	"return_date" text NOT NULL,
	"return_time" text NOT NULL,
	"days" integer NOT NULL,
	"total" real NOT NULL,
	"image" text,
	"driver" jsonb NOT NULL,
	"payment_raw" jsonb,
	"payment_method" text,
	"details" jsonb NOT NULL,
	"car_rental_agreement" jsonb,
	"check_in_status" text DEFAULT 'pending' NOT NULL,
	"check_out_status" text DEFAULT 'pending' NOT NULL,
	"check_in_data" jsonb,
	"check_out_data" jsonb,
	"extension_requests" jsonb DEFAULT '[]'::jsonb,
	"messages" jsonb DEFAULT '[]'::jsonb,
	"extra_payments" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "bookings_booking_code_unique" UNIQUE("booking_code")
);
--> statement-breakpoint
CREATE TABLE "hosts" (
	"id" serial PRIMARY KEY NOT NULL,
	"first_name" varchar NOT NULL,
	"last_name" varchar NOT NULL,
	"email" varchar NOT NULL,
	"phone" varchar NOT NULL,
	"address" varchar,
	"city" varchar,
	"state" varchar,
	"zip_code" varchar,
	"license_number" varchar NOT NULL,
	"license_front_image" text,
	"license_back_image" text,
	"proof_of_residence_image" text NOT NULL,
	"social_security_number" varchar,
	"username" varchar NOT NULL,
	"password_hash" varchar NOT NULL,
	"agreement_accepted" boolean DEFAULT false NOT NULL,
	"agreement_accepted_at" timestamp,
	"status" varchar DEFAULT 'active' NOT NULL,
	"pickup_locations" text[] DEFAULT '{}',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "hosts_email_unique" UNIQUE("email"),
	CONSTRAINT "hosts_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "ratings" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" integer NOT NULL,
	"vehicle_id" integer NOT NULL,
	"client_name" varchar NOT NULL,
	"client_email" varchar NOT NULL,
	"host_id" varchar,
	"stars" integer NOT NULL,
	"comment" text,
	"host_response" text,
	"host_response_at" timestamp,
	"host_stars_to_client" integer,
	"host_comment_to_client" text,
	"host_rated_client_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	CONSTRAINT "settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "support_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"sender_type" varchar NOT NULL,
	"sender_id" varchar NOT NULL,
	"sender_name" varchar NOT NULL,
	"sender_identifier" varchar NOT NULL,
	"sender_email" varchar,
	"subject" varchar DEFAULT 'Duvidas' NOT NULL,
	"text" text NOT NULL,
	"images" text[] DEFAULT '{}',
	"read" boolean DEFAULT false,
	"admin_reply" text,
	"admin_replied_at" timestamp,
	"is_finished" boolean DEFAULT false,
	"finished_by" varchar,
	"finished_at" timestamp,
	"chat_started_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"phone" varchar,
	"city" varchar,
	"state" varchar,
	"password_hash" varchar,
	"profile_image_url" varchar,
	"is_admin" boolean DEFAULT false,
	"is_host" boolean DEFAULT false,
	"pickup_locations" text[] DEFAULT '{}',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" serial PRIMARY KEY NOT NULL,
	"model" text NOT NULL,
	"category" text NOT NULL,
	"price" real NOT NULL,
	"fuel" text DEFAULT 'Gasoline' NOT NULL,
	"seats" integer DEFAULT 5 NOT NULL,
	"transmission" text DEFAULT 'Automatic' NOT NULL,
	"drive_type" text DEFAULT 'AWD' NOT NULL,
	"images" text[] DEFAULT '{}' NOT NULL,
	"consumption" text,
	"is_price_match" boolean DEFAULT false,
	"is_awd" boolean DEFAULT false,
	"has_carplay" boolean DEFAULT false,
	"has_bluetooth" boolean DEFAULT false,
	"has_reverse_camera" boolean DEFAULT false,
	"has_heated_seats" boolean DEFAULT false,
	"has_heated_steering" boolean DEFAULT false,
	"has_electric_seats" boolean DEFAULT false,
	"has_paddle_shifters" boolean DEFAULT false,
	"has_keyless_entry" boolean DEFAULT false,
	"has_blind_spot_warning" boolean DEFAULT false,
	"has_drive_assist" boolean DEFAULT false,
	"has_usb_charger" boolean DEFAULT false,
	"host_id" varchar,
	"commission" integer DEFAULT 10,
	"deductible" integer DEFAULT 1000,
	"available_locations" text[] DEFAULT '{}',
	"delivery_address" text DEFAULT '',
	"is_delivery_enabled" boolean DEFAULT false,
	"max_delivery_distance" integer DEFAULT 50,
	"min_delivery_fee_miles" integer DEFAULT 5,
	"min_delivery_fee" real DEFAULT 15,
	"delivery_price_per_mile" real DEFAULT 2.5,
	"min_delivery_hours" integer DEFAULT 6,
	"location_lat" real,
	"location_lon" real,
	"pricing" jsonb,
	"expenses" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");