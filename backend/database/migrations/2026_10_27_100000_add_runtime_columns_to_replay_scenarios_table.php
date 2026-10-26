<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Run state of a replay (PRD §10.10): which source the rows go to, how fast, how far, and a heartbeat so a
 * killed worker cannot leave a scenario "running" for good. The partial unique index lets only one
 * scenario run at a time, because they all share the single data clock.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('replay_scenarios', function (Blueprint $table) {
            $table->foreignId('source_id')->nullable()->after('created_by')->constrained('sources')->nullOnDelete();
            $table->unsignedInteger('speed_factor')->nullable()->after('default_speed_factor');
            $table->unsignedInteger('run_number')->default(0)->after('speed_factor');
            $table->unsignedInteger('progress_rows')->default(0)->after('run_number');
            $table->timestampTz('heartbeat_at')->nullable()->after('virtual_anchor_at');
            $table->timestampTz('finished_at')->nullable()->after('heartbeat_at');
            $table->text('error')->nullable()->after('finished_at');
        });

        DB::statement("CREATE UNIQUE INDEX replay_scenarios_one_running_uq ON replay_scenarios ((1)) WHERE status = 'running'");
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS replay_scenarios_one_running_uq');

        Schema::table('replay_scenarios', function (Blueprint $table) {
            $table->dropConstrainedForeignId('source_id');
            $table->dropColumn(['speed_factor', 'run_number', 'progress_rows', 'heartbeat_at', 'finished_at', 'error']);
        });
    }
};
