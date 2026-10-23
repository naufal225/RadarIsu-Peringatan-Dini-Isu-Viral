<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\ImportBatchResource;
use App\Http\Resources\SourceResource;
use App\Jobs\NormalizePostsJob;
use App\Models\Setting;
use App\Models\Source;
use App\Services\Audit\AuditLogger;
use App\Services\Ingest\CsvImporter;
use App\Services\Ingest\SourceConnectionTester;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Sources, connection test and CSV import (PRD §9.2, §11). Scheduled rss/youtube ingest is Phase 3.
 */
class SourceController extends Controller
{
    /** Types an admin can create; `replay` sources are created by the replay runner (Phase 7). */
    private const CREATABLE_TYPES = ['rss', 'youtube', 'csv'];

    private const DEFAULT_RSS_MAX_ITEMS = 50;

    public function __construct(private AuditLogger $audit) {}

    public function index(): AnonymousResourceCollection
    {
        return SourceResource::collection(Source::withCount('rawItems')->orderBy('name')->get());
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate(['type' => ['required', Rule::in(self::CREATABLE_TYPES)]]);
        $type = $request->input('type');

        $data = $request->validate([
            'name' => 'required|string|max:120',
            'is_active' => 'sometimes|boolean',
            ...$this->configRules($request, $type, partial: false),
        ]);

        $source = Source::create([
            'type' => $type,
            'name' => $data['name'],
            'config' => $this->normalizeConfig($type, $data['config'] ?? []),
            'interval_minutes' => $type === 'csv' ? null : $data['interval_minutes'],
            'is_active' => $data['is_active'] ?? true,
            'is_simulated' => false,
            'last_status' => 'never',
            'created_by' => $request->user()->id,
        ])->refresh();

        $this->audit->log('source.create', $source, ['type' => $type, 'name' => $source->name]);

        return (new SourceResource($source))->response()->setStatusCode(201);
    }

    public function update(Request $request, Source $source): SourceResource
    {
        $data = $request->validate([
            'type' => 'prohibited',
            'name' => 'sometimes|string|max:120',
            'is_active' => 'sometimes|boolean',
            ...$this->configRules($request, $source->type, partial: true),
        ]);

        if (array_key_exists('config', $data)) {
            $data['config'] = $this->normalizeConfig($source->type, $data['config'] ?? []);
        }

        $source->update($data);
        $this->audit->log('source.update', $source, ['changes' => array_keys($source->getChanges())]);

        return new SourceResource($source);
    }

    public function test(Source $source, SourceConnectionTester $tester): SourceResource
    {
        if (! in_array($source->type, ['rss', 'youtube'], true)) {
            throw ValidationException::withMessages(['type' => ['connection_test_not_supported']]);
        }
        // PRD §16: offline mode means no outbound calls at all.
        if (Setting::find('offline_mode')?->value['enabled'] ?? false) {
            throw ValidationException::withMessages(['offline_mode' => ['offline_mode_enabled']]);
        }

        $error = $tester->test($source);

        $source->forceFill([
            'last_status' => $error === null ? 'ok' : 'error',
            'last_error' => $error === null ? null : Str::limit($error, 1000),
            'last_fetched_at' => now(),
        ])->save();

        $this->audit->log('source.test', $source, ['status' => $source->last_status, 'error' => $source->last_error]);

        return new SourceResource($source);
    }

    public function import(Request $request, Source $source, CsvImporter $importer): JsonResponse
    {
        if ($source->type !== 'csv') {
            throw ValidationException::withMessages(['source' => ['source_not_csv']]);
        }

        $request->validate([
            // PRD §11: max 10 MB; content-based type check, not just the extension.
            'file' => 'required|file|mimes:csv,txt|max:10240',
        ]);

        $file = $request->file('file');
        $filename = Str::limit(basename($file->getClientOriginalName()), 190, '');
        $batch = $importer->import($source, $file->getRealPath(), $filename, $request->user());

        // The raw items are saved; turning them into posts, topic matches and metrics happens on the queue.
        if ($batch->success_rows > 0) {
            NormalizePostsJob::dispatch();
        }

        $this->audit->log('source.import', $source, [
            'import_batch_id' => $batch->id,
            'filename' => $batch->filename,
            ...Arr::only($batch->toArray(), ['total_rows', 'success_rows', 'failed_rows']),
        ]);

        return (new ImportBatchResource($batch))->response()->setStatusCode(201);
    }

    public function imports(Source $source): AnonymousResourceCollection
    {
        return ImportBatchResource::collection($source->importBatches()->orderByDesc('id')->paginate(50));
    }

    /**
     * Per-type rules for `config` and `interval_minutes` (PRD §9.2).
     *
     * @return array<string, mixed>
     */
    private function configRules(Request $request, string $type, bool $partial): array
    {
        if (! in_array($type, ['rss', 'youtube'], true)) {
            // csv (and replay, Phase 7): no config, not scheduled.
            return [
                'config' => ['sometimes', 'nullable', 'array', 'max:0'],
                'interval_minutes' => ['prohibited'],
            ];
        }

        // On update a field is validated only when sent, but then always as a whole.
        $config = ! $partial || $request->has('config');
        $interval = ! $partial || $request->has('interval_minutes');

        $rules = match ($type) {
            'rss' => [
                'config' => ['present', 'array:url,max_items'],
                'config.url' => ['required', 'url:http,https', 'max:2048'],
                'config.max_items' => ['nullable', 'integer', 'min:1', 'max:200'],
            ],
            'youtube' => [
                'config' => ['present', 'array:video_ids'],
                'config.video_ids' => ['required', 'array', 'min:1', 'max:50'],
                'config.video_ids.*' => ['string', 'regex:/^[A-Za-z0-9_-]{11}$/'],
            ],
        };

        return [
            ...($config ? $rules : []),
            ...($interval ? ['interval_minutes' => ['required', 'integer', 'min:5', 'max:1440']] : []),
        ];
    }

    /**
     * @param  array<string, mixed>  $config
     * @return array<string, mixed>
     */
    private function normalizeConfig(string $type, array $config): array
    {
        return match ($type) {
            'rss' => ['url' => $config['url'], 'max_items' => (int) ($config['max_items'] ?? self::DEFAULT_RSS_MAX_ITEMS)],
            'youtube' => ['video_ids' => array_values(array_unique($config['video_ids']))],
            default => [],
        };
    }
}
