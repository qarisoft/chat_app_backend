<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Conversation extends Model
{
    protected $fillable = ['name', 'is_group'];

    protected $casts = [
        'is_group' => 'boolean',
    ];

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class)
            ->withPivot('last_read_at')
            ->withTimestamps();
    }

    public function messages(): HasMany
    {
        return $this->hasMany(Message::class)->orderBy('created_at');
    }

    public function latestMessage(): HasOne
    {
        return $this->hasOne(Message::class)->latestOfMany();
    }

    /**
     * Get the other participant in a 1-on-1 conversation.
     */
    public function otherUser(User $currentUser)
    {
        return $this->users->where('id', '!=', $currentUser->id)->first();
    }

    /**
     * Get unread message count for a user.
     */
    public function unreadCountFor(User $user): int
    {
        $pivot = $this->users()->where('user_id', $user->id)->first()?->pivot;
        $lastRead = $pivot?->last_read_at;

        $query = $this->messages()->where('user_id', '!=', $user->id);

        if ($lastRead) {
            $query->where('created_at', '>', $lastRead);
        }

        return $query->count();
    }
}
