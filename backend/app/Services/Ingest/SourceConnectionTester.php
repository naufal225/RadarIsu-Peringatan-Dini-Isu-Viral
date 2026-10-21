<?php

namespace App\Services\Ingest;

use App\Models\Source;
use App\Support\OutboundUrlGuard;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use RuntimeException;
use SimpleXMLElement;

/**
 * Connection test for rss/youtube sources (PRD §11 POST /sources/{id}/test).
 * Returns null on success or a diagnostic message; the caller records it on the source.
 */
class SourceConnectionTester
{
    private const TIMEOUT_SECONDS = 10;

    private const MAX_BYTES = 2 * 1024 * 1024;

    private const YOUTUBE_VIDEOS_URL = 'https://www.googleapis.com/youtube/v3/videos';

    public function __construct(private OutboundUrlGuard $guard) {}

    public function test(Source $source): ?string
    {
        try {
            return match ($source->type) {
                'rss' => $this->testRss($source->config['url']),
                'youtube' => $this->testYoutube($source->config['video_ids']),
            };
        } catch (ConnectionException $e) {
            return 'Connection failed: '.$e->getMessage();
        } catch (RuntimeException $e) {
            return $e->getMessage();
        }
    }

    private function testRss(string $url): ?string
    {
        $target = $this->guard->check($url);
        $tooLarge = false;

        try {
            $response = Http::timeout(self::TIMEOUT_SECONDS)
                ->connectTimeout(5)
                ->withoutRedirecting()
                ->withUserAgent('RadarIsu/1.0 (+connection test)')
                ->withOptions([
                    // Only allow-listed cURL options are accepted by Guzzle; CURLOPT_RESOLVE is one of them.
                    // The scheme is already restricted to http(s) by the guard, and redirects are off.
                    'curl' => [CURLOPT_RESOLVE => [OutboundUrlGuard::curlResolve($target)]],
                    // Abort the transfer as soon as it exceeds the limit instead of buffering it all.
                    'progress' => function ($expected, $downloaded) use (&$tooLarge) {
                        if ($expected > self::MAX_BYTES || $downloaded > self::MAX_BYTES) {
                            $tooLarge = true;
                            throw new RuntimeException('Response is larger than 2 MB.');
                        }
                    },
                ])
                ->get($url);
        } catch (ConnectionException $e) {
            // Guzzle wraps exceptions thrown from the progress callback in a generic message.
            if ($tooLarge) {
                return 'Response is larger than 2 MB.';
            }
            throw $e;
        }

        if ($response->redirect()) {
            return "Redirects are not followed (HTTP {$response->status()}); configure the final feed URL.";
        }
        if (! $response->successful()) {
            return "HTTP {$response->status()}";
        }

        $body = $response->body();
        if (strlen($body) > self::MAX_BYTES) {
            return 'Response is larger than 2 MB.';
        }

        return $this->feedError($body);
    }

    private function feedError(string $body): ?string
    {
        $previous = libxml_use_internal_errors(true);
        try {
            // LIBXML_NONET: never fetch external resources; entities are not substituted (no LIBXML_NOENT).
            $xml = simplexml_load_string($body, SimpleXMLElement::class, LIBXML_NONET);
        } finally {
            libxml_clear_errors();
            libxml_use_internal_errors($previous);
        }

        if ($xml === false) {
            return 'Response is not valid XML.';
        }

        return in_array(strtolower($xml->getName()), ['rss', 'feed', 'rdf'], true)
            ? null
            : "Response is XML but not an RSS/Atom feed (<{$xml->getName()}>).";
    }

    /**
     * @param  list<string>  $videoIds
     */
    private function testYoutube(array $videoIds): ?string
    {
        $key = config('services.youtube.key');
        if (! $key) {
            return 'YOUTUBE_API_KEY is not configured.';
        }

        $response = Http::timeout(self::TIMEOUT_SECONDS)->get(self::YOUTUBE_VIDEOS_URL, [
            'part' => 'id',
            'id' => implode(',', $videoIds),
            'key' => $key,
        ]);

        if (! $response->successful()) {
            return "YouTube API HTTP {$response->status()}";
        }

        $found = collect($response->json('items', []))->pluck('id')->all();
        $missing = array_values(array_diff($videoIds, $found));

        return $missing === [] ? null : 'Videos not found: '.implode(', ', $missing);
    }
}
