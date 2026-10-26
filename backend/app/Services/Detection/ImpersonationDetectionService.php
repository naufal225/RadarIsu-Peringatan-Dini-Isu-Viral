<?php

namespace App\Services\Detection;

use App\Models\OfficialAccount;
use App\Models\Setting;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Compares the accounts first seen inside the window with the official accounts (F13, PRD §10.7) and
 * raises an `impersonation` alert for each look-alike. The decision is ImpersonationDetector, the names
 * are prepared by AccountNameNormalizer, the score is ThreatScorer::scoreImpersonation.
 *
 * Similarity is pg_trgm's `similarity()`, evaluated by the database on the normalized strings (they
 * exist only at run time, so there is no column to index; the official list is small by nature, tens
 * of accounts). The work is bounded by the window: only accounts first seen in the last
 * `impersonation_window_hours` are looked at, in chunks, against the official list in chunks.
 *
 * The window is re-read every minute, but a name does not change: an account judged clean is remembered
 * (negative cache) for as long as the inputs stay the same, so a pass only compares accounts it has not
 * seen. The remembered answer is keyed by a fingerprint of the official list, the thresholds and the
 * mapping tables, so changing any of them re-examines everything. It is written chunk by chunk, so a pass
 * cut short by its timeout keeps its progress. Look-alikes are never cached: they are re-scored each pass.
 *
 * One pass is idempotent: the window follows the data clock, the alert is an upsert per account, and
 * evidence is rewritten in place.
 */
class ImpersonationDetectionService
{
    private const ACCOUNT_CHUNK = 200;

    private const OFFICIAL_CHUNK = 300;

    private const FIELDS = ['handle', 'display_name'];

    public function __construct(
        private AccountNameNormalizer $normalizer,
        private AlertWriter $alerts,
    ) {}

    /**
     * @return array{accounts: int, evaluated: int, officials: int, triggered: int, created: int, updated: int, cooldown: int, failed: int}
     */
    public function run(): array
    {
        $settings = Setting::detection();
        $now = DataClock::now();
        $officials = $this->officials();
        $stats = ['accounts' => 0, 'evaluated' => 0, 'officials' => count($officials), 'triggered' => 0, 'created' => 0, 'updated' => 0, 'cooldown' => 0, 'failed' => 0];
        if ($officials === []) {
            return $stats;
        }
        $fingerprint = $this->fingerprint($officials, $settings);

        $this->eachWindowChunk($now, $settings, function (Collection $accounts) use ($officials, $settings, $now, $fingerprint, &$stats) {
            $stats['accounts'] += $accounts->count();

            foreach ($this->examineUnseen($accounts, $officials, $settings, $now, $fingerprint, $stats['evaluated']) as $finding) {
                $stats['triggered']++;

                // One account failing must not stop the others; the job fails afterwards so it is retried.
                try {
                    $result = $this->raise($finding, $officials, $settings, $now);
                    $stats[$result['outcome']]++;
                } catch (Throwable $e) {
                    $stats['failed']++;
                    Log::error('detection.impersonation.account_failed', [
                        'account_id' => $finding['account']->id,
                        'data_clock' => $now->toIso8601String(),
                        'exception' => $e::class,
                        'message' => $e->getMessage(),
                    ]);
                }
            }
        });

        return $stats;
    }

    /**
     * Every look-alike in the window right now, without writing anything.
     *
     * @return array{findings: list<array<string, mixed>>, officials: array<int, array<string, mixed>>, window: array{from: string, to: string}}
     */
    public function scan(?int $officialId = null): array
    {
        $settings = Setting::detection();
        $now = DataClock::now();
        $officials = $this->officials();
        $findings = [];

        if ($officials !== []) {
            $fingerprint = $this->fingerprint($officials, $settings);
            $this->eachWindowChunk($now, $settings, function (Collection $accounts) use ($officials, $settings, $now, $officialId, $fingerprint, &$findings) {
                $evaluated = 0;
                foreach ($this->examineUnseen($accounts, $officials, $settings, $now, $fingerprint, $evaluated) as $finding) {
                    if ($officialId === null || $finding['decision']['official_id'] === $officialId) {
                        $findings[] = $finding;
                    }
                }
            });
        }

        usort($findings, static fn ($a, $b) => [-$a['decision']['similarity'], $a['account']->id] <=> [-$b['decision']['similarity'], $b['account']->id]);

        return [
            'findings' => $findings,
            'officials' => $officials,
            'window' => [
                'from' => $now->subHours((int) $settings['impersonation_window_hours'])->toIso8601ZuluString(),
                'to' => $now->toIso8601ZuluString(),
            ],
        ];
    }

    /**
     * @param  callable(Collection<int, object>): void  $each
     */
    private function eachWindowChunk(CarbonImmutable $now, array $settings, callable $each): void
    {
        DB::table('accounts')
            ->where('first_seen_at', '>', $now->subHours((int) $settings['impersonation_window_hours']))
            ->where('first_seen_at', '<=', $now)
            ->chunkById(self::ACCOUNT_CHUNK, $each);
    }

