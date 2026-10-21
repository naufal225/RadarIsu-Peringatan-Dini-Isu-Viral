<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('alerts', function (Blueprint $table) {
            $table->id();
            $table->string('kind', 15);
            $table->foreignId('topic_id')->nullable()->constrained();
            $table->foreignId('subject_account_id')->nullable()->constrained('accounts');
            $table->smallInteger('score');
            $table->string('severity', 10);
            $table->jsonb('score_breakdown')->default('{}');
            $table->string('status', 15)->default('new');
            $table->timestampTz('detected_at');
            $table->timestampTz('window_start');
            $table->timestampTz('window_end');
            $table->foreignId('assigned_to')->nullable()->constrained('users');
            $table->text('recommendation')->nullable();
            $table->timestampTz('escalated_at')->nullable();
            $table->timestampTz('decided_at')->nullable();
            $table->timestampTz('closed_at')->nullable();
            $table->timestampsTz();
        });
        DB::statement("ALTER TABLE alerts ADD CONSTRAINT alerts_kind_chk CHECK (kind IN ('issue','impersonation'))");
        DB::statement('ALTER TABLE alerts ADD CONSTRAINT alerts_score_chk CHECK (score BETWEEN 0 AND 100)');
        DB::statement("ALTER TABLE alerts ADD CONSTRAINT alerts_severity_chk CHECK (severity IN ('low','medium','high'))");
        DB::statement("ALTER TABLE alerts ADD CONSTRAINT alerts_status_chk CHECK (status IN ('new','reviewing','escalated','returned','approved','false_positive','closed'))");
        DB::statement("ALTER TABLE alerts ADD CONSTRAINT alerts_kind_subject_chk CHECK (
            (kind = 'issue' AND topic_id IS NOT NULL) OR
            (kind = 'impersonation' AND subject_account_id IS NOT NULL)
        )");
        DB::statement("CREATE UNIQUE INDEX alerts_open_issue_uq ON alerts (topic_id)
            WHERE kind = 'issue' AND status IN ('new','reviewing','escalated','returned')");
        DB::statement("CREATE UNIQUE INDEX alerts_open_impersonation_uq ON alerts (subject_account_id)
            WHERE kind = 'impersonation' AND status IN ('new','reviewing','escalated','returned')");
        DB::statement('CREATE INDEX alerts_status_score_idx ON alerts (status, score DESC)');

        Schema::create('alert_evidence', function (Blueprint $table) {
            $table->id();
            $table->foreignId('alert_id')->index()->constrained()->cascadeOnDelete();
            $table->foreignId('post_id')->nullable()->constrained();
            $table->foreignId('account_id')->nullable()->constrained();
            $table->string('reason', 30);
            $table->jsonb('detail')->default('{}');
            $table->timestampsTz();
        });
        DB::statement("ALTER TABLE alert_evidence ADD CONSTRAINT alert_evidence_reason_chk CHECK (reason IN ('spike_sample','similar_text','young_account','synchronized_posting','name_similarity'))");

        // Append-only.
        Schema::create('alert_actions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('alert_id')->index()->constrained();
            $table->foreignId('user_id')->nullable()->constrained();
            $table->string('action', 20);
            $table->string('from_status', 15);
            $table->string('to_status', 15)->nullable();
            $table->text('note')->nullable();
            $table->timestampTz('created_at')->useCurrent();
        });
        DB::statement("ALTER TABLE alert_actions ADD CONSTRAINT alert_actions_action_chk CHECK (action IN ('take','escalate','false_positive','close','approve','return','comment'))");

        Schema::create('briefings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('alert_id')->constrained();
            $table->foreignId('created_by')->constrained('users');
            $table->string('title', 200);
            $table->text('summary');
            $table->jsonb('content')->default('{}');
            $table->string('file_path', 255)->nullable();
            $table->timestampsTz();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('briefings');
        Schema::dropIfExists('alert_actions');
        Schema::dropIfExists('alert_evidence');
        Schema::dropIfExists('alerts');
    }
};
