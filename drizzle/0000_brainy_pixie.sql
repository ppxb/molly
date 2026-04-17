CREATE TABLE "multipart_upload_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"upload_id" text NOT NULL,
	"object_key" text NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"file_size" bigint NOT NULL,
	"file_hash" text NOT NULL,
	"chunk_size" integer NOT NULL,
	"total_parts" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "multipart_uploaded_parts" (
	"session_id" text NOT NULL,
	"part_number" integer NOT NULL,
	"size" bigint NOT NULL,
	"etag" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "multipart_uploaded_parts_pk" PRIMARY KEY("session_id","part_number")
);
--> statement-breakpoint
CREATE TABLE "single_upload_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"object_key" text NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"file_size" bigint NOT NULL,
	"file_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uploaded_files" (
	"id" text PRIMARY KEY NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"file_size" bigint NOT NULL,
	"file_hash" text NOT NULL,
	"object_key" text NOT NULL,
	"bucket" text NOT NULL,
	"strategy" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "multipart_uploaded_parts" ADD CONSTRAINT "multipart_uploaded_parts_session_id_multipart_upload_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."multipart_upload_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "multipart_upload_sessions_fingerprint_unique" ON "multipart_upload_sessions" USING btree ("file_hash","file_size");--> statement-breakpoint
CREATE INDEX "multipart_upload_sessions_updated_at_idx" ON "multipart_upload_sessions" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "multipart_uploaded_parts_session_idx" ON "multipart_uploaded_parts" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "single_upload_sessions_created_at_idx" ON "single_upload_sessions" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uploaded_files_file_hash_unique" ON "uploaded_files" USING btree ("file_hash");--> statement-breakpoint
CREATE INDEX "uploaded_files_created_at_idx" ON "uploaded_files" USING btree ("created_at");