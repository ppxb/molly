DROP INDEX "uploaded_files_file_hash_unique";--> statement-breakpoint
DROP INDEX "multipart_upload_sessions_fingerprint_unique";--> statement-breakpoint
ALTER TABLE "uploaded_files" ADD COLUMN "folder_path" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "single_upload_sessions" ADD COLUMN "folder_path" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "multipart_upload_sessions" ADD COLUMN "folder_path" text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE TABLE "upload_folders" (
	"id" text PRIMARY KEY NOT NULL,
	"folder_name" text NOT NULL,
	"folder_path" text NOT NULL,
	"parent_path" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "upload_folders_folder_path_unique" ON "upload_folders" USING btree ("folder_path");--> statement-breakpoint
CREATE UNIQUE INDEX "upload_folders_parent_path_name_unique" ON "upload_folders" USING btree ("parent_path","folder_name");--> statement-breakpoint
CREATE INDEX "upload_folders_parent_path_idx" ON "upload_folders" USING btree ("parent_path");--> statement-breakpoint
CREATE INDEX "upload_folders_created_at_idx" ON "upload_folders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "uploaded_files_file_hash_idx" ON "uploaded_files" USING btree ("file_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "uploaded_files_folder_path_file_name_unique" ON "uploaded_files" USING btree ("folder_path","file_name");--> statement-breakpoint
CREATE INDEX "uploaded_files_folder_path_file_name_idx" ON "uploaded_files" USING btree ("folder_path","file_name");--> statement-breakpoint
CREATE UNIQUE INDEX "multipart_upload_sessions_fingerprint_unique" ON "multipart_upload_sessions" USING btree ("fingerprint_hash","file_size","folder_path");
