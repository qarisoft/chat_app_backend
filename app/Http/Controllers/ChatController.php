<?php

namespace App\Http\Controllers;

use App\Events\MessageSent;
use App\Events\ConversationStarted;
use App\Events\UserTyping;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ChatController extends Controller
{
    // ─── Auth ────────────────────────────────────────────────────

    /**
     * Register a new user.
     */
    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'     => 'required|string|max:255',
            'email'    => 'required|email|unique:users',
            'password' => 'required|string|min:6',
        ]);

        $user = User::create([
            'name'     => $data['name'],
            'email'    => $data['email'],
            'password' => bcrypt($data['password']),
        ]);

        $token = $user->createToken('chat-app')->plainTextToken;

        return response()->json([
            'user'  => $user->only('id', 'name', 'email'),
            'token' => $token,
        ], 201);
    }

    /**
     * Login and receive a Sanctum token.
     */
    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email'    => 'required|email',
            'password' => 'required|string',
        ]);

        if (! auth()->attempt($data)) {
            return response()->json(['message' => 'Invalid credentials'], 401);
        }

        $user  = auth()->user();
        $token = $user->createToken('chat-app')->plainTextToken;

        return response()->json([
            'user'  => $user->only('id', 'name', 'email'),
            'token' => $token,
        ]);
    }

    /**
     * Get authenticated user info.
     */
    public function me(Request $request): JsonResponse
    {
        return response()->json($request->user()->only('id', 'name', 'email'));
    }

    // ─── Users ───────────────────────────────────────────────────

    /**
     * List all users (except current).
     */
    public function users(Request $request): JsonResponse
    {
        $users = User::where('id', '!=', $request->user()->id)
            ->select('id', 'name', 'email')
            ->orderBy('name')
            ->get();

        return response()->json($users);
    }

    // ─── Conversations ──────────────────────────────────────────

    /**
     * List conversations for the current user.
     */
    public function conversations(Request $request): JsonResponse
    {
        $user = $request->user();

        $conversations = $user->conversations()->latest()
            ->with(['users:id,name,email', 'latestMessage.user:id,name'])
            ->get()
            ->map(function (Conversation $conv) use ($user) {
                return [
                    'id'             => $conv->id,
                    'name'           => $conv->is_group
                        ? $conv->name
                        : $conv->otherUser($user)?->name,
                    'is_group'       => $conv->is_group,
                    'users'          => $conv->users->map->only('id', 'name', 'email'),
                    'latest_message' => $conv->latestMessage
                        ? [
                            'body'       => $conv->latestMessage->body,
                            'user_name'  => $conv->latestMessage->user->name,
                            'created_at' => $conv->latestMessage->created_at->toIso8601String(),
                        ]
                        : null,
                    'unread_count'   => $conv->unreadCountFor($user),
                ];
            })
            // ->sortByDesc(fn($c) => $c['latest_message']['created_at'] ?? '')
            ->values();

        return response()->json($conversations);
    }

    /**
     * Start a new 1-on-1 conversation (or return existing).
     */
    public function startConversation(Request $request): JsonResponse
    {
        $data = $request->validate([
            'user_id' => 'required|exists:users,id',
        ]);

        $me    = $request->user();
        $other = User::findOrFail($data['user_id']);

        // Check if a 1-on-1 conversation already exists between these users
        $existing = Conversation::where('is_group', false)
            ->whereHas('users', fn($q) => $q->where('user_id', $me->id))
            ->whereHas('users', fn($q) => $q->where('user_id', $other->id))
            ->first();

        if ($existing) {
            return response()->json(['conversation_id' => $existing->id]);
        }

        $conversation = Conversation::create(['is_group' => false]);
        $conversation->users()->attach([$me->id, $other->id]);

        broadcast(new ConversationStarted($conversation))->toOthers();

        return response()->json(['conversation_id' => $conversation->id], 201);
    }

    // ─── Messages ───────────────────────────────────────────────

    /**
     * Get messages for a conversation (paginated).
     */
    public function messages(Request $request, Conversation $conversation): JsonResponse
    {
        // Ensure user is part of this conversation
        if (! $conversation->users()->where('user_id', $request->user()->id)->exists()) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $messages = $conversation->messages()
            ->with('user:id,name')
            ->orderByDesc('created_at')
            ->cursorPaginate(50);

        return response()->json($messages);
    }

    /**
     * Send a message.
     */
    public function sendMessage(Request $request, Conversation $conversation): JsonResponse
    {
        $user = $request->user();

        if (! $conversation->users()->where('user_id', $user->id)->exists()) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $data = $request->validate([
            'body'     => 'required|string|max:5000',
            'type'     => 'nullable|string|in:text,image,file',
            'metadata' => 'nullable|array',
        ]);

        $message = $conversation->messages()->create([
            'user_id'  => $user->id,
            'body'     => $data['body'],
            'type'     => $data['type'] ?? 'text',
            'metadata' => $data['metadata'] ?? null,
        ]);

        $message->load('user:id,name');

        // Mark as read for sender
        $conversation->users()->updateExistingPivot($user->id, [
            'last_read_at' => now(),
        ]);

        // Broadcast to Reverb
        broadcast(new MessageSent($message))->toOthers();

        return response()->json([
            'id'              => $message->id,
            'conversation_id' => $message->conversation_id,
            'user_id'         => $message->user_id,
            'user_name'       => $message->user->name,
            'body'            => $message->body,
            'type'            => $message->type,
            'metadata'        => $message->metadata,
            'created_at'      => $message->created_at->toIso8601String(),
        ], 201);
    }

    /**
     * Mark conversation as read.
     */
    public function markRead(Request $request, Conversation $conversation): JsonResponse
    {
        $conversation->users()->updateExistingPivot($request->user()->id, [
            'last_read_at' => now(),
        ]);

        return response()->json(['status' => 'ok']);
    }

    /**
     * Broadcast typing indicator.
     */
    public function typing(Request $request, Conversation $conversation): JsonResponse
    {
        broadcast(new UserTyping($request->user(), $conversation->id))->toOthers();

        return response()->json(['status' => 'ok']);
    }
}
