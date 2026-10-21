<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Table('alert_evidence')]
#[Fillable(['alert_id', 'post_id', 'account_id', 'reason', 'detail'])]
class AlertEvidence extends Model
{
    public const REASONS = ['spike_sample', 'similar_text', 'young_account', 'synchronized_posting', 'name_similarity'];

    protected function casts(): array
    {
        return ['detail' => 'array'];
    }

    public function alert(): BelongsTo
    {
        return $this->belongsTo(Alert::class);
    }

    public function post(): BelongsTo
    {
        return $this->belongsTo(Post::class);
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }
}
