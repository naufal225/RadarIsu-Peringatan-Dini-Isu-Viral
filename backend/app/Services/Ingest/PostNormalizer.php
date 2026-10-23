<?php

namespace App\Services\Ingest;

use App\Models\Source;
use App\Services\Detection\SentimentAnalyzer;
use Carbon\CarbonImmutable;
use Throwable;

/**
 * Canonical raw_items payload → account and post attributes (PRD §10.4). No database access.
 *
 * The payload has the CSV / replay_rows shape: text, account_handle, posted_at, and optionally
 * external_id, account_display_name, account_created_at. Ingestors write the same shape.
 */
class PostNormalizer
{
    /**
     * @param  array<string, mixed>  $payload
     * @return array{
     *     account: array{source_type: string, handle: string, display_name: ?string, platform_created_at: ?CarbonImmutable, first_seen_at: CarbonImmutable},
     *     post: array{source_id: int, external_id: ?string, text: string, text_norm: string, posted_at: CarbonImmutable, sentiment: string, sentiment_score: float, is_simulated: bool}
     * }
     *
     * @throws InvalidPayloadException
     */
    public function normalize(Source $source, array $payload): array
    {
        $text = $this->string($payload, 'text') ?? throw new InvalidPayloadException('missing_text');
        $handle = $this->string($payload, 'account_handle') ?? throw new InvalidPayloadException('missing_account_handle');
        $postedAt = $this->time($payload, 'posted_at') ?? throw new InvalidPayloadException('invalid_posted_at');

        $sentiment = SentimentAnalyzer::classify($text);

        return [
            'account' => [
                'source_type' => $source->type,
                'handle' => $handle,
                'display_name' => $this->string($payload, 'account_display_name'),
                'platform_created_at' => $this->time($payload, 'account_created_at'),
                // On the data-time axis (PRD §10.7 compares it with the data clock), not the server's.
                'first_seen_at' => $postedAt,
            ],
            'post' => [
                'source_id' => $source->id,
                'external_id' => $this->string($payload, 'external_id'),
                'text' => $text,
                'text_norm' => SentimentAnalyzer::normalizeText($text),
                'posted_at' => $postedAt,
                'sentiment' => $sentiment['label'],
                'sentiment_score' => $sentiment['score'],
                'is_simulated' => $source->is_simulated,
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function string(array $payload, string $key): ?string
    {
        $value = $payload[$key] ?? null;

        return is_string($value) && trim($value) !== '' ? trim($value) : null;
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function time(array $payload, string $key): ?CarbonImmutable
    {
        $value = $this->string($payload, $key);
        if ($value === null) {
            return null;
        }

        try {
            return CarbonImmutable::parse($value)->utc();
        } catch (Throwable) {
            return null;
        }
    }
}