    /**
     * Official accounts with their comparable forms. The official name is compared in its base form only.
     *
     * @return array<int, array{id: int, handle: string, display_name: string, norm: array<string, string>}>
     */
    private function officials(): array
    {
        $officials = [];
        foreach (OfficialAccount::orderBy('id')->get(['id', 'handle', 'display_name']) as $official) {
            $norm = array_filter([
                'handle' => $this->normalizer->normalize($official->handle),
                'display_name' => $this->normalizer->normalize($official->display_name),
            ], static fn ($value) => $value !== '');

            $officials[$official->id] = ['id' => $official->id, 'handle' => $official->handle, 'display_name' => $official->display_name, 'norm' => $norm];
        }

        return $officials;
    }

    /**
     * Accounts not yet judged clean under this fingerprint are examined; the ones found clean are remembered.
     *
     * @param  Collection<int, object>  $accounts
     * @param  array<int, array<string, mixed>>  $officials
     * @param  array<string, mixed>  $settings
     * @param  int  $evaluated  incremented by the number of accounts actually compared
     * @return list<array{account: object, decision: array<string, mixed>, variants: array<string, list<array<string, mixed>>>}>
     */
    private function examineUnseen(Collection $accounts, array $officials, array $settings, CarbonImmutable $now, string $fingerprint, int &$evaluated): array
    {
        $known = Cache::many($accounts->mapWithKeys(fn ($a) => [$this->cleanKey($fingerprint, $a->id) => $a->id])->keys()->all());
        $unseen = $accounts->reject(fn ($a) => ($known[$this->cleanKey($fingerprint, $a->id)] ?? null) === true)->values();
        $evaluated += $unseen->count();

        $findings = $this->examine($unseen, $officials, $settings, $now);

        $flagged = array_flip(array_map(static fn ($f) => $f['account']->id, $findings));
        $clean = $unseen->reject(fn ($a) => isset($flagged[$a->id]));
        if ($clean->isNotEmpty()) {
            // Kept while the account can still be in the window, plus an hour.
            Cache::putMany($clean->mapWithKeys(fn ($a) => [$this->cleanKey($fingerprint, $a->id) => true])->all(), ((int) $settings['impersonation_window_hours'] + 1) * 3600);
        }

        return $findings;
    }

    /**
     * Everything that decides whether a name is a look-alike, except the name itself.
     *
     * @param  array<int, array<string, mixed>>  $officials
     * @param  array<string, mixed>  $settings
     */
    private function fingerprint(array $officials, array $settings): string
    {
        return substr(sha1(json_encode([
            array_map(static fn ($o) => [$o['id'], $o['handle'], $o['display_name']], $officials),
            (float) $settings['impersonation_threshold'],
            config('impersonation'),
            AccountNameNormalizer::MIN_LENGTH, AccountNameNormalizer::MIN_REMAINING, AccountNameNormalizer::MIN_REMAINING_DIGITS,
        ], JSON_THROW_ON_ERROR)), 0, 16);
    }

    private function cleanKey(string $fingerprint, int $accountId): string
    {
        return "impersonation:clean:{$fingerprint}:{$accountId}";
    }

    /**
     * @param  Collection<int, object>  $accounts  rows of `accounts`
     * @param  array<int, array<string, mixed>>  $officials
     * @param  array<string, mixed>  $settings
     * @return list<array{account: object, decision: array<string, mixed>, variants: array<string, list<array<string, mixed>>>}>
     */
    private function examine(Collection $accounts, array $officials, array $settings, CarbonImmutable $now): array
    {
        $variants = [];
        $candidates = [];
        foreach ($accounts as $account) {
            foreach (self::FIELDS as $field) {
                $list = $this->normalizer->variants((string) ($account->{$field} ?? ''));
                $variants[$account->id][$field] = $list;
                foreach ($list as $variant) {
                    $candidates[] = [$account->id, $field, $variant['key'], $variant['value']];
                }
            }
        }

        $matches = $candidates === [] ? [] : $this->similarities($candidates, $officials, (float) $settings['impersonation_threshold']);

        $officialNames = array_map(static fn ($o) => ['handle' => $o['handle'], 'display_name' => $o['display_name']], $officials);
        $findings = [];
        foreach ($accounts as $account) {
            if (! isset($matches[$account->id])) {
                continue;
            }

            $rules = [];
            foreach ($variants[$account->id] as $field => $list) {
                foreach ($list as $variant) {
                    $rules[$field][$variant['key']] = $variant['rules'];
                }
            }

            $decision = ImpersonationDetector::decide(
                [
                    'id' => $account->id,
                    'handle' => $account->handle,
                    'platform_created_at' => $account->platform_created_at === null ? null : CarbonImmutable::parse($account->platform_created_at)->getTimestamp(),
                ],
                $matches[$account->id], $officialNames, $rules, $settings, $now->getTimestamp(),
            );
            if ($decision['triggered']) {
                $findings[] = ['account' => $account, 'decision' => $decision, 'variants' => $variants[$account->id]];
            }
        }

        return $findings;
    }

