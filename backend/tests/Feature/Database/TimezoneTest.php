<?php

namespace Tests\Feature\Database;

use App\Models\AuditLog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Eloquent writes timestamps without an offset. If the Postgres session zone differs from the
 * app zone (UTC), every timestamptz is silently shifted — this happened on a server set to
 * Asia/Bangkok (+7h). config/database.php pins the session to UTC.
 */
class TimezoneTest extends TestCase
{
    use RefreshDatabase;

    public function test_session_timezone_is_utc(): void
    {
        $this->assertSame('UTC', DB::selectOne('show timezone')->TimeZone);
    }

    public function test_written_timestamps_match_the_real_instant(): void
    {
        $this->freezeSecond(function ($now) {
            $log = AuditLog::create(['action' => 'auth.login', 'detail' => [], 'ip_address' => '203.0.113.1']);

            $epoch = (int) DB::selectOne('select extract(epoch from created_at)::bigint as e from audit_logs where id = ?', [$log->id])->e;

            $this->assertSame($now->getTimestamp(), $epoch);
        });
    }
}
