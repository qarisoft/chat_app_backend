<?php

use Illuminate\Support\Facades\Route;
use Laravel\Fortify\Features;
use App\Http\Controllers\ChatController;

Route::inertia('/', 'welcome', [
    'canRegister' => Features::enabled(Features::registration()),
])->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::inertia('dashboard', 'dashboard')->name('dashboard');
    
    Route::inertia('chat', 'chat')->name('chat');

    Route::prefix('api/chat')->name('api.chat.')->group(function () {
        Route::get('/users', [ChatController::class, 'users'])->name('users');
        Route::get('/conversations', [ChatController::class, 'conversations'])->name('conversations');
        Route::post('/conversations', [ChatController::class, 'startConversation'])->name('start');
        Route::get('/conversations/{conversation}/messages', [ChatController::class, 'messages'])->name('messages');
        Route::post('/conversations/{conversation}/messages', [ChatController::class, 'sendMessage'])->name('send');
        Route::post('/conversations/{conversation}/read', [ChatController::class, 'markRead'])->name('read');
        Route::post('/conversations/{conversation}/typing', [ChatController::class, 'typing'])->name('typing');
    });
});

require __DIR__.'/settings.php';
