<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\LabelPostRequest;
use App\Http\Requests\ListLabelingPostsRequest;
use App\Http\Resources\LabelingPostResource;
use App\Models\Post;
use App\Services\Audit\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

/**
 * Manual labeling queue that feeds the evaluation (PRD §11, §15; F14-a). Authorization is the
 * `labels.manage` permission middleware on the routes (analyst only).
 */
class LabelingController extends Controller
{
    /** PRD §15: roughly 200 labeled posts are expected for the evaluation. */
    public const TARGET_LABELED = 200;

    public function __construct(private AuditLogger $audit) {}

    public function labelingPosts(ListLabelingPostsRequest $request): JsonResponse
    {
        $filters = $request->validated();
        $status = $filters['status'] ?? 'all';

        $query = Post::query()->with(['account:id,handle,display_name', 'topics:id,name']);

        if (isset($filters['label'])) {
            $query->where('label_manual', $filters['label']);
        } elseif ($status === 'unlabeled') {
            $query->whereNull('label_manual');
        } elseif ($status === 'labeled') {
            $query->whereNotNull('label_manual');
        }
        if (isset($filters['is_simulated'])) {
            $query->where('is_simulated', (bool) $filters['is_simulated']);
        }
        if (isset($filters['topic_id'])) {
            $query->whereHas('topics', fn ($topics) => $topics->whereKey($filters['topic_id']));
        }

        $page = $query->orderByDesc('posted_at')->orderByDesc('id')->paginate($filters['per_page'] ?? 25);

        return response()->json([
            'data' => LabelingPostResource::collection($page->getCollection())->resolve($request),
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
                'progress' => $this->progress(),
            ],
        ]);
    }

    public function labelPost(LabelPostRequest $request, Post $post): JsonResponse
    {
        $new = $request->validated('label_manual');

        // Lock the row so two analysts cannot both audit the same transition.
        DB::transaction(function () use ($post, $new): void {
            $locked = Post::query()->lockForUpdate()->findOrFail($post->id);
            $old = $locked->label_manual;
            if ($old === $new) {
                return;
            }
            $locked->update(['label_manual' => $new]);
            $this->audit->log('label.set', $locked, ['from' => $old, 'to' => $new]);
        });

        $post->refresh()->load(['account:id,handle,display_name', 'topics:id,name']);

        return (new LabelingPostResource($post))->response();
    }

    /**
     * @return array{labeled: int, organic: int, anomalous: int, target: int}
     */
    private function progress(): array
    {
        $counts = Post::query()->whereNotNull('label_manual')->selectRaw('label_manual, count(*) as total')->groupBy('label_manual')->pluck('total', 'label_manual');
        $organic = (int) ($counts['organic'] ?? 0);
        $anomalous = (int) ($counts['anomalous'] ?? 0);

        return ['labeled' => $organic + $anomalous, 'organic' => $organic, 'anomalous' => $anomalous, 'target' => self::TARGET_LABELED];
    }
}
