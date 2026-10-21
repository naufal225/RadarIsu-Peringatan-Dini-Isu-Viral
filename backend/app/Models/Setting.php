<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Model;

#[Table(key: 'key', keyType: 'string', incrementing: false)]
#[Fillable(['key', 'value', 'updated_by'])]
class Setting extends Model
{
    public const CREATED_AT = null;

    protected function casts(): array
    {
        return ['value' => 'array'];
    }
}
