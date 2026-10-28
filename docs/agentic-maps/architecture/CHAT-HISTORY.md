---
status: design
last_updated: 2024-12-12
---

# Chat History

> ChatGPT-style session management with collapsible sidebar.

## Overview

Like ChatGPT, users can access previous conversations and their generated areas. Each chat session has a unique ID that enables:
- Resume conversations
- Sync areas to the Chrome extension
- Share results with others

## UI Design: ChatGPT-Style Sidebar

### Collapsed State (Icon Only)

Similar to `leo.casa/dashboard` sidebar:

```
┌────┬──────────────────────────────────────────────────────────────────────────┐
│ ☰  │                                                                          │
│ 📝 │                                                                          │
│ 💬 │                          M A P                                           │
│ 💬 │                                                                          │
│ 💬 │                                                                          │
│ 💬 │                                                                          │
│    │                                                                          │
│ ⚙️ │                                                                          │
└────┴──────────────────────────────────────────────────────────────────────────┘
  │
  └── Icons only, hover for tooltip
```

### Expanded State (Full Text)

Click hamburger or hover to expand:

```
┌────────────────────┬─────────────────────────────────────────────────────────┐
│  🔍 Search chats   │                                                         │
│  ─────────────────│                                                         │
│  📝 New Chat       │                                                         │
│  ─────────────────│                      M A P                              │
│  TODAY             │                                                         │
│  💬 Barcelona stay │                                                         │
│  💬 Tokyo nightli..│                                                         │
│  ─────────────────│                                                         │
│  YESTERDAY         │                                                         │
│  💬 Madrid date n..│                                                         │
│  💬 Paris weekend  │                                                         │
│  ─────────────────│                                                         │
│  LAST 7 DAYS       │                                                         │
│  💬 London pubs    │                                                         │
│  💬 Berlin bars    │                                                         │
│  ─────────────────│                                                         │
│  ⚙️ Settings       │                                                         │
└────────────────────┴─────────────────────────────────────────────────────────┘
```

## Chat Session Data Model

```typescript
interface ChatSession {
  id: string;                    // UUID
  userId: string;                // Owner
  title: string;                 // Auto-generated or user-set
  city: string | null;           // Detected city
  scenario: ScenarioType;        // Which of the 7 scenarios
  createdAt: Date;
  updatedAt: Date;
  
  // Conversation
  messages: ChatMessage[];
  
  // Generated output
  areas: VibeArea[];
  places: Place[];
  route?: MultiStopRoute;        // If scenario 7
  
  // Sync
  extensionSynced: boolean;      // Has extension fetched these areas?
  sharedUrl?: string;            // If user shared this chat
}

interface ChatMessage {
  id: string;
  chatId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolCalls?: ToolCall[];
  createdAt: Date;
}

type ScenarioType = 
  | 'things-to-do'
  | 'where-to-stay'
  | 'stay-and-do'
  | 'single-place'
  | 'meet-in-middle'
  | 'areas-to-explore'
  | 'multi-stop-route';
```

## Auto-Title Generation

Like ChatGPT, titles are auto-generated from the first message:

| First Message | Auto Title |
|---------------|------------|
| "bars in barcelona" | "Barcelona bars" |
| "where to stay tokyo romantic" | "Tokyo romantic stay" |
| "date night madrid" | "Madrid date night" |
| "pub crawl dublin" | "Dublin pub crawl" |
| "road trip barcelona valencia" | "Barcelona → Valencia trip" |

```typescript
const generateTitle = async (firstMessage: string, classification: ClassificationResult): Promise<string> => {
  // Simple heuristic first
  const city = classification.city || classification.cities?.[0];
  const vibe = classification.vibe || classification.occasion;
  
  if (city && vibe) {
    return `${city} ${vibe}`;
  }
  
  // Fall back to AI generation
  const response = await gemini.generateContent(`
    Generate a 2-4 word title for this travel search: "${firstMessage}"
    Just return the title, nothing else.
  `);
  
  return response.text().trim();
};
```

## Database Schema

