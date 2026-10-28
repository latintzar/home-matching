"use client";

import { useState } from "react";
import { 
  Plus, 
  ThumbsUp, 
  ThumbsDown, 
  AlertCircle, 
  HelpCircle,
  MessageSquare,
  Camera,
  Send,
  X,
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { NonProEvents } from "@/lib/analytics";

interface Note {
  id: string;
  timestamp: string;
  category: "general" | "positive" | "concern" | "question" | "must_verify";
  content: string;
  photo_urls?: string[];
}

interface ViewingNotesProps {
  viewingId: string;
  notes: Note[];
  onNoteAdded?: (note: Note) => void;
  readOnly?: boolean;
  className?: string;
}

const CATEGORIES = [
  { id: "positive", label: "Me gusta", icon: ThumbsUp, color: "text-green-600 bg-green-100" },
  { id: "concern", label: "Preocupación", icon: ThumbsDown, color: "text-red-600 bg-red-100" },
  { id: "question", label: "Pregunta", icon: HelpCircle, color: "text-blue-600 bg-blue-100" },
  { id: "must_verify", label: "Verificar", icon: AlertCircle, color: "text-yellow-600 bg-yellow-100" },
  { id: "general", label: "Nota", icon: MessageSquare, color: "text-stone-600 bg-stone-100" },
] as const;

export function ViewingNotes({
  viewingId,
  notes,
  onNoteAdded,
  readOnly = false,
  className,
}: ViewingNotesProps) {
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Note["category"]>("general");
  const [noteContent, setNoteContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddNote = async () => {
    if (!noteContent.trim()) return;
    
    setIsSubmitting(true);
    
    try {
      const supabase = getSupabaseBrowser();
      
      // Call the add_viewing_note function
      const { data, error } = await supabase.rpc("add_viewing_note", {
        p_viewing_id: viewingId,
        p_category: selectedCategory,
        p_content: noteContent.trim(),
      });
      
      if (error) throw error;
      
      // Track analytics
      NonProEvents.noteAdded(viewingId, selectedCategory);
      
      // Notify parent
      if (onNoteAdded && data) {
        onNoteAdded(data as Note);
      }
      
      // Reset form
      setNoteContent("");
      setIsAddingNote(false);
      setSelectedCategory("general");
    } catch (error) {
      console.error("Error adding note:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getCategoryConfig = (category: Note["category"]) => {
    return CATEGORIES.find(c => c.id === category) || CATEGORIES[4];
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString("es-ES", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-stone-900">Notas de visita</h3>
        {!readOnly && !isAddingNote && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsAddingNote(true)}
            className="text-stone-600"
          >
            <Plus className="w-4 h-4 mr-1" />
            Añadir nota
          </Button>
        )}
      </div>

      {/* Add Note Form */}
      {isAddingNote && (
        <div className="bg-stone-50 rounded-xl p-4 space-y-4 animate-in fade-in duration-200">
          {/* Category selector */}
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id as Note["category"])}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors",
                    isSelected ? cat.color : "bg-white text-stone-600 hover:bg-stone-100"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {cat.label}
                </button>
              );
            })}
          </div>
          
          {/* Note input */}
          <Textarea
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            placeholder="Escribe tu nota aquí..."
            className="min-h-[100px] resize-none rounded-xl border-stone-200"
            autoFocus
          />
          
          {/* Actions */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              className="text-stone-500"
              disabled={isSubmitting}
            >
              <Camera className="w-4 h-4 mr-1" />
              Foto
            </Button>
            
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsAddingNote(false);
                  setNoteContent("");
                }}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleAddNote}
                disabled={!noteContent.trim() || isSubmitting}
                className="bg-stone-900 text-white hover:bg-stone-800"
              >
                {isSubmitting ? (
                  "Guardando..."
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-1" />
                    Guardar
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Notes List */}
      {notes.length === 0 ? (
        <p className="text-sm text-stone-500 text-center py-8">
          {readOnly 
            ? "No hay notas todavía" 
            : "Añade notas durante o después de la visita"}
        </p>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => {
            const config = getCategoryConfig(note.category);
            const Icon = config.icon;
            
            return (
              <div 
                key={note.id}
                className="bg-white rounded-xl border border-stone-100 p-4"
              >
                <div className="flex items-start gap-3">
                  <div className={cn("p-2 rounded-lg", config.color)}>
                    <Icon className="w-4 h-4" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-stone-700">
                        {config.label}
                      </span>
                      <span className="text-xs text-stone-400">
                        {formatTimestamp(note.timestamp)}
                      </span>
                    </div>
                    <p className="text-stone-600 whitespace-pre-wrap">
                      {note.content}
                    </p>
                    
                    {/* Photos if any */}
                    {note.photo_urls && note.photo_urls.length > 0 && (
                      <div className="flex gap-2 mt-3">
                        {note.photo_urls.map((url, i) => (
                          <img
                            key={i}
                            src={url}
                            alt=""
                            className="w-20 h-20 object-cover rounded-lg"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Quick note buttons for mobile during viewing
export function QuickNoteButtons({
  viewingId,
  onNoteAdded,
}: {
  viewingId: string;
  onNoteAdded?: (note: Note) => void;
}) {
  const [activeQuickNote, setActiveQuickNote] = useState<string | null>(null);

  const quickNotes = [
    { emoji: "👍", label: "Me gusta", category: "positive" as const },
    { emoji: "🤔", label: "Preocupación", category: "concern" as const },
    { emoji: "❓", label: "Pregunta", category: "question" as const },
    { emoji: "⚠️", label: "Verificar", category: "must_verify" as const },
  ];

  return (
    <div className="fixed bottom-0 inset-x-0 bg-white border-t border-stone-100 px-4 py-3 safe-area-pb">
      <div className="flex justify-around max-w-md mx-auto">
        {quickNotes.map((qn) => (
          <button
            key={qn.category}
            onClick={() => setActiveQuickNote(qn.category)}
            className="flex flex-col items-center gap-1"
          >
            <span className="text-2xl">{qn.emoji}</span>
            <span className="text-xs text-stone-600">{qn.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

