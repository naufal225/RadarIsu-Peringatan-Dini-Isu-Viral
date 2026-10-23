<?php

use App\Http\Controllers\Api\V1\SourceController;
use Illuminate\Support\Facades\Route;

// PRD §11, §11.4 (F1).

Route::post('sources/{source}/import', [SourceController::class, 'import'])->middleware('permission:sources.manage');
Route::get('sources/{source}/imports', [SourceController::class, 'imports'])->middleware('permission:sources.view');
