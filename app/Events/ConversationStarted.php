<?php

namespace App\Events;

use App\Models\Conversation;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ConversationStarted implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public Conversation $conversation
    ) {}

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, \Illuminate\Broadcasting\Channel>
     */
    public function broadcastOn(): array
    {
        $channels = [];

        foreach ($this->conversation->users as $user) {
            $channels[] = new PrivateChannel('App.Models.User.' . $user->id);
        }

        return $channels;
    }

    public function broadcastAs(): string
    {
        return 'conversation.started';
    }

    public function broadcastWith(): array
    {
        return [
            'conversation_id' => $this->conversation->id,
        ];
    }
}
