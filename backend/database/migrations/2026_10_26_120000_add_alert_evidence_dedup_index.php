<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Detectors run every minute and re-attach evidence to the open alert (PRD §10.9). The same post or
     * account must not be attached twice for the same reason, and the database enforces it so two
     * overlapping runs cannot race past an application-side check. NULL ids are folded to 0 because
     * Postgres treats NULLs as distinct in a unique index.
     */
    public function up(): void
    {
        DB::statement('CREATE UNIQUE INDEX alert_evidence_dedup_uq
            ON alert_evidence (alert_id, reason, COALESCE(post_id, 0), COALESCE(account_id, 0))');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS alert_evidence_dedup_uq');
    }
};
