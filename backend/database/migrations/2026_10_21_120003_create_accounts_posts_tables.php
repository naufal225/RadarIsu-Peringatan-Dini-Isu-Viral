<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('accounts', function (Blueprint $table) {
            $table->id();
            $table->string('source_type', 10);
            $table->string('handle', 190);
            $table->string('display_name', 190)->nullable();
            $table->timestampTz('platform_created_at')->nullable();
            $table->timestampTz('first_seen_at');
            $table->timestampsTz();
            $table->unique(['source_type', 'handle']);
        });
        DB::statement('CREATE INDEX accounts_handle_trgm_idx ON accounts USING GIN (handle gin_trgm_ops)');
        DB::statement('CREATE INDEX accounts_display_name_trgm_idx ON accounts USING GIN (display_name gin_trgm_ops)');

        Schema::create('official_accounts', function (Blueprint $table) {
            $table->id();
            $table->string('handle', 190)->unique();
            $table->string('display_name', 190);
            $table->string('note', 255)->nullable();
            $table->foreignId('created_by')->constrained('users');
            $table->timestampsTz();
        });

        Schema::create('posts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('source_id')->constrained();
            $table->foreignId('raw_item_id')->nullable()->constrained();
            $table->foreignId('account_id')->index()->constrained();
            $table->string('external_id', 190)->nullable();
            $table->text('text');
            $table->text('text_norm');
            $table->timestampTz('posted_at')->index();
            $table->string('sentiment', 10)->nullable();
            $table->decimal('sentiment_score', 4, 3)->nullable();
            $table->boolean('is_simulated')->default(false);
            $table->string('label_manual', 10)->nullable();
            $table->timestampsTz();
        });
        DB::statement('CREATE UNIQUE INDEX posts_source_external_uq ON posts (source_id, external_id) WHERE external_id IS NOT NULL');
        DB::statement('CREATE INDEX posts_text_norm_trgm_idx ON posts USING GIN (text_norm gin_trgm_ops)');
        DB::statement("ALTER TABLE posts ADD CONSTRAINT posts_sentiment_chk CHECK (sentiment IN ('positive','negative','neutral'))");
        DB::statement("ALTER TABLE posts ADD CONSTRAINT posts_label_manual_chk CHECK (label_manual IN ('organic','anomalous'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('posts');
        Schema::dropIfExists('official_accounts');
        Schema::dropIfExists('accounts');
    }
};
