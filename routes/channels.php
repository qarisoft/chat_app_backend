<?php

use App\Models\User;
use Illuminate\Support\Facades\Broadcast;
use App\Models\Conversation;

Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

// Broadcast::channel('conversation.{id}', function ($user, $id) {
//     $conversation = Conversation::find($id);
//     if ($conversation && $conversation->users()->where('user_id', $user->id)->exists()) {
//         return ['id' => $user->id, 'name' => $user->name, 'email' => $user->email];
//     }
//     return false;
// });


Broadcast::channel('conversation.{conversationId}', function (User $user, int $conversationId) {
    $conversation = Conversation::find($conversationId);

    if (! $conversation) {
        return false;
    }

    if ($conversation->users()->where('user_id', $user->id)->exists()) {
        return [
            'id'   => $user->id,
            'name' => $user->name,
        ];
    }

    return false;
});

Broadcast::channel('online', function ($user) {
    return ['id' => $user->id, 'name' => $user->name];
});
