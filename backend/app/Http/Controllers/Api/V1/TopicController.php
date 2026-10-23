<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\TopicResource;
use App\Jobs\MatchTopicsJob;
use App\Models\MetricHourly;
use App\Models\Topic;
use App\Services\Audit\AuditLogger;
use App\Services\Detection\SentimentAnalyzer;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Topics and their hourly metrics (PRD §9.4, §9.8, §11, F2). Matching and metrics are built by the
 * pipeline jobs; see docs/PIPELINE.md.
 */
class TopicController extends Controller
{
    /** Default range of `metrics` when `from`/`to` are missing, in days. */
    private const DEFAULT_RANGE_DAYS = 7;

    private const MAX_RANGE_DAYS = 31;

    public function __construct(private AuditLogger $audit) {}

    public function index(): AnonymousResourceCollection
    {
        return TopicResource::collection(Topic::orderBy('is_template')->orderBy('name')->get());
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:150',
            'category' => ['required', Rule::in(Topic::CATEGORIES)],
            'sensitivity' => ['sometimes', Rule::in(Topic::SENSITIVITIES)],
            'is_active' => 'sometimes|boolean',
            ...$this->keywordRules(),
        ]);
        $data['keywords'] = $this->cleanKeywords($data['keywords']);

        $topic = Topic::create([
            ...$data,
            'is_template' => false,
            'created_by' => $request->user()->id,
        ])->refresh();

        $this->audit->log('topic.create', $topic, ['name' => $topic->name, 'category' => $topic->category]);

        // Posts that are already stored belong in the new topic's chart right away.
        if ($topic->is_active) {
            dispatch(MatchTopicsJob::forTopic($topic));
        }

        return (new TopicResource($topic))->response()->setStatusCode(201);
    }

    public function update(Request $request, Topic $topic): TopicResource
    {
        // Templates are the starting points of PRD §9.8; a topic is created from one with POST.
        if ($topic->is_template) {
            throw ValidationException::withMessages(['topic' => ['template_readonly']]);
        }

        $data = $request->validate([
            'name' => 'sometimes|string|max:150',
            'category' => ['sometimes', Rule::in(Topic::CATEGORIES)],
            'sensitivity' => ['sometimes', Rule::in(Topic::SENSITIVITIES)],
            'is_active' => 'sometimes|boolean',
            ...($request->has('keywords') ? $this->keywordRules() : []),
        ]);
        if (array_key_exists('keywords', $data)) {
            $data['keywords'] = $this->cleanKeywords($data['keywords']);
        }

        $topic->update($data);

        $changes = array_values(array_diff(array_keys($topic->getChanges()), ['updated_at']));
        if ($changes === []) {
            return new TopicResource($topic);
        }

        $this->audit->log('topic.update', $topic, ['changes' => $changes]);

        // New keywords, or back from inactive: match every stored post again. Turning a topic off keeps its history.
        if ($topic->is_active && $topic->wasChanged(['keywords', 'is_active'])) {
            dispatch(MatchTopicsJob::forTopic($topic));
        }

        return new TopicResource($topic);
    }

    /**
     * `from` and `to` are UTC dates (Y-m-d) and `to` covers its whole day, like /audit-logs. Without them the
     * range is the 7 days ending on the day of the topic's latest metric, so historical imports still show.
     */
    public function metrics(Request $request, Topic $topic): JsonResponse
    {
        $params = $request->validate([
            'from' => 'nullable|date_format:Y-m-d',
            'to' => 'nullable|date_format:Y-m-d|after_or_equal:from',
        ]);

        $to = isset($params['to'])
            ? CarbonImmutable::parse($params['to'], 'UTC')->addDay()->startOfDay()
            : CarbonImmutable::parse(MetricHourly::where('topic_id', $topic->id)->max('hour') ?? now(), 'UTC')->utc()->addDay()->startOfDay();
        $from = isset($params['from'])
            ? CarbonImmutable::parse($params['from'], 'UTC')->startOfDay()
            : $to->subDays(self::DEFAULT_RANGE_DAYS);

        if ($from->diffInDays($to) > self::MAX_RANGE_DAYS) {
            throw ValidationException::withMessages(['from' => ['range_too_long']]);
        }

        $rows = MetricHourly::where('topic_id', $topic->id)
            ->where('hour', '>=', $from)
            ->where('hour', '<', $to)
            ->orderBy('hour')
            ->get();

        $hasSimulatedData = DB::table('topic_matches as m')
            ->join('posts as p', 'p.id', '=', 'm.post_id')
            ->where('m.topic_id', $topic->id)
            ->where('p.is_simulated', true)
            ->where('p.posted_at', '>=', $from)
            ->where('p.posted_at', '<', $to)
            ->exists();

        return response()->json([
            'data' => $rows->map(fn (MetricHourly $metric) => [
                'hour' => $metric->hour->utc()->format('Y-m-d\TH:i:s\Z'),
                ...$metric->only(['volume', 'positive_count', 'negative_count', 'neutral_count', 'unique_accounts', 'anomalous_accounts', 'source_count']),
            ]),
            'meta' => [
                'from' => $from->format('Y-m-d\TH:i:s\Z'),
                'to' => $to->format('Y-m-d\TH:i:s\Z'),
                'total' => $rows->count(),
                'has_simulated_data' => $hasSimulatedData,
            ],
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function keywordRules(): array
    {
        return [
            'keywords' => ['required', 'array', 'min:1', 'max:50', function (string $attribute, mixed $value, \Closure $fail) {
                // A keyword that normalizes to nothing can never match (PRD §10.4 strips punctuation).
                $usable = array_filter((array) $value, fn ($keyword) => is_string($keyword) && SentimentAnalyzer::normalizeText($keyword) !== '');
                if ($usable === []) {
                    $fail('keywords_unmatchable');
                }
            }],
            'keywords.*' => ['required', 'string', 'max:100', function (string $attribute, mixed $value, \Closure $fail) {
                // PRD §9.8: placeholders such as [nama satuan] must be filled in first.
                if (is_string($value) && (str_contains($value, '[') || str_contains($value, ']'))) {
                    $fail('keyword_has_placeholder');
                }
            }],
        ];
    }

    /**
     * Trimmed, without repeats (case-insensitive), in the order given.
     *
     * @param  list<string>  $keywords
     * @return list<string>
     */
    private function cleanKeywords(array $keywords): array
    {
        $clean = [];
        foreach ($keywords as $keyword) {
            $keyword = trim($keyword);
            $clean[mb_strtolower($keyword)] ??= $keyword;
        }

        return array_values($clean);
    }
}
