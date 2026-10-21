<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['source_id', 'filename', 'total_rows', 'success_rows', 'failed_rows', 'errors', 'created_by'])]
class ImportBatch extends Model
{
    protected function casts(): array
    {
        return ['errors' => 'array'];
    }

    public function source(): BelongsTo
    {
        return $this->belongsTo(Source::class);
    }
}
