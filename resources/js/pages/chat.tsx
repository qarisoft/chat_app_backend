import { Head, usePage } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import { chat } from '@/routes';
import { useEffect, useState, useRef } from 'react';
import { echo } from '@laravel/echo-react';
import { Send, MessageSquare } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export default function Chat() {
    const { auth } = usePage<any>().props;
    const currentUser = auth.user;

    const [conversations, setConversations] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [activeConversation, setActiveConversation] = useState<any>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [typingUsers, setTypingUsers] = useState<{ [userId: number]: { name: string, timeout: any } }>({});
    const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const lastTypedRef = useRef<number>(0);

    const fetchConversations = () => {
        fetch('/api/chat/conversations', { headers: { 'Accept': 'application/json' } })
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setConversations(data);
            });
    };

    // Fetch initial data
    useEffect(() => {
        fetchConversations();
        
        fetch('/api/chat/users', { headers: { 'Accept': 'application/json' } })
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setUsers(data);
            });
    }, []);

    // Fetch messages when conversation changes
    useEffect(() => {
        if (activeConversation) {
            fetch(`/api/chat/conversations/${activeConversation.id}/messages`, { headers: { 'Accept': 'application/json' } })
                .then(res => res.json())
                .then(data => {
                    if (data && data.data) {
                        setMessages(data.data.reverse()); // paginated is desc, reverse to asc
                    }
                });
        } else {
            setMessages([]);
        }
    }, [activeConversation]);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Real-time listener for current conversation
    useEffect(() => {
        if (!activeConversation) return;

        setTypingUsers({});
        setOnlineUsers([]);

        const instance = echo();
        const channelName = `conversation.${activeConversation.id}`;

        const channel = instance.join(channelName)
            .here((users: any[]) => {
                setOnlineUsers(users);
            })
            .joining((user: any) => {
                setOnlineUsers(prev => {
                    if (prev.find(u => u.id === user.id)) return prev;
                    return [...prev, user];
                });
            })
            .leaving((user: any) => {
                setOnlineUsers(prev => prev.filter(u => u.id !== user.id));
            })
            .listen('.message.sent', (payload: any) => {
                if (payload.conversation_id === activeConversation.id) {
                    setMessages(prev => [...prev, payload]);
                    
                    // Immediately clear typing indicator for this user when message is received
                    setTypingUsers(prev => {
                        if (prev[payload.user_id]?.timeout) {
                            clearTimeout(prev[payload.user_id].timeout);
                        }
                        const newState = { ...prev };
                        delete newState[payload.user_id];
                        return newState;
                    });
                }
            })
            .listenForWhisper('typing', (e: any) => {
                setTypingUsers(prev => {
                    if (prev[e.user_id]?.timeout) {
                        clearTimeout(prev[e.user_id].timeout);
                    }
                    
                    const timeout = setTimeout(() => {
                        setTypingUsers(current => {
                            const newState = { ...current };
                            delete newState[e.user_id];
                            return newState;
                        });
                    }, 2000);

                    return {
                        ...prev,
                        [e.user_id]: { name: e.user_name, timeout }
                    };
                });
            });

        return () => {
            instance.leave(channelName);
            setTypingUsers(prev => {
                Object.values(prev).forEach(u => clearTimeout(u.timeout));
                return {};
            });
        };
    }, [activeConversation]);

    // Global listener for new conversations & messages to update the sidebar
    useEffect(() => {
        if (!currentUser) return;

        const instance = echo();
        const userChannelName = `App.Models.User.${currentUser.id}`;

        instance.private(userChannelName)
            .listen('.conversation.started', () => {
                fetchConversations();
            })
            .listen('.message.sent', () => {
                fetchConversations();
            });

        return () => {
            instance.leave(userChannelName);
        };
    }, [currentUser]);

    const startConversation = async (userId: number) => {
        const res = await fetch('/api/chat/conversations', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ user_id: userId })
        });
        const data = await res.json();
        if (data.conversation_id) {
            fetch('/api/chat/conversations', { headers: { 'Accept': 'application/json' } })
                .then(res => res.json())
                .then(convs => {
                    if (Array.isArray(convs)) {
                        setConversations(convs);
                        const conv = convs.find(c => c.id === data.conversation_id);
                        if (conv) setActiveConversation(conv);
                    }
                });
        }
    };

    const handleTyping = (val: string) => {
        setNewMessage(val);

        const now = Date.now();
        if (now - lastTypedRef.current > 1000 && activeConversation) {
            lastTypedRef.current = now;
            echo().join(`conversation.${activeConversation.id}`)
                .whisper('typing', {
                    user_id: currentUser.id,
                    user_name: currentUser.name
                });
        }
    };

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !activeConversation) return;

        const body = newMessage;
        setNewMessage('');

        await fetch(`/api/chat/conversations/${activeConversation.id}/messages`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ body })
        });
    };

    const otherOnlineUsers = onlineUsers.filter(u => u.id !== currentUser.id);
    const isOnline = otherOnlineUsers.length > 0;

    return (
        <>
            <Head title="Chat" />
            <div className="flex h-[calc(100vh-theme(spacing.20))] md:h-[calc(100vh-theme(spacing.16))] flex-1 gap-4 p-4 overflow-hidden">
                {/* Left Sidebar */}
                <div className="flex flex-col w-full md:w-80 bg-background border rounded-xl overflow-hidden shadow-sm shrink-0">
                    <div className="p-4 border-b bg-muted/30">
                        <h2 className="text-xl font-semibold tracking-tight">Messages</h2>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        <div className="p-2 space-y-1">
                            {conversations.map(conv => (
                                <button
                                    key={conv.id}
                                    onClick={() => setActiveConversation(conv)}
                                    className={`w-full flex items-center gap-3 p-3 text-left rounded-lg transition-colors ${activeConversation?.id === conv.id ? 'bg-primary text-primary-foreground shadow-md' : 'hover:bg-muted/60'}`}
                                >
                                    <Avatar className={`h-11 w-11 border-2 ${activeConversation?.id === conv.id ? 'border-primary-foreground/30' : 'border-background shadow-sm'}`}>
                                        <AvatarFallback className={activeConversation?.id === conv.id ? 'text-primary' : 'bg-primary/10 text-primary'}>
                                            {conv.name?.[0]?.toUpperCase() || 'U'}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 overflow-hidden">
                                        <div className="font-medium truncate">{conv.name || 'Chat'}</div>
                                        <div className={`text-xs truncate mt-0.5 ${activeConversation?.id === conv.id ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                                            {conv.latest_message ? conv.latest_message.body : 'No messages yet'}
                                        </div>
                                    </div>
                                    {conv.unread_count > 0 && (
                                        <div className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${activeConversation?.id === conv.id ? 'bg-primary-foreground text-primary' : 'bg-primary text-primary-foreground'}`}>
                                            {conv.unread_count}
                                        </div>
                                    )}
                                </button>
                            ))}
                            {conversations.length === 0 && (
                                <div className="p-8 flex flex-col items-center justify-center text-center text-muted-foreground">
                                    <MessageSquare className="h-8 w-8 mb-3 opacity-20" />
                                    <p className="text-sm">No conversations yet.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Main Chat Area */}
                <div className={`flex flex-col flex-1 bg-background border rounded-xl overflow-hidden shadow-sm ${!activeConversation ? 'hidden md:flex' : 'flex'}`}>
                    {activeConversation ? (
                        <>
                            <div className="flex items-center p-4 border-b bg-background shadow-sm z-10">
                                <Avatar className="h-10 w-10 mr-3 border shadow-sm">
                                    <AvatarFallback className="bg-primary/10 text-primary">{activeConversation.name?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <h3 className="font-semibold text-foreground">{activeConversation.name || 'Chat'}</h3>
                                    <p className="text-xs text-muted-foreground">
                                        {Object.keys(typingUsers).length > 0 
                                            ? <span className="animate-pulse text-primary">{Object.values(typingUsers).map(u => u.name).join(', ')} is typing...</span>
                                            : isOnline 
                                                ? <span className="text-green-500 font-medium">Online</span> 
                                                : <span>Offline</span>}
                                    </p>
                                </div>
                            </div>
                            
                            <div className="flex-1 p-4 overflow-y-auto bg-slate-50/50 dark:bg-slate-900/10">
                                <div className="space-y-4 max-w-3xl mx-auto">
                                    {messages.map((msg, idx) => {
                                        const isMe = msg.user_id === currentUser.id;
                                        return (
                                            <div key={msg.id || idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                                                <div className="flex items-end gap-2 max-w-[85%] md:max-w-[70%]">
                                                    {!isMe && (
                                                        <Avatar className="h-8 w-8 mb-1 border shadow-sm">
                                                            <AvatarFallback className="text-xs bg-primary/10">{msg.user_name?.[0]}</AvatarFallback>
                                                        </Avatar>
                                                    )}
                                                    <div className={`px-4 py-2.5 rounded-2xl shadow-sm ${isMe ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-white dark:bg-slate-800 border rounded-bl-sm'}`}>
                                                        <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{msg.body}</p>
                                                    </div>
                                                </div>
                                                <span className={`text-[10px] text-muted-foreground mt-1.5 ${isMe ? 'mr-1' : 'ml-11'}`}>
                                                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        );
                                    })}
                                    <div ref={messagesEndRef} className="h-1" />
                                </div>
                            </div>

                            <div className="p-4 bg-background border-t">
                                <form onSubmit={sendMessage} className="flex gap-3 max-w-3xl mx-auto relative items-end">
                                    <Input
                                        value={newMessage}
                                        onChange={(e) => handleTyping(e.target.value)}
                                        placeholder="Type your message..."
                                        className="flex-1 rounded-2xl px-5 py-6 bg-muted/30 border-muted/60 focus-visible:ring-primary focus-visible:bg-background transition-all resize-none pr-14"
                                        autoComplete="off"
                                    />
                                    <Button 
                                        type="submit" 
                                        size="icon" 
                                        className="absolute right-2 bottom-2 rounded-xl h-10 w-10 shrink-0 shadow-sm transition-transform active:scale-95" 
                                        disabled={!newMessage.trim()}
                                    >
                                        <Send className="h-4 w-4 ml-0.5" />
                                        <span className="sr-only">Send</span>
                                    </Button>
                                </form>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full bg-slate-50/50 dark:bg-slate-900/10 text-center p-8 animate-in fade-in zoom-in-95 duration-500">
                            <div className="bg-primary/10 p-5 rounded-full mb-6 shadow-inner">
                                <MessageSquare className="h-10 w-10 text-primary" />
                            </div>
                            <h3 className="text-2xl font-semibold mb-3 tracking-tight">Select a Conversation</h3>
                            <p className="text-muted-foreground mb-10 max-w-md leading-relaxed">
                                Choose an existing conversation from the sidebar or start a new one with an available user below.
                            </p>
                            
                            <div className="w-full max-w-md bg-background border rounded-xl overflow-hidden shadow-sm">
                                <div className="p-4 border-b bg-muted/20 font-medium text-sm text-left flex justify-between items-center">
                                    <span>Available Users</span>
                                    <span className="bg-primary/10 text-primary text-[10px] px-2 py-0.5 rounded-full font-bold">{users.length}</span>
                                </div>
                                <div className="max-h-64 overflow-y-auto p-2">
                                    {users.length > 0 ? users.map(user => (
                                        <div
                                            key={user.id}
                                            onClick={() => startConversation(user.id)}
                                            role="button"
                                            className="w-full flex items-center gap-4 p-3 hover:bg-muted/60 rounded-lg transition-colors text-left group cursor-pointer"
                                        >
                                            <Avatar className="h-10 w-10 border shadow-sm group-hover:border-primary/20 transition-colors">
                                                <AvatarFallback className="text-sm bg-primary/5 text-primary">{user.name?.[0]?.toUpperCase()}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1">
                                                <div className="text-sm font-semibold">{user.name}</div>
                                                <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                                            </div>
                                            <Button asChild variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity rounded-full h-8 px-3 text-xs bg-primary/10 hover:bg-primary/20 text-primary">
                                                <span>Message</span>
                                            </Button>
                                        </div>
                                    )) : (
                                        <div className="p-8 text-center text-muted-foreground text-sm">
                                            No other users found.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

Chat.layout = (page: React.ReactNode) => (
    <AppLayout breadcrumbs={[{ title: 'Chat', href: chat() }]}>
        {page}
    </AppLayout>
);
