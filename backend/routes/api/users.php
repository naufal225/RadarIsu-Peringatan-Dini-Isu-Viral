<?php

use App\Http\Controllers\Api\V1\UserController;
use Illuminate\Support\Facades\Route;

// PRD §11 (F12).

Route::get('users', [UserController::class, 'index'])->middleware('permission:users.view');
Route::post('users', [UserController::class, 'store'])->middleware('permission:users.manage');
Route::patch('users/{user}', [UserController::class, 'update'])->middleware('permission:users.manage');
