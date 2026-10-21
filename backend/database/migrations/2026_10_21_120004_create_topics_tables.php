<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('topics', function (Blueprint $table) {
            $table->id();
            $table->string('name', 150);
            $table->string('category', 15);
            $table->jsonb('keywords')->default('[]');
            $table->string('sensitivity', 10)->default('medium');
            $table->boolean('is_template')->default(false);
            $table->boolean('is_active')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users');
            $table->timestampsTz();
        });
        DB::statement("ALTER TABLE topics ADD CONSTRAINT topics_category_chk CHECK (category IN ('institution','impersonation','opsec','general'))");
        DB::statement("ALTER TABLE topics ADD CONSTRAINT topics_sensitivity_chk CHECK (sensitivity IN ('low','medium','high'))");

        Schema::create('topic_matches', function (Blueprint $table) {
            $table->foreignId('post_id')->constrained()->cascadeOnDelete();
            $table->foreignId('topic_id')->index()->constrained()->cascadeOnDelete();
            $table->primary(['post_id', 'topic_id']);
        });

        Schema::create('metrics_hourly', function (Blueprint $table) {
            $table->id();
            $table->foreignId('topic_id')->constrained()->cascadeOnDelete();
            $table->timestampTz('hour');
            $table->integer('volume')->default(0);
            $table->integer('positive_count')->default(0);
            $table->integer('negative_count')->default(0);
            $table->integer('neutral_count')->default(0);
            $table->integer('unique_accounts')->default(0);
            $table->integer('anomalous_accounts')->default(0);
            $table->integer('source_count')->default(0);
            $table->timestampsTz();
            $table->unique(['topic_id', 'hour']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('metrics_hourly');
        Schema::dropIfExists('topic_matches');
        Schema::dropIfExists('topics');
    }
};
