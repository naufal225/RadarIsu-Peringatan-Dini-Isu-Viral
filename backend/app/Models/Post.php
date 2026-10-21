<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

#[Fillable(['source_id', 'raw_item_id', 'account_id', 'external_id', 'text', 'text_norm', 'posted_at', 'sentiment', 'sentiment_score', 'is_simulated', 'label_manual'])]
class Post extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return [
            'posted_at' => 'datetime',
            'sentiment_score' => 'decimal:3',
            'is_simulated' => 'boolean',
        ];
    }

    public function source(): BelongsTo
    {
        return $this->belongsTo(Source::class);
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }

    public function topics(): BelongsToMany
    {
        return $this->belongsToMany(Topic::class, 'topic_matches');
    }
}
