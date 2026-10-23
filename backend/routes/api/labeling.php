<?php

use App\Http\Controllers\Api\V1\EvaluationController;
use Illuminate\Support\Facades\Route;

// PRD §11 (F14).

Route::get('labeling/posts', [EvaluationController::class, 'labelingPosts'])->middleware('permission:labels.manage');
Route::put('labeling/posts/{post}', [EvaluationController::class, 'labelPost'])->middleware('permission:labels.manage');
