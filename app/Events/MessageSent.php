<?php

namespace App\Events;

use App\Models\Message;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class MessageSent implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public Message $message
    ) {}

    /**
     * Broadcast on a presence channel so we know who's online.
     */
    public function broadcastOn(): array
    {
        $channels = [
            new PresenceChannel('conversation.' . $this->message->conversation_id),
        ];

        $this->message->conversation->loadMissing('users');
        foreach ($this->message->conversation->users as $user) {
            $channels[] = new PrivateChannel('App.Models.User.' . $user->id);
        }

        return $channels;
    }

    public function broadcastAs(): string
    {
        return 'message.sent';
    }

    public function broadcastWith(): array
    {
        return [
            'id'              => $this->message->id,
            'conversation_id' => $this->message->conversation_id,
            'user_id'         => $this->message->user_id,
            'user_name'       => $this->message->user->name,
            'body'            => $this->message->body,
            'type'            => $this->message->type,
            'metadata'        => $this->message->metadata,
            'created_at'      => $this->message->created_at->toIso8601String(),
        ];
    }
}