    /**
     * pg_trgm `similarity()` of every candidate reading against every official name of the same field,
     * keeping only what reaches the threshold.
     *
     * @param  list<array{0: int, 1: string, 2: string, 3: string}>  $candidates  [account id, field, variant key, normalized value]
     * @param  array<int, array<string, mixed>>  $officials
     * @return array<int, list<array{official_id: int, field: string, variant: string, similarity: float}>> by account id
     */
    private function similarities(array $candidates, array $officials, float $threshold): array
    {
        $values = implode(',', array_fill(0, count($candidates), '(?::bigint, ?::text, ?::text, ?::text)'));
        $candidateBindings = array_merge(...$candidates);

        $rows = [];
        foreach (array_chunk($officials, self::OFFICIAL_CHUNK) as $chunk) {
            $names = [];
            foreach ($chunk as $official) {
                foreach ($official['norm'] as $field => $value) {
                    $names[] = [$official['id'], $field, $value];
                }
            }
            if ($names === []) {
                continue;
            }

            $found = DB::select(
                'SELECT m.account_id, m.field, m.vkey, m.official_id, m.sim FROM (
                    SELECT v.account_id, v.field, v.vkey, o.official_id, similarity(v.val, o.val) AS sim
                    FROM (VALUES '.$values.') AS v(account_id, field, vkey, val)
                    JOIN (VALUES '.implode(',', array_fill(0, count($names), '(?::bigint, ?::text, ?::text)')).') AS o(official_id, field, val)
                      ON o.field = v.field
                 ) m WHERE m.sim >= ?::real',
                [...$candidateBindings, ...array_merge(...$names), $threshold],
            );
            array_push($rows, ...$found);
        }

        $matches = [];
        foreach ($rows as $row) {
            $matches[(int) $row->account_id][] = [
                'official_id' => (int) $row->official_id, 'field' => $row->field, 'variant' => $row->vkey, 'similarity' => (float) $row->sim,
            ];
        }

        return $matches;
    }

    /**
     * @param  array{account: object, decision: array<string, mixed>, variants: array<string, list<array<string, mixed>>>}  $finding
     * @param  array<int, array<string, mixed>>  $officials
     * @param  array<string, mixed>  $settings
     * @return array{outcome: string, alert_id: int|null, evidence_added: int}
     */
    private function raise(array $finding, array $officials, array $settings, CarbonImmutable $now): array
    {
        $account = $finding['account'];
        $decision = $finding['decision'];
        $official = $officials[$decision['official_id']];

        $scored = ThreatScorer::scoreImpersonation($decision['similarity'], $decision['young'], ThreatScorer::optionsFromSettings($settings));

        $compared = collect($finding['variants'][$decision['field']])->firstWhere('key', $decision['variant']);
        $base = [
            'official' => ['id' => $official['id'], 'handle' => $official['handle'], 'display_name' => $official['display_name']],
            'thresholds' => [
                'impersonation_threshold' => (float) $settings['impersonation_threshold'],
                'young_account_days' => (int) $settings['young_account_days'],
                'impersonation_window_hours' => (int) $settings['impersonation_window_hours'],
            ],
            'account_first_seen_at' => CarbonImmutable::parse($account->first_seen_at)->toIso8601String(),
        ];

        $firstPost = DB::table('posts')->where('account_id', $account->id)->orderBy('posted_at')->orderBy('id')->value('id');
        $evidence = [[
            'reason' => 'name_similarity',
            'post_id' => $firstPost,
            'account_id' => $account->id,
            'detail' => $base + [
                'similarity' => $decision['similarity'],
                'field' => $decision['field'],
                'reading' => $decision['variant'],
                'compared' => ['account' => $compared['value'] ?? null, 'official' => $official['norm'][$decision['field']] ?? null],
                'same_name' => $decision['same_name'],
                'rules' => $decision['rules'],
                'other_matches' => array_map(fn ($m) => $m + ['handle' => $officials[$m['official_id']]['handle']], $decision['other_matches']),
            ],
        ]];
        if ($decision['young']) {
            $evidence[] = [
                'reason' => 'young_account',
                'post_id' => $firstPost,
                'account_id' => $account->id,
                'detail' => $base + ['account_age_days' => $decision['age_days'], 'young_account_days' => (int) $settings['young_account_days']],
            ];
        }

        return $this->alerts->upsertImpersonation(
            $account->id, $scored, CarbonImmutable::parse($account->first_seen_at), $now, $now, $evidence, (int) $settings['cooldown_minutes'],
        );
    }
}
