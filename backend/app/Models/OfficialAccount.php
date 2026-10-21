<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['handle', 'display_name', 'note', 'created_by'])]
class OfficialAccount extends Model
{
    //
}
