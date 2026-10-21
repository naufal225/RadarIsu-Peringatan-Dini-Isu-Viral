<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Table('metrics_hourly')]
#[Fillable(['topic_id', 'hour', 'volume', 'positive_count', 'negative_count', 'neutral_count', 'unique_accounts', 'anomalous_accounts', 'source_count'])]
class MetricHourly extends Model
{
    protected function casts(): array
    {
        return ['hour' => 'datetime'];
    }

    public function topic(): BelongsTo
    {
        return $this->belongsTo(Topic::class);
    }
}
