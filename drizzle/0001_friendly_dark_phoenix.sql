DROP INDEX "multipart_upload_sessions_fingerprint_unique";--> statement-breakpoint
ALTER TABLE "multipart_upload_sessions" ALTER COLUMN "file_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "single_upload_sessions" ALTER COLUMN "file_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "multipart_upload_sessions" ADD COLUMN "file_sample_hash" text;--> statement-breakpoint
ALTER TABLE "multipart_upload_sessions" ADD COLUMN "fingerprint_hash" text;--> statement-breakpoint
ALTER TABLE "single_upload_sessions" ADD COLUMN "file_sample_hash" text;--> statement-breakpoint
ALTER TABLE "uploaded_files" ADD COLUMN "file_sample_hash" text;--> statement-breakpoint
UPDATE "multipart_upload_sessions" SET "file_sample_hash" = "file_hash" WHERE "file_sample_hash" IS NULL;--> statement-breakpoint
UPDATE "multipart_upload_sessions" SET "fingerprint_hash" = "file_hash" WHERE "fingerprint_hash" IS NULL;--> statement-breakpoint
UPDATE "single_upload_sessions" SET "file_sample_hash" = "file_hash" WHERE "file_sample_hash" IS NULL;--> statement-breakpoint
UPDATE "uploaded_files" SET "file_sample_hash" = "file_hash" WHERE "file_sample_hash" IS NULL;--> statement-breakpoint
ALTER TABLE "multipart_upload_sessions" ALTER COLUMN "file_sample_hash" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "multipart_upload_sessions" ALTER COLUMN "fingerprint_hash" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "single_upload_sessions" ALTER COLUMN "file_sample_hash" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "uploaded_files" ALTER COLUMN "file_sample_hash" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "uploaded_files_sample_hash_size_idx" ON "uploaded_files" USING btree ("file_sample_hash","file_size");--> statement-breakpoint
CREATE UNIQUE INDEX "multipart_upload_sessions_fingerprint_unique" ON "multipart_upload_sessions" USING btree ("fingerprint_hash","file_size");
