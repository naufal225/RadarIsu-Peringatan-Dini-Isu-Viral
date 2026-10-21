<?php

namespace Tests\Feature\Sources;

use App\Models\AuditLog;
use App\Models\Setting;
use App\Models\Source;
use App\Support\OutboundUrlGuard;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * PRD §11 POST /sources/{id}/test, §13 SSRF protection, §16 offline mode.
 */
class SourceConnectionTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    private const RSS = '<?xml version="1.0"?><rss version="2.0"><channel><title>T</title><item><title>a</title></item></channel></rss>';

    protected function setUp(): void
    {
        parent::setUp();
        Http::preventStrayRequests();
        $this->resolveHostsTo(['93.184.216.34']);
        $this->actingAsRole('admin');
    }

    private function resolveHostsTo(array $ips): void
    {
        $this->app->instance(OutboundUrlGuard::class, new OutboundUrlGuard(fn (string $host) => $ips));
    }

    private function rssSource(string $url = 'https://news.example.org/feed.xml'): Source
    {
        return Source::factory()->create(['type' => 'rss', 'config' => ['url' => $url, 'max_items' => 50], 'interval_minutes' => 15]);
    }

    public function test_rss_success_marks_source_ok(): void
    {
        Http::fake(['news.example.org/*' => Http::response(self::RSS, 200, ['Content-Type' => 'application/rss+xml'])]);
        $source = $this->rssSource();

        $this->postJson("/api/v1/sources/{$source->id}/test")
            ->assertOk()
            ->assertJsonPath('data.last_status', 'ok')
            ->assertJsonPath('data.last_error', null);

        $source->refresh();
        $this->assertSame('ok', $source->last_status);
        $this->assertNotNull($source->last_fetched_at);
        $this->assertSame(1, AuditLog::where('action', 'source.test')->where('object_id', $source->id)->count());
    }

    public function test_atom_feed_is_accepted(): void
    {
        Http::fake(['news.example.org/*' => Http::response('<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>T</title></feed>')]);

        $this->postJson("/api/v1/sources/{$this->rssSource()->id}/test")->assertJsonPath('data.last_status', 'ok');
    }

    public static function failingResponses(): array
    {
        return [
            'http 500' => [500, self::RSS],
            'not xml' => [200, '<html><body>hello</body></html>'],
            'broken xml' => [200, '<rss><channel>'],
        ];
    }

    #[DataProvider('failingResponses')]
    public function test_rss_failure_marks_source_error(int $status, string $body): void
    {
        Http::fake(['news.example.org/*' => Http::response($body, $status)]);
        $source = $this->rssSource();

        $this->postJson("/api/v1/sources/{$source->id}/test")
            ->assertOk()
            ->assertJsonPath('data.last_status', 'error');

        $this->assertNotEmpty($source->fresh()->last_error);
        $this->assertSame(1, AuditLog::where('action', 'source.test')->count());
    }

    public function test_redirects_are_not_followed(): void
    {
        Http::fake(['news.example.org/*' => Http::response('', 302, ['Location' => 'http://169.254.169.254/latest/meta-data'])]);
        $source = $this->rssSource();

        $this->postJson("/api/v1/sources/{$source->id}/test")->assertJsonPath('data.last_status', 'error');

        Http::assertSentCount(1);
    }

    public static function privateTargets(): array
    {
        return [
            'loopback' => [['127.0.0.1']],
            'private 10/8' => [['10.1.2.3']],
            'private 192.168' => [['192.168.1.10']],
            'docker network' => [['172.28.0.5']],
            'link-local metadata' => [['169.254.169.254']],
            'ipv6 loopback' => [['::1']],
            'mixed public and private' => [['93.184.216.34', '10.0.0.1']],
            'unresolvable' => [[]],
        ];
    }

    #[DataProvider('privateTargets')]
    public function test_urls_resolving_to_internal_addresses_are_blocked(array $ips): void
    {
        $this->resolveHostsTo($ips);
        Http::fake();
        $source = $this->rssSource('https://internal.example.org/feed');

        $this->postJson("/api/v1/sources/{$source->id}/test")->assertJsonPath('data.last_status', 'error');

        Http::assertNothingSent();
    }

    public function test_ip_literal_url_to_internal_address_is_blocked(): void
    {
        Http::fake();
        $source = $this->rssSource('http://127.0.0.1:8000/api/v1/users');

        $this->postJson("/api/v1/sources/{$source->id}/test")->assertJsonPath('data.last_status', 'error');

        Http::assertNothingSent();
    }

    public function test_youtube_without_api_key_is_error_without_request(): void
    {
        config(['services.youtube.key' => null]);
        Http::fake();
        $source = Source::factory()->create(['type' => 'youtube', 'config' => ['video_ids' => ['dQw4w9WgXcQ']], 'interval_minutes' => 15]);

        $this->postJson("/api/v1/sources/{$source->id}/test")->assertJsonPath('data.last_status', 'error');

        Http::assertNothingSent();
    }

    public function test_youtube_with_key_checks_videos(): void
    {
        config(['services.youtube.key' => 'test-key']);
        Http::fake(['www.googleapis.com/youtube/v3/videos*' => Http::response(['items' => [['id' => 'dQw4w9WgXcQ']]])]);
        $source = Source::factory()->create(['type' => 'youtube', 'config' => ['video_ids' => ['dQw4w9WgXcQ']], 'interval_minutes' => 15]);

        $this->postJson("/api/v1/sources/{$source->id}/test")->assertJsonPath('data.last_status', 'ok');

        Http::assertSent(fn (Request $request) => str_contains($request->url(), 'id=dQw4w9WgXcQ')
            && str_contains($request->url(), 'key=test-key'));
    }

    public function test_youtube_missing_video_is_error(): void
    {
        config(['services.youtube.key' => 'test-key']);
        Http::fake(['www.googleapis.com/*' => Http::response(['items' => []])]);
        $source = Source::factory()->create(['type' => 'youtube', 'config' => ['video_ids' => ['dQw4w9WgXcQ']], 'interval_minutes' => 15]);

        $this->postJson("/api/v1/sources/{$source->id}/test")->assertJsonPath('data.last_status', 'error');
        $this->assertStringContainsString('dQw4w9WgXcQ', $source->fresh()->last_error);
    }

    public function test_offline_mode_blocks_outbound_tests(): void
    {
        Setting::whereKey('offline_mode')->update(['value' => json_encode(['enabled' => true])]);
        Http::fake();
        $source = $this->rssSource();

        $this->postJson("/api/v1/sources/{$source->id}/test")->assertUnprocessable();

        Http::assertNothingSent();
        $this->assertSame('never', $source->fresh()->last_status);
    }

    public function test_csv_source_test_is_rejected(): void
    {
        $source = Source::factory()->create(['type' => 'csv']);

        $this->postJson("/api/v1/sources/{$source->id}/test")->assertUnprocessable();
    }
}