```sql
-- Chat sessions table
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  title VARCHAR(100),
  city VARCHAR(100),
  scenario VARCHAR(50),
  areas JSONB DEFAULT '[]',
  places JSONB DEFAULT '[]',
  route JSONB,
  extension_synced BOOLEAN DEFAULT FALSE,
  shared_url VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat messages table
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL, -- 'user' | 'assistant' | 'system'
  content TEXT NOT NULL,
  tool_calls JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_chat_sessions_user ON chat_sessions(user_id);
CREATE INDEX idx_chat_sessions_updated ON chat_sessions(updated_at DESC);
CREATE INDEX idx_chat_messages_chat ON chat_messages(chat_id);

-- RLS policies
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chats" ON chat_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own chats" ON chat_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chats" ON chat_sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own chats" ON chat_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- Similar policies for chat_messages...
```

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/chats` | GET | List user's chat sessions |
| `/api/chats` | POST | Create new chat session |
| `/api/chats/:id` | GET | Get chat with messages + areas |
| `/api/chats/:id` | PATCH | Update chat (title, etc.) |
| `/api/chats/:id` | DELETE | Delete chat session |
| `/api/chats/:id/messages` | GET | Get messages for a chat |
| `/api/chats/:id/messages` | POST | Add message to chat |
| `/api/chats/:id/areas` | GET | Get areas only (for extension) |
| `/api/chats/:id/share` | POST | Generate shareable link |

### Example: List Chats

```typescript
// GET /api/chats
export async function GET(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const { data: chats, error } = await supabase
    .from('chat_sessions')
    .select('id, title, city, scenario, created_at, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(50);
  
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  
  // Group by date
  const grouped = groupChatsByDate(chats);
  
  return Response.json(grouped);
}

const groupChatsByDate = (chats: Chat[]) => {
  const now = new Date();
  const today = startOfDay(now);
  const yesterday = subDays(today, 1);
  const weekAgo = subDays(today, 7);
  
  return {
    today: chats.filter(c => new Date(c.updated_at) >= today),
    yesterday: chats.filter(c => {
      const d = new Date(c.updated_at);
      return d >= yesterday && d < today;
    }),
    lastWeek: chats.filter(c => {
      const d = new Date(c.updated_at);
      return d >= weekAgo && d < yesterday;
    }),
    older: chats.filter(c => new Date(c.updated_at) < weekAgo)
  };
};
```

### Example: Get Areas (for Extension)

```typescript
// GET /api/chats/:id/areas
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const { data: chat, error } = await supabase
    .from('chat_sessions')
    .select('id, city, areas, places, route')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();
  
  if (error || !chat) {
    return Response.json({ error: 'Chat not found' }, { status: 404 });
  }
  
  // Mark as synced
  await supabase
    .from('chat_sessions')
    .update({ extension_synced: true })
    .eq('id', params.id);
  
  return Response.json({
    chatId: chat.id,
    city: chat.city,
    areas: chat.areas,
    places: chat.places,
    route: chat.route
  });
}
```

## Component Structure

```tsx
// ChatHistorySidebar.tsx
const ChatHistorySidebar: React.FC = () => {
  const [expanded, setExpanded] = useState(false);
  const [chats, setChats] = useState<GroupedChats | null>(null);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const { actions } = useVibeMaps();
  
  useEffect(() => {
    fetchChats().then(setChats);
  }, []);
  
  const handleChatSelect = async (chatId: string) => {
    setActiveChat(chatId);
    const chat = await fetchChat(chatId);
    actions.loadChat(chat);
  };
  
  return (
    <div 
      className={`h-full bg-gray-900 text-white transition-all duration-300
        ${expanded ? 'w-64' : 'w-12'}`}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      {/* Header */}
      <div className="p-3 border-b border-gray-700">
        {expanded ? (
          <div className="relative">
            <input 
              type="text" 
              placeholder="Search chats..."
              className="w-full bg-gray-800 rounded px-3 py-2 text-sm"
            />
          </div>
        ) : (
          <button className="w-6 h-6">🔍</button>
        )}
      </div>
      
      {/* New Chat Button */}
      <button 
        className={`w-full p-3 flex items-center gap-3 hover:bg-gray-800
          ${expanded ? 'justify-start' : 'justify-center'}`}
        onClick={() => actions.newChat()}
      >
        <span>📝</span>
        {expanded && <span>New Chat</span>}
      </button>
      
      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {chats && Object.entries(chats).map(([group, groupChats]) => (
          groupChats.length > 0 && (
            <div key={group}>
              {expanded && (
                <div className="px-3 py-2 text-xs text-gray-500 uppercase">
                  {group}
                </div>
              )}
              {groupChats.map(chat => (
                <button
                  key={chat.id}
                  className={`w-full p-3 flex items-center gap-3 hover:bg-gray-800
                    ${activeChat === chat.id ? 'bg-gray-800' : ''}
                    ${expanded ? 'justify-start' : 'justify-center'}`}
                  onClick={() => handleChatSelect(chat.id)}
                >
                  <span>💬</span>
                  {expanded && (
                    <span className="truncate text-sm">{chat.title}</span>
                  )}
                </button>
              ))}
            </div>
          )
        ))}
      </div>
      
      {/* Settings */}
      <button 
        className={`w-full p-3 flex items-center gap-3 border-t border-gray-700 hover:bg-gray-800
          ${expanded ? 'justify-start' : 'justify-center'}`}
      >
        <span>⚙️</span>
        {expanded && <span>Settings</span>}
      </button>
    </div>
  );
};
```

## Integration with Main App

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  VibeMapsPage                                                               │
│  ├── ChatHistorySidebar (LEFT - collapsible)                               │
│  ├── ChatPanel (LEFT - conversation)                                       │
│  └── MapContainer (RIGHT)                                                  │
│                                                                             │
│  On chat select:                                                            │
│  1. Load messages into ChatPanel                                           │
│  2. Load areas onto MapContainer                                           │
│  3. Update URL: /vibe-maps?chat=abc123                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### URL-Based Chat Loading

```typescript
// In page.tsx
const VibeMapsPage = () => {
  const searchParams = useSearchParams();
  const chatId = searchParams.get('chat');
  const { actions } = useVibeMaps();
  
  useEffect(() => {
    if (chatId) {
      actions.loadChatById(chatId);
    }
  }, [chatId]);
  
  // ...
};
```

## Sharing

Generate shareable links for chat results:

```typescript
// POST /api/chats/:id/share
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createServerClient();
  
  // Generate unique share ID
  const shareId = nanoid(10);
  const shareUrl = `${BASE_URL}/shared/${shareId}`;
  
  await supabase
    .from('chat_sessions')
    .update({ shared_url: shareUrl })
    .eq('id', params.id);
  
  // Create public snapshot
  await supabase
    .from('shared_chats')
    .insert({
      share_id: shareId,
      chat_id: params.id,
      // Copy relevant data...
    });
  
  return Response.json({ shareUrl });
}
```

---

[← Chat UI](CHAT-UI.md) | [Back to Index](../AGENTIC_MAPS.md) | [Chrome Extension →](CHROME-EXTENSION.md)
