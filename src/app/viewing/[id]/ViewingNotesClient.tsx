'use client';
import {appFetch as fetch} from '@/lib/app-path';

/**
 * ViewingNotesClient
 * 
 * Client component for taking notes during property viewings.
 * Supports both authenticated users and pro clients via token.
 */

import React, { useState, useEffect, useCallback } from 'react';

interface ViewingNote {
  id: string;
  category: 'pro' | 'con' | 'question' | 'general';
  text: string;
  timestamp: string;
}

interface ViewingNotesClientProps {
  listingId: string;
  token?: string;
}

const CATEGORY_CONFIG = {
  pro: { emoji: '✅', label: 'A favor', color: 'emerald' },
  con: { emoji: '❌', label: 'En contra', color: 'red' },
  question: { emoji: '❓', label: 'Preguntar', color: 'amber' },
  general: { emoji: '📝', label: 'General', color: 'gray' },
};

export function ViewingNotesClient({ listingId, token }: ViewingNotesClientProps) {
  const [notes, setNotes] = useState<ViewingNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [category, setCategory] = useState<ViewingNote['category']>('general');
  const [listingTitle, setListingTitle] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load existing notes
  useEffect(() => {
    const loadNotes = async () => {
      try {
        const url = token 
          ? `/api/viewing/${listingId}/notes?token=${token}`
          : `/api/viewing/${listingId}/notes`;
        
        const res = await fetch(url);
        const data = await res.json();
        
        if (data.success) {
          setNotes(data.notes || []);
          setListingTitle(data.listingTitle || `Propiedad ${listingId}`);
        }
      } catch (err) {
        console.error('Error loading notes:', err);
      } finally {
        setLoading(false);
      }
    };

    loadNotes();
  }, [listingId, token]);

  // Save note
  const handleAddNote = useCallback(async () => {
    if (!newNote.trim()) return;
    
    setSaving(true);
    const note: ViewingNote = {
      id: crypto.randomUUID(),
      category,
      text: newNote.trim(),
      timestamp: new Date().toISOString(),
    };

    try {
      const url = token 
        ? `/api/viewing/${listingId}/notes?token=${token}`
        : `/api/viewing/${listingId}/notes`;
      
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      });
      
      setNotes(prev => [note, ...prev]);
      setNewNote('');
    } catch (err) {
      console.error('Error saving note:', err);
    } finally {
      setSaving(false);
    }
  }, [listingId, token, newNote, category]);

  // Delete note
  const handleDeleteNote = useCallback(async (noteId: string) => {
    try {
      const url = token 
        ? `/api/viewing/${listingId}/notes/${noteId}?token=${token}`
        : `/api/viewing/${listingId}/notes/${noteId}`;
      
      await fetch(url, { method: 'DELETE' });
      setNotes(prev => prev.filter(n => n.id !== noteId));
    } catch (err) {
      console.error('Error deleting note:', err);
    }
  }, [listingId, token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-1">
            📋 Notas de la visita
          </h1>
          <p className="text-gray-600 text-sm">{listingTitle}</p>
        </div>

        {/* Quick Add Section */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          {/* Category Selector */}
          <div className="flex gap-2 mb-3">
            {(Object.keys(CATEGORY_CONFIG) as ViewingNote['category'][]).map((cat) => {
              const config = CATEGORY_CONFIG[cat];
              return (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                    category === cat
                      ? `bg-${config.color}-100 text-${config.color}-700 ring-2 ring-${config.color}-500`
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  style={{
                    backgroundColor: category === cat 
                      ? config.color === 'emerald' ? '#d1fae5' 
                        : config.color === 'red' ? '#fee2e2'
                        : config.color === 'amber' ? '#fef3c7'
                        : '#f3f4f6'
                      : undefined,
                    color: category === cat
                      ? config.color === 'emerald' ? '#047857'
                        : config.color === 'red' ? '#dc2626'
                        : config.color === 'amber' ? '#d97706'
                        : '#374151'
                      : undefined
                  }}
                >
                  {config.emoji} {config.label}
                </button>
              );
            })}
          </div>

          {/* Note Input */}
          <div className="flex gap-2">
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Escribe tu nota aquí..."
              className="flex-1 p-3 border border-gray-200 rounded-lg resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              rows={2}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleAddNote();
                }
              }}
            />
            <button
              onClick={handleAddNote}
              disabled={!newNote.trim() || saving}
              className="px-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? '...' : '➕'}
            </button>
          </div>
        </div>

        {/* Notes List */}
        <div className="space-y-3">
          {notes.length > 0 ? (
            notes.map((note) => {
              const config = CATEGORY_CONFIG[note.category];
              return (
                <div 
                  key={note.id} 
                  className="bg-white rounded-lg shadow-sm p-4 flex items-start gap-3"
                >
                  <span className="text-xl">{config.emoji}</span>
                  <div className="flex-1">
                    <p className="text-gray-800">{note.text}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(note.timestamp).toLocaleString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteNote(note.id)}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                    aria-label="Eliminar nota"
                  >
                    🗑️
                  </button>
                </div>
              );
            })
          ) : (
            <div className="text-center py-12 text-gray-500">
              <div className="text-4xl mb-2">📝</div>
              <p>Aún no hay notas</p>
              <p className="text-sm">Añade tu primera impresión arriba</p>
            </div>
          )}
        </div>

        {/* Summary Section */}
        {notes.length > 0 && (
          <div className="mt-8 bg-white rounded-xl shadow-sm p-4">
            <h2 className="font-semibold text-gray-700 mb-3">📊 Resumen</h2>
            <div className="grid grid-cols-4 gap-2 text-center text-sm">
              {(Object.keys(CATEGORY_CONFIG) as ViewingNote['category'][]).map((cat) => {
                const config = CATEGORY_CONFIG[cat];
                const count = notes.filter(n => n.category === cat).length;
                return (
                  <div key={cat} className="bg-gray-50 rounded-lg p-2">
                    <div className="text-lg">{config.emoji}</div>
                    <div className="font-bold text-gray-800">{count}</div>
                    <div className="text-xs text-gray-500">{config.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Powered by Leo 🏠</p>
        </div>
      </div>
    </div>
  );
}

