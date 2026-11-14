<?php

use App\Http\Controllers\Api\V1\LabelingController;
use Illuminate\Support\Facades\Route;

// PRD §11 (F14).

Route::get('labeling/posts', [LabelingController::class, 'labelingPosts'])->middleware('permission:labels.manage');
Route::put('labeling/posts/{post}', [LabelingController::class, 'labelPost'])->middleware('permission:labels.manage');

// Insight (F14): sebaran label per tanggal posting.
Route::get('labeling/daily', [\App\Http\Controllers\Api\V1\InsightController::class, 'labelingDaily'])->middleware('permission:labels.manage');
