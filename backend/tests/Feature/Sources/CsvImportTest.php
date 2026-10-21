<?php

namespace Tests\Feature\Sources;

use App\Models\AuditLog;
use App\Models\ImportBatch;
use App\Models\RawItem;
use App\Models\Source;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * PRD v2.2 §11 POST /sources/{id}/import: CSV format, limits, row errors, duplicates.
 */
class CsvImportTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    private const HEADER = 'text,account_handle,posted_at,external_id,account_display_name,account_created_at';

    private Source $source;

    protected function setUp(): void
    {
        parent::setUp();
        $this->source = Source::factory()->create(['type' => 'csv']);
        $this->actingAsRole('admin');
    }

    private function import(string $content, ?Source $source = null, string $name = 'data.csv'): TestResponse
    {
        $source ??= $this->source;
        $file = UploadedFile::fake()->createWithContent($name, $content);

        return $this->post("/api/v1/sources/{$source->id}/import", ['file' => $file], ['Accept' => 'application/json']);
    }

    private function row(string $text, string $handle = '@akun_a', string $postedAt = '2026-10-20T08:15:00+07:00', string $rest = ',,,'): string
    {
        return '"'.str_replace('"', '""', $text).'",'.$handle.','.$postedAt.$rest;
    }

    public function test_valid_file_creates_raw_items_and_batch(): void
    {
        $csv = implode("\n", [
            self::HEADER,
            '"Komentar pertama, dengan koma",@akun_a,2026-10-20T08:15:00+07:00,yt-1,Akun A,2026-09-01T00:00:00Z',
            $this->row('Komentar kedua', '@akun_b', '2026-10-20T01:20:00Z'),
        ]);

        $response = $this->import($csv)
            ->assertCreated()
            ->assertJsonPath('data.total_rows', 2)
            ->assertJsonPath('data.success_rows', 2)
            ->assertJsonPath('data.failed_rows', 0)
            ->assertJsonPath('data.errors', []);

        $batch = ImportBatch::findOrFail($response->json('data.id'));
        $this->assertSame('data.csv', $batch->filename);
        $this->assertSame(2, RawItem::where('import_batch_id', $batch->id)->where('source_id', $this->source->id)->count());

        $item = RawItem::where('external_id', 'yt-1')->sole();
        $this->assertSame('Komentar pertama, dengan koma', $item->payload['text']);
        $this->assertSame('@akun_a', $item->payload['account_handle']);
        $this->assertSame('Akun A', $item->payload['account_display_name']);
        $this->assertSame(64, strlen($item->content_hash));
        $this->assertNull($item->processed_at);

        $log = AuditLog::where('action', 'source.import')->sole();
        $this->assertSame($this->source->id, $log->object_id);
        $this->assertSame($batch->id, $log->detail['import_batch_id']);
    }

    public function test_required_columns_only_is_accepted_and_column_order_is_free(): void
    {
        $csv = "posted_at,text,account_handle\n2026-10-20T08:15:00Z,Halo,@a\n";

        $this->import($csv)->assertCreated()->assertJsonPath('data.success_rows', 1);
        $this->assertSame('Halo', RawItem::sole()->payload['text']);
    }

    public function test_utf8_bom_is_stripped(): void
    {
        $csv = "\xEF\xBB\xBF".self::HEADER."\n".$this->row('Halo')."\n";

        $this->import($csv)->assertCreated()->assertJsonPath('data.success_rows', 1);
    }

    public function test_missing_required_column_rejects_file(): void
    {
        $this->import("text,posted_at\nHalo,2026-10-20T08:15:00Z\n")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('file');

        $this->assertSame(0, RawItem::count());
        $this->assertSame(0, ImportBatch::count());
    }

    public function test_unknown_column_rejects_file(): void
    {
        $this->import(self::HEADER.",password\n".$this->row('Halo').",x\n")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('file');
    }

    public function test_empty_file_rejects(): void
    {
        $this->import('')->assertUnprocessable()->assertJsonValidationErrors('file');
    }

    public function test_non_csv_source_rejects_import(): void
    {
        $rss = Source::factory()->create(['type' => 'rss', 'config' => ['url' => 'https://a.example/f', 'max_items' => 50], 'interval_minutes' => 15]);

        $this->import(self::HEADER."\n".$this->row('Halo'), $rss)->assertUnprocessable();
        $this->assertSame(0, RawItem::count());
    }

    public function test_file_over_10_mb_is_rejected(): void
    {
        $file = UploadedFile::fake()->create('big.csv', 10241, 'text/csv');

        $this->post("/api/v1/sources/{$this->source->id}/import", ['file' => $file], ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('file');
    }

    public function test_non_csv_file_type_is_rejected(): void
    {
        $file = UploadedFile::fake()->create('data.pdf', 10, 'application/pdf');

        $this->post("/api/v1/sources/{$this->source->id}/import", ['file' => $file], ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('file');
    }

    public function test_more_than_50000_rows_rejects_whole_file(): void
    {
        $rows = [self::HEADER];
        for ($i = 1; $i <= 50001; $i++) {
            $rows[] = "t{$i},@a,2026-10-20T08:15:00Z,,,";
        }

        $this->import(implode("\n", $rows))->assertUnprocessable()->assertJsonValidationErrors('file');

        $this->assertSame(0, RawItem::count());
        $this->assertSame(0, ImportBatch::count());
    }

    public function test_invalid_rows_are_reported_with_file_line_numbers(): void
    {
        $csv = implode("\n", [
            self::HEADER,                                                   // line 1
            $this->row('Valid'),                                            // line 2
            $this->row(''),                                                 // line 3: missing_text
            $this->row('Tanpa handle', ''),                                 // line 4: missing_account_handle
            $this->row('Waktu salah', '@a', '2026-10-20 08:15'),            // line 5: no timezone
            $this->row('Waktu kacau', '@a', 'kemarin'),                     // line 6
            $this->row('Usia akun salah', '@a', '2026-10-20T08:15:00Z', ',,,bukan-tanggal'), // line 7
            $this->row(str_repeat('x', 10001)),                             // line 8: field_too_long
            'kolom,kurang',                                                 // line 9: column_count_mismatch
        ]);

        $this->import($csv)
            ->assertCreated()
            ->assertJsonPath('data.total_rows', 8)
            ->assertJsonPath('data.success_rows', 1)
            ->assertJsonPath('data.failed_rows', 7)
            ->assertJsonPath('data.errors', [
                ['row' => 3, 'message' => 'missing_text'],
                ['row' => 4, 'message' => 'missing_account_handle'],
                ['row' => 5, 'message' => 'invalid_posted_at'],
                ['row' => 6, 'message' => 'invalid_posted_at'],
                ['row' => 7, 'message' => 'invalid_account_created_at'],
                ['row' => 8, 'message' => 'field_too_long'],
                ['row' => 9, 'message' => 'column_count_mismatch'],
            ]);

        $this->assertSame(1, RawItem::count());
    }

    public function test_line_numbers_account_for_quoted_newlines(): void
    {
        $csv = self::HEADER."\n\"Baris\nkedua\",@a,2026-10-20T08:15:00Z,,,\n".$this->row('');

        $this->import($csv)->assertJsonPath('data.errors', [['row' => 4, 'message' => 'missing_text']]);
    }

    public function test_error_list_is_capped_at_200_but_count_is_complete(): void
    {
        $rows = [self::HEADER];
        for ($i = 0; $i < 250; $i++) {
            $rows[] = $this->row('');
        }

        $response = $this->import(implode("\n", $rows))
            ->assertCreated()
            ->assertJsonPath('data.failed_rows', 250);

        $this->assertCount(200, $response->json('data.errors'));
    }

    public function test_duplicates_within_file_and_across_imports_are_not_stored_twice(): void
    {
        $csv = implode("\n", [self::HEADER, $this->row('Sama'), $this->row('Sama'), $this->row('Beda')]);

        $this->import($csv)
            ->assertJsonPath('data.success_rows', 2)
            ->assertJsonPath('data.failed_rows', 1)
            ->assertJsonPath('data.errors', [['row' => 3, 'message' => 'duplicate_row']]);

        $this->import($csv)
            ->assertJsonPath('data.success_rows', 0)
            ->assertJsonPath('data.failed_rows', 3);

        $this->assertSame(2, RawItem::count());
        $this->assertSame(2, ImportBatch::count());
    }

    public function test_same_row_in_another_source_is_not_a_duplicate(): void
    {
        $other = Source::factory()->create(['type' => 'csv']);
        $csv = self::HEADER."\n".$this->row('Sama');

        $this->import($csv)->assertJsonPath('data.success_rows', 1);
        $this->import($csv, $other)->assertJsonPath('data.success_rows', 1);
    }

    public function test_import_history_is_listed_newest_first(): void
    {
        $this->import(self::HEADER."\n".$this->row('Satu'), name: 'satu.csv');
        $this->import(self::HEADER."\n".$this->row('Dua'), name: 'dua.csv');

        $this->getJson("/api/v1/sources/{$this->source->id}/imports")
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.filename', 'dua.csv')
            ->assertJsonPath('data.1.filename', 'satu.csv');
    }
}
