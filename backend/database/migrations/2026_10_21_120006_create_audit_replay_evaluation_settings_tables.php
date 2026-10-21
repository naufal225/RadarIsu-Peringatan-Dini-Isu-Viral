<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Append-only.
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained();
            $table->string('action', 60)->index();
            $table->string('object_type', 60)->nullable();
            $table->unsignedBigInteger('object_id')->nullable();
            $table->jsonb('detail')->default('{}');
            $table->string('ip_address', 45);
            $table->string('user_agent', 255)->nullable();
            $table->timestampTz('created_at')->useCurrent()->index();
        });

        Schema::create('replay_scenarios', function (Blueprint $table) {
            $table->id();
            $table->string('name', 150);
            $table->text('description')->nullable();
            $table->integer('total_rows')->default(0);
            $table->integer('incident_start_offset_seconds')->nullable();
            $table->integer('default_speed_factor')->default(60);
            $table->string('status', 10)->default('idle');
            $table->timestampTz('started_at')->nullable();
            $table->timestampTz('virtual_anchor_at')->nullable();
            $table->foreignId('created_by')->constrained('users');
            $table->timestampsTz();
        });
        DB::statement("ALTER TABLE replay_scenarios ADD CONSTRAINT replay_scenarios_status_chk CHECK (status IN ('idle','running','finished','stopped'))");

        Schema::create('replay_rows', function (Blueprint $table) {
            $table->id();
            $table->foreignId('scenario_id')->constrained('replay_scenarios')->cascadeOnDelete();
            $table->integer('offset_seconds');
            $table->string('phase', 10);
            $table->text('text');
            $table->string('account_handle', 190);
            $table->string('account_display_name', 190)->nullable();
            $table->timestampTz('account_created_at')->nullable();
            $table->string('label_manual', 10)->nullable();
            $table->timestampsTz();
            $table->index(['scenario_id', 'offset_seconds']);
        });
        DB::statement("ALTER TABLE replay_rows ADD CONSTRAINT replay_rows_phase_chk CHECK (phase IN ('baseline','incident'))");
        DB::statement("ALTER TABLE replay_rows ADD CONSTRAINT replay_rows_label_manual_chk CHECK (label_manual IN ('organic','anomalous'))");

        Schema::create('evaluation_runs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('scenario_id')->nullable()->constrained('replay_scenarios');
            $table->foreignId('run_by')->constrained('users');
            $table->integer('labeled_posts')->default(0);
            $table->integer('tp')->default(0);
            $table->integer('fp')->default(0);
            $table->integer('fn')->default(0);
            $table->decimal('precision', 5, 4)->nullable();
            $table->decimal('recall', 5, 4)->nullable();
            $table->decimal('f1', 5, 4)->nullable();
            $table->integer('detection_latency_seconds')->nullable();
            $table->text('notes')->nullable();
            $table->timestampsTz();
        });

        Schema::create('settings', function (Blueprint $table) {
            $table->string('key', 100)->primary();
            $table->jsonb('value');
            $table->foreignId('updated_by')->nullable()->constrained('users');
            $table->timestampTz('updated_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('settings');
        Schema::dropIfExists('evaluation_runs');
        Schema::dropIfExists('replay_rows');
        Schema::dropIfExists('replay_scenarios');
        Schema::dropIfExists('audit_logs');
    }
};
