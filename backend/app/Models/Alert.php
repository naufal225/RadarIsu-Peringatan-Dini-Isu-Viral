<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'kind', 'topic_id', 'subject_account_id', 'score', 'severity', 'score_breakdown', 'status',
    'detected_at', 'window_start', 'window_end', 'assigned_to', 'recommendation',
    'escalated_at', 'decided_at', 'closed_at',
])]
class Alert extends Model
{
    use HasFactory;

    public const STATUSES = ['new', 'reviewing', 'escalated', 'returned', 'approved', 'false_positive', 'closed'];

    public const OPEN_STATUSES = ['new', 'reviewing', 'escalated', 'returned'];

    public const TERMINAL_STATUSES = ['approved', 'false_positive', 'closed'];

    /** Statuses a leader may see (PRD §8.4). */
    public const LEADER_VISIBLE_STATUSES = ['escalated', 'approved', 'returned'];

    public const KINDS = ['issue', 'impersonation'];

    public const SEVERITIES = ['low', 'medium', 'high'];

    protected function casts(): array
    {
        return [
            'score' => 'integer',
            'score_breakdown' => 'array',
            'detected_at' => 'datetime',
            'window_start' => 'datetime',
            'window_end' => 'datetime',
            'escalated_at' => 'datetime',
            'decided_at' => 'datetime',
            'closed_at' => 'datetime',
        ];
    }

    /**
     * Restrict to alerts the user is allowed to see (mirrors AlertPolicy::view).
     */
    #[Scope]
    protected function visibleTo(Builder $query, User $user): void
    {
        match ($user->role->slug) {
            'analyst' => null,
            'leader' => $query->whereIn('status', self::LEADER_VISIBLE_STATUSES),
            default => $query->whereRaw('1 = 0'),
        };
    }

    public function topic(): BelongsTo
    {
        return $this->belongsTo(Topic::class);
    }

    public function subjectAccount(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'subject_account_id');
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function evidence(): HasMany
    {
        return $this->hasMany(AlertEvidence::class);
    }

    public function actions(): HasMany
    {
        return $this->hasMany(AlertAction::class);
    }

    public function briefings(): HasMany
    {
        return $this->hasMany(Briefing::class);
    }
}
