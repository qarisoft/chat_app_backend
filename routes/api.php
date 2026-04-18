<?php

use App\Http\Controllers\ChatController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');
// Public auth routes
Route::post('/register', [ChatController::class, 'register']);
Route::post('/login', [ChatController::class, 'login']);

// Protected routes
Route::middleware('auth:sanctum')->group(function () {
    // User
    Route::get('/me', [ChatController::class, 'me']);
    Route::get('/users', [ChatController::class, 'users']);

    // Conversations
    Route::get('/conversations', [ChatController::class, 'conversations']);
    Route::post('/conversations', [ChatController::class, 'startConversation']);

    // Messages
    Route::get('/conversations/{conversation}/messages', [ChatController::class, 'messages']);
    Route::post('/conversations/{conversation}/messages', [ChatController::class, 'sendMessage']);
    Route::post('/conversations/{conversation}/read', [ChatController::class, 'markRead']);
    Route::post('/conversations/{conversation}/typing', [ChatController::class, 'typing']);
});
