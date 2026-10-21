<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sources', function (Blueprint $table) {
            $table->id();
            $table->string('type', 10);
            $table->string('name', 120);
            $table->jsonb('config')->default('{}');
            $table->integer('interval_minutes')->nullable()->default(15);
            $table->boolean('is_active')->default(true);
            $table->boolean('is_simulated')->default(false);
            $table->timestampTz('last_fetched_at')->nullable();
            $table->string('last_status', 10)->default('never');
            $table->text('last_error')->nullable();
            $table->foreignId('created_by')->constrained('users');
            $table->timestampsTz();
        });
        DB::statement("ALTER TABLE sources ADD CONSTRAINT sources_type_chk CHECK (type IN ('rss','youtube','csv','replay'))");
        DB::statement("ALTER TABLE sources ADD CONSTRAINT sources_last_status_chk CHECK (last_status IN ('never','ok','error'))");

        Schema::create('import_batches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('source_id')->constrained();
            $table->string('filename', 190);
            $table->integer('total_rows')->default(0);
            $table->integer('success_rows')->default(0);
            $table->integer('failed_rows')->default(0);
            $table->jsonb('errors')->default('[]');
            $table->foreignId('created_by')->constrained('users');
            $table->timestampsTz();
        });

        Schema::create('raw_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('source_id')->index()->constrained();
            $table->foreignId('import_batch_id')->nullable()->constrained();
            $table->string('external_id', 190)->nullable();
            $table->jsonb('payload');
            $table->char('content_hash', 64);
            $table->timestampTz('fetched_at');
            $table->timestampTz('processed_at')->nullable();
            $table->timestampsTz();
            $table->unique(['source_id', 'content_hash']);
        });
        DB::statement('CREATE INDEX raw_items_unprocessed_idx ON raw_items (id) WHERE processed_at IS NULL');
    }

    public function down(): void
    {
        Schema::dropIfExists('raw_items');
        Schema::dropIfExists('import_batches');
        Schema::dropIfExists('sources');
    }
};
