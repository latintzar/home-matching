'use client';

import { useState } from 'react';
import type { ChatSession } from './types';

interface ChatHistorySidebarProps {
  sessions: ChatSession[];
  activeSessionId?: string;
  onSessionSelect: (sessionId: string) => void;
  onNewChat: () => void;
}

export default function ChatHistorySidebar({
  sessions,
  activeSessionId,
  onSessionSelect,
  onNewChat,
}: ChatHistorySidebarProps) {
  const [expanded, setExpanded] = useState(false);

  // Group sessions by date
  const groupedSessions = groupByDate(sessions);

  return (
    <div
      className={`h-full bg-[#0A0A0A] border-r border-gray-800 flex flex-col transition-all duration-300 ease-in-out ${
        expanded ? 'w-64' : 'w-14'
      }`}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      {/* Header - Hamburger / Search */}
      <div className="p-3 border-b border-gray-800">
        {expanded ? (
          <div className="relative">
            <input
              type="text"
              placeholder="Search chats..."
              className="w-full bg-[#1A1A1A] border border-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-700"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600">🔍</span>
          </div>
        ) : (
          <button 
            className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-white transition-colors"
            aria-label="Toggle sidebar"
          >
            ☰
          </button>
        )}
      </div>

      {/* New Chat Button */}
      <button
        onClick={onNewChat}
        className={`flex items-center gap-3 p-3 hover:bg-white/5 transition-colors border-b border-gray-800 ${
          expanded ? 'justify-start' : 'justify-center'
        }`}
      >
        <span className="text-lg">📝</span>
        {expanded && <span className="text-white text-sm font-medium">New Chat</span>}
      </button>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {Object.entries(groupedSessions).map(([group, groupSessions]) =>
          groupSessions.length > 0 && (
            <div key={group}>
              {expanded && (
                <div className="px-3 py-2 text-[10px] text-gray-600 uppercase tracking-wider">
                  {group}
                </div>
              )}
              {groupSessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => onSessionSelect(session.id)}
                  className={`w-full flex items-center gap-3 p-3 hover:bg-white/5 transition-colors ${
                    activeSessionId === session.id ? 'bg-white/10' : ''
                  } ${expanded ? 'justify-start' : 'justify-center'}`}
                  title={session.title}
                >
                  <span className="text-gray-500">💬</span>
                  {expanded && (
                    <span className="text-gray-400 text-sm truncate flex-1 text-left">
                      {session.title}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )
        )}

        {sessions.length === 0 && expanded && (
          <div className="p-4 text-center text-gray-600 text-sm">
            No chat history yet
          </div>
        )}
      </div>

      {/* Settings */}
      <button
        className={`flex items-center gap-3 p-3 border-t border-gray-800 hover:bg-white/5 transition-colors ${
          expanded ? 'justify-start' : 'justify-center'
        }`}
      >
        <span className="text-gray-500">⚙️</span>
        {expanded && <span className="text-gray-400 text-sm">Settings</span>}
      </button>
    </div>
  );
}

// Helper function to group sessions by date
function groupByDate(sessions: ChatSession[]): Record<string, ChatSession[]> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  const groups: Record<string, ChatSession[]> = {
    Today: [],
    Yesterday: [],
    'Last 7 Days': [],
    Older: [],
  };

  sessions.forEach((session) => {
    const sessionDate = new Date(session.updatedAt);
    if (sessionDate >= today) {
      groups.Today.push(session);
    } else if (sessionDate >= yesterday) {
      groups.Yesterday.push(session);
    } else if (sessionDate >= weekAgo) {
      groups['Last 7 Days'].push(session);
    } else {
      groups.Older.push(session);
    }
  });

  return groups;
}

