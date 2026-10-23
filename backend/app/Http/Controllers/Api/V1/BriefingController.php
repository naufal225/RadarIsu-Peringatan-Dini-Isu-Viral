<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Alert;
use App\Models\Briefing;
use App\Services\Audit\AuditLogger;
use App\Services\Briefings\BriefingPdfGenerator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Institutional Briefing Controller (PRD §6.1 F9, §11.8).
 */
class BriefingController extends Controller
{
    public function __construct(
        private AuditLogger $audit,
        private BriefingPdfGenerator $pdfGenerator,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $briefings = Briefing::query()
            ->with(['alert.topic', 'alert.subjectAccount', 'creator:id,name,email'])
            ->whereHas('alert', fn ($q) => $q->visibleTo($user))
            ->orderByDesc('id')
            ->paginate($request->integer('per_page', 25));

        return response()->json([
            'data' => $briefings->getCollection()->map(fn (Briefing $b) => [
                'id' => $b->id,
                'alert_id' => $b->alert_id,
                'title' => $b->title,
                'summary' => $b->summary,
                'content' => $b->content,
                'file_path' => $b->file_path,
                'created_at' => $b->created_at,
                'creator' => $b->creator ? ['id' => $b->creator->id, 'name' => $b->creator->name] : null,
                'alert' => $b->alert ? [
                    'id' => $b->alert->id,
                    'kind' => $b->alert->kind,
                    'status' => $b->alert->status,
                    'score' => $b->alert->score,
                    'severity' => $b->alert->severity,
                    'topic' => $b->alert->topic ? ['id' => $b->alert->topic->id, 'name' => $b->alert->topic->name] : null,
                    'subject_account' => $b->alert->subjectAccount ? ['id' => $b->alert->subjectAccount->id, 'handle' => $b->alert->subjectAccount->handle] : null,
                ] : null,
            ]),
            'meta' => [
                'current_page' => $briefings->currentPage(),
                'last_page' => $briefings->lastPage(),
                'per_page' => $briefings->perPage(),
                'total' => $briefings->total(),
            ],
        ]);
    }

    public function store(Request $request, Alert $alert): JsonResponse
    {
        Gate::authorize('createBriefing', $alert);

        if ($alert->status === 'new') {
            throw ValidationException::withMessages(['status' => ['Briefings cannot be created for new alerts.']]);
        }

        $alert->load(['topic', 'subjectAccount', 'evidence.account', 'evidence.post', 'actions.user']);

        $title = "Briefing Peringatan Dini #{$alert->id}: " . ($alert->topic?->name ?? $alert->subjectAccount?->handle ?? "Isu {$alert->id}");
        $summary = "Ringkasan isu {$alert->kind} dengan skor ancaman {$alert->score} ({$alert->severity}). Rekomendasi: " . ($alert->recommendation ?? 'Belum ada rekomendasi.');

        $content = [
            'timeline' => $alert->actions->map(fn ($a) => [
                'action' => $a->action,
                'user' => $a->user?->name,
                'from_status' => $a->from_status,
                'to_status' => $a->to_status,
                'note' => $a->note,
                'created_at' => (string) $a->created_at,
            ])->all(),
            'evidence_ids' => $alert->evidence->pluck('id')->all(),
            'recommendation' => $alert->recommendation,
            'decision' => $alert->status === 'approved' ? 'approved' : ($alert->status === 'returned' ? 'returned' : null),
        ];

        $briefing = new Briefing([
            'alert_id' => $alert->id,
            'created_by' => $request->user()->id,
            'title' => $title,
            'summary' => $summary,
            'content' => $content,
        ]);

        $filePath = "briefings/briefing-{$alert->id}-".time().'.pdf';
        $pdfContent = $this->pdfGenerator->generate($alert, $briefing);
        Storage::disk('local')->put($filePath, $pdfContent);

        $briefing->file_path = $filePath;
        $briefing->save();

        $this->audit->log('briefing.create', $briefing, [
            'alert_id' => $alert->id,
            'title' => $title,
            'file_path' => $filePath,
        ], $request->user());

        return response()->json([
            'data' => [
                'id' => $briefing->id,
                'alert_id' => $briefing->alert_id,
                'title' => $briefing->title,
                'summary' => $briefing->summary,
                'file_path' => $briefing->file_path,
                'created_at' => $briefing->created_at,
            ],
        ], 201);
    }

    public function download(Request $request, Briefing $briefing): StreamedResponse
    {
        Gate::authorize('download', $briefing);

        $this->audit->log('briefing.download', $briefing, [
            'alert_id' => $briefing->alert_id,
            'file_path' => $briefing->file_path,
        ], $request->user());

        if (! Storage::disk('local')->exists($briefing->file_path)) {
            $briefing->load(['alert.topic', 'alert.subjectAccount', 'alert.evidence.account', 'alert.evidence.post', 'alert.actions.user']);
            $pdfContent = $this->pdfGenerator->generate($briefing->alert, $briefing);
            Storage::disk('local')->put($briefing->file_path, $pdfContent);
        }

        return Storage::disk('local')->download(
            $briefing->file_path,
            "briefing-alert-{$briefing->alert_id}.pdf",
            ['Content-Type' => 'application/pdf']
        );
    }
}
