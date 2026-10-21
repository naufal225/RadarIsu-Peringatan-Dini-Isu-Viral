<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * PRD §13: audit_logs and alert_actions accept INSERT only. Enforced in the database so
 * neither application bugs nor ad-hoc queries can rewrite the decision trail.
 */
return new class extends Migration
{
    private const TABLES = ['audit_logs', 'alert_actions'];

    public function up(): void
    {
        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION radarisu_reject_modification() RETURNS trigger AS $$
            BEGIN
                RAISE EXCEPTION '% is append-only: % is not allowed', TG_TABLE_NAME, TG_OP
                    USING ERRCODE = 'insufficient_privilege';
            END;
            $$ LANGUAGE plpgsql;
        SQL);

        foreach (self::TABLES as $table) {
            DB::unprepared("CREATE TRIGGER {$table}_append_only
                BEFORE UPDATE OR DELETE ON {$table}
                FOR EACH ROW EXECUTE FUNCTION radarisu_reject_modification()");
            DB::unprepared("CREATE TRIGGER {$table}_no_truncate
                BEFORE TRUNCATE ON {$table}
                FOR EACH STATEMENT EXECUTE FUNCTION radarisu_reject_modification()");
        }
    }

    public function down(): void
    {
        foreach (self::TABLES as $table) {
            DB::unprepared("DROP TRIGGER IF EXISTS {$table}_append_only ON {$table}");
            DB::unprepared("DROP TRIGGER IF EXISTS {$table}_no_truncate ON {$table}");
        }
        DB::unprepared('DROP FUNCTION IF EXISTS radarisu_reject_modification()');
    }
};
