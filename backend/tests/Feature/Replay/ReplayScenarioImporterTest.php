<?php

namespace Tests\Feature\Replay;

use App\Models\ReplayRow;
use App\Models\ReplayScenario;
use App\Services\Ingest\ReplayScenarioImporter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\Concerns\BuildsReplayScenarios;
use Tests\TestCase;

class ReplayScenarioImporterTest extends TestCase
{
    use BuildsReplayScenarios;
    use RefreshDatabase;

    protected bool $seed = true;

    private function rejection(string $csv): array
    {
        try {
            $this->importScenario($csv);
        } catch (ValidationException $e) {
            return $e->errors();
        }

        $this->fail('The scenario should have been rejected.');
    }

    public function test_a_valid_script_becomes_a_scenario_with_ordered_rows(): void
    {
        $scenario = $this->importScenario($this->smallScenarioCsv());

        $this->assertSame(6, $scenario->total_rows);
        $this->assertSame('idle', $scenario->status);
        $this->assertSame(3600, $scenario->incident_start_offset_seconds, 'defaults to the first incident row');
        $this->assertSame(60, $scenario->default_speed_factor);
        $rows = $scenario->rows()->orderBy('offset_seconds');
        $this->assertSame([0, 1800, 3600, 3610, 3620, 3700], $rows->pluck('offset_seconds')->all());
        $this->assertSame(
            ['organic', 'organic', 'anomalous', 'anomalous', 'organic', 'anomalous'],
            $scenario->rows()->orderBy('offset_seconds')->pluck('label_manual')->all(),
        );
    }

    public function test_account_age_is_kept_on_the_scenario_axis(): void
    {
        $scenario = $this->importScenario($this->smallScenarioCsv());

        $row = ReplayRow::where('scenario_id', $scenario->id)->where('account_handle', '@kampanye_1')->first();
        $epoch = strtotime(ReplayScenarioImporter::VIRTUAL_EPOCH);

        // posted 3600 s into the script, by an account that is 3 days old at that moment
        $this->assertSame(3600 - 3 * 86400, $row->account_created_at->getTimestamp() - $epoch);
    }

    public function test_meta_overrides_the_defaults(): void
    {
        $scenario = $this->importScenario($this->smallScenarioCsv(), ['incident_start_offset_seconds' => 3500, 'default_speed_factor' => 600, 'description' => 'uji']);

        $this->assertSame(3500, $scenario->incident_start_offset_seconds);
        $this->assertSame(600, $scenario->default_speed_factor);
        $this->assertSame('uji', $scenario->description);
    }

    public function test_optional_columns_may_be_left_out(): void
    {
        $scenario = $this->importScenario("offset_seconds,phase,text,account_handle\n0,incident,halo,@a\n");

        $row = $scenario->rows()->first();
        $this->assertNull($row->label_manual);
        $this->assertNull($row->account_created_at);
        $this->assertNull($row->account_display_name);
    }

    public function test_a_bom_and_crlf_are_accepted(): void
    {
        $scenario = $this->importScenario("\xEF\xBB\xBFoffset_seconds,phase,text,account_handle\r\n0,incident,halo,@a\r\n");

        $this->assertSame(1, $scenario->total_rows);
    }

    public function test_file_level_problems_are_rejected(): void
    {
        $this->assertSame(['empty_file'], $this->rejection('')['file']);
        $this->assertSame(['missing_columns:text'], $this->rejection("offset_seconds,phase,account_handle\n0,incident,@a\n")['file']);
        $this->assertSame(['unknown_columns:extra'], $this->rejection("offset_seconds,phase,text,account_handle,extra\n0,incident,x,@a,1\n")['file']);
        $this->assertSame(['duplicate_columns'], $this->rejection("offset_seconds,phase,text,account_handle,text\n0,incident,x,@a,y\n")['file']);
        $this->assertSame(['invalid_encoding'], $this->rejection("offset_seconds,phase,text,account_handle\n0,incident,\xFF\xFE,@a\n")['file']);
        $this->assertSame(['no_rows'], $this->rejection("offset_seconds,phase,text,account_handle\n")['file']);
    }

    public function test_bad_rows_are_listed_with_their_line_and_nothing_is_stored(): void
    {
        $errors = $this->rejection($this->scenarioCsv([
            '0,baseline,ok,@a,,10,organic',
            'abc,baseline,ok,@a,,10,organic',
            '5,sometime,ok,@a,,10,organic',
            '6,baseline,,@a,,10,organic',
            '7,baseline,ok,,,10,organic',
            '8,baseline,ok,@a,,10,maybe',
            '9,baseline,ok,@a,,-3,organic',
            '10,baseline,ok',
            '3000000,baseline,ok,@a,,,',
        ]));

        $this->assertSame(['invalid_rows'], $errors['file']);
        $this->assertSame([
            '3:invalid_offset_seconds', '4:invalid_phase', '5:missing_text', '6:missing_account_handle',
            '7:invalid_label_manual', '8:invalid_account_age_days', '9:column_count_mismatch', '10:invalid_offset_seconds',
        ], $errors['rows']);
        $this->assertSame(0, ReplayScenario::count());
    }

    public function test_a_script_needs_incident_rows_and_a_baseline_that_ends_first(): void
    {
        $this->assertSame(['no_incident_rows'], $this->rejection($this->scenarioCsv(['0,baseline,x,@a,,,']))['file']);
        $this->assertSame(['baseline_after_incident'], $this->rejection($this->scenarioCsv([
            '100,baseline,x,@a,,,', '50,incident,y,@b,,,',
        ]))['file']);
    }

    public function test_too_many_rows_are_rejected(): void
    {
        $lines = array_fill(0, ReplayScenarioImporter::MAX_ROWS + 1, '0,incident,x,@a,,,');

        $this->assertSame(['too_many_rows'], $this->rejection($this->scenarioCsv($lines))['file']);
    }
}
