<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['type', 'name', 'config', 'interval_minutes', 'is_active', 'is_simulated', 'last_fetched_at', 'last_status', 'last_error', 'created_by'])]
class Source extends Model
{
    use HasFactory;

    public const TYPES = ['rss', 'youtube', 'csv', 'replay'];

    protected function casts(): array
    {
        return [
            'config' => 'array',
            'is_active' => 'boolean',
            'is_simulated' => 'boolean',
            'last_fetched_at' => 'datetime',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function importBatches(): HasMany
    {
        return $this->hasMany(ImportBatch::class);
    }

    public function rawItems(): HasMany
    {
        return $this->hasMany(RawItem::class);
    }
}
