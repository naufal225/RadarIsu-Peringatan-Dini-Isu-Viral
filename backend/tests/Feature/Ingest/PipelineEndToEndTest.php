<?php

namespace Tests\Feature\Ingest;

use App\Jobs\MatchTopicsJob;
use App\Models\MetricHourly;
use App\Models\Post;
use App\Models\RawItem;
use App\Models\Source;
use App\Models\Topic;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

/**
 * DoD of the pipeline (PRD §18, Phase 3): imported CSV data shows up as metrics per topic. The test queue
 * is `sync`, so the whole chain runs inside the import request.
 */
class PipelineEndToEndTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    private const HEADER = 'text,account_handle,posted_at,external_id,account_display_name,account_created_at';

    private function import(Source $source, string $csv): void
    {
        $this->actingAsRole('admin');
        $this->post(
            "/api/v1/sources/{$source->id}/import",
            ['file' => UploadedFile::fake()->createWithContent('data.csv', $csv)],
            ['Accept' => 'application/json'],
        )->assertCreated();
    }

    public function test_csv_import_ends_up_as_hourly_metrics_per_topic(): void
    {
        $topic = Topic::factory()->create(['keywords' => ['pelayanan buruk', 'mengecewakan']]);
        $other = Topic::factory()->create(['keywords' => ['bansos']]);
        $inactive = Topic::factory()->create(['keywords' => ['pelayanan buruk'], 'is_active' => false]);
        $source = Source::factory()->create(['type' => 'csv']);

        $this->import($source, implode("\n", [
            self::HEADER,
            'Pelayanan BURUK sekali!,@a,2026-10-20T08:05:00Z,1,Akun A,2026-10-01T00:00:00Z',
            'Sangat mengecewakan https://contoh.id,@b,2026-10-20T08:40:00Z,2,,',
            'Pelayanan bagus tapi lama,@a,2026-10-20T08:50:00Z,3,,',
            'Pelayanan buruk lagi,@c,2026-10-20T09:10:00Z,4,,',
            'Penyaluran bansos lancar,@d,2026-10-20T09:15:00Z,5,,',
        ]));

        $this->assertSame(5, Post::count());
        $this->assertSame(0, RawItem::whereNull('processed_at')->count());

        $hours = MetricHourly::where('topic_id', $topic->id)->orderBy('hour')->get();
        $this->assertSame(
            [['2026-10-20T08:00:00+00:00', 2, 2], ['2026-10-20T09:00:00+00:00', 1, 1]],
            $hours->map(fn ($m) => [$m->hour->utc()->toIso8601String(), $m->volume, $m->unique_accounts])->all(),
        );
        $this->assertSame(2, $hours[0]->negative_count);

        $this->assertSame(1, MetricHourly::where('topic_id', $other->id)->sum('volume'));
        $this->assertSame(0, MetricHourly::where('topic_id', $inactive->id)->count());
    }

    public function test_a_topic_created_after_the_import_is_filled_from_the_stored_posts(): void
    {
        $source = Source::factory()->create(['type' => 'csv']);
        $this->import($source, self::HEADER."\nBansos telat,@a,2026-10-20T08:05:00Z,1,,\nBansos lancar,@b,2026-10-20T08:30:00Z,2,,");
        $this->assertSame(0, MetricHourly::count());

        $topic = Topic::factory()->create(['keywords' => ['bansos']]);
        dispatch_sync(MatchTopicsJob::forTopic($topic));

        $this->assertSame(2, MetricHourly::where('topic_id', $topic->id)->sum('volume'));
    }

    public function test_importing_the_same_file_again_changes_nothing(): void
    {
        $topic = Topic::factory()->create(['keywords' => ['bansos']]);
        $source = Source::factory()->create(['type' => 'csv']);
        $csv = self::HEADER."\nBansos telat,@a,2026-10-20T08:05:00Z,1,,";

        $this->import($source, $csv);
        $this->import($source, $csv);

        $this->assertSame(1, Post::count());
        $this->assertSame(1, MetricHourly::where('topic_id', $topic->id)->sum('volume'));
    }
}
