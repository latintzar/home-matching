"use client";
import {appFetch as fetch} from '@/lib/app-path';

import { useState, useCallback, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  Heart,
  Home,
  MapPin,
  Bed,
  Bath,
  Maximize,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  Camera,
  Mic,
  FileText,
  CheckCircle,
  Trash2,
  X,
  Sparkles,
  ExternalLink,
  Expand,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { PhotoGalleryModal } from "@/components/PhotoGalleryModal";

interface Photo {
  id: number;
  url: string;
  caption: string | null;
  display_order: number;
}

interface Note {
  id: string | number;
  note_type: string;
  content: string | null;
  media_url: string | null;
  created_at: string;
}

interface ViewRecord {
  id: number;
  viewing_completed: boolean;
  viewing_completed_at: string | null;
}

interface Agent {
  name: string;
  logo_url: string | null;
  whatsapp: string | null;
}

interface LeanPropertyContentProps {
  fit?:{fitScore:number;topReasons:string[];concerns:string[]};
  listing: Record<string, unknown>;
  photos: Photo[];
  isSaved: boolean;
  savedId: number | null;
  notes: Note[];
  viewRecord: ViewRecord | null;
  agent: Agent | null;
  userId: string | null;
}

export function LeanPropertyContent({
  listing,
  fit,
  photos,
  isSaved: initialIsSaved,
  savedId: initialSavedId,
  notes: initialNotes,
  viewRecord,
  agent,
  userId,
}: LeanPropertyContentProps) {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [isCarouselHovered, setIsCarouselHovered] = useState(false);
  const [isSaved, setIsSaved] = useState(initialIsSaved);
  const [savedId, setSavedId] = useState<number | null>(initialSavedId);
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [newNote, setNewNote] = useState("");
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [viewingCompleted, setViewingCompleted] = useState(viewRecord?.viewing_completed || false);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

  // Listing data
  const price = parseFloat(listing.price_eur as string) || 0;
  const isRental = price < 10000;
  const bedrooms = listing.bedrooms as number || 0;
  const bathrooms = parseFloat(listing.bathrooms as string) || 0;
  const sqm = listing.sqm as number;
  const city = listing.city as string;
  const address = listing.address as string;
  const title = listing.title as string;
  const sourceUrl = listing.source_url as string;
  const description = listing.description as string;

  // Format price
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(price);
  };

  // Photo navigation
  const nextPhoto = useCallback(() => {
    if (photos.length > 0) {
      setCurrentPhotoIndex((prev) => (prev + 1) % photos.length);
    }
  }, [photos.length]);

  const prevPhoto = useCallback(() => {
    if (photos.length > 0) {
      setCurrentPhotoIndex((prev) => (prev - 1 + photos.length) % photos.length);
    }
  }, [photos.length]);

  // Auto-rotate photos when not hovered
  useEffect(() => {
    if (photos.length <= 1 || isCarouselHovered) return;
    const interval = setInterval(() => {
      setCurrentPhotoIndex((prev) => (prev + 1) % photos.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [photos.length, isCarouselHovered]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prevPhoto();
      if (e.key === "ArrowRight") nextPhoto();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nextPhoto, prevPhoto]);

  // Save/unsave property with optimistic update and toast
  const handleToggleSave = async () => {
    if (!userId) {
      toast.error("Inicia sesión para guardar propiedades");
      return;
    }

    // Optimistic update
    const previousSaved = isSaved;
    const previousSavedId = savedId;
    setIsSaved(!isSaved);
    
    if (!previousSaved) {
      toast.success("Propiedad guardada", {
        description: "Puedes verla en tu lista de guardados",
        duration: 3000,
      });
    } else {
      toast("Propiedad eliminada de guardados", { duration: 2000 });
    }

    try {
      if (previousSaved) {
        const res = await fetch(`/api/saved?listingId=${listing.id}`, { method: "DELETE" });
        if (!res.ok) {
          // Revert on error
          setIsSaved(true);
          setSavedId(previousSavedId);
          toast.error("Error al eliminar de guardados");
        } else {
          setSavedId(null);
        }
      } else {
        const res = await fetch("/api/saved", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ listingId: listing.id }),
        });
        const data = await res.json();
        if (!data.isSaved) {
          // Revert on error
          setIsSaved(false);
          toast.error("Error al guardar propiedad");
        } else {
          setSavedId(data.saved?.id || null);
        }
      }
    } catch (error) {
      console.error("Error toggling save:", error);
      // Revert on error
      setIsSaved(previousSaved);
      setSavedId(previousSavedId);
      toast.error("Error de conexión");
    }
  };

  // Open fullscreen gallery
  const handleOpenGallery = (index: number) => {
    setGalleryIndex(index);
    setIsGalleryOpen(true);
  };

  // Add text note
  const handleAddNote = async () => {
    if (!userId || !newNote.trim()) return;

    setIsAddingNote(true);
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId: listing.id,
          content: newNote.trim(),
          noteType: "text",
        }),
      });
      const data = await res.json();
      if (data.note) {
        setNotes([data.note, ...notes]);
        setNewNote("");
      }
    } catch (error) {
      console.error("Error adding note:", error);
    }
    setIsAddingNote(false);
  };

  // Delete note
  const handleDeleteNote = async (noteId: number | string) => {
    try {
      const res = await fetch(`/api/notes?id=${noteId}`, { method: "DELETE" });
      if (res.ok) {
        setNotes(notes.filter((n) => n.id !== noteId));
      }
    } catch (error) {
      console.error("Error deleting note:", error);
    }
  };

  // Mark as viewed
  const handleMarkViewed = async () => {
    if (!userId) return;

    try {
      const res = await fetch("/api/viewings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: listing.id }),
      });
      const data = await res.json();
      if (data.hasViewed) {
        setViewingCompleted(true);
      }
    } catch (error) {
      console.error("Error marking as viewed:", error);
    }
  };

  // Contact agent via WhatsApp
  const handleContactAgent = () => {
    const phone = agent?.whatsapp?.replace(/\D/g, "") || "";
    if(!phone)return;
    const message = `Hola, me interesa la propiedad: ${title}`;
    const url = phone
      ? `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  };

  const fitScore=fit?.fitScore;
  const fitReasons=fit?[...fit.topReasons.map(text=>({good:true,text})),...fit.concerns.map(text=>({good:false,text}))]:[];

  return (
    <div className="min-h-full">
      {/* Main Content - 2 Column Layout */}
      <div className="flex min-h-[calc(100vh-56px)]">
          {/* Left Column: Fit Score + Property Viewer */}
          <div className="flex-1 p-4 lg:p-6 overflow-auto">
            <div className="max-w-3xl mx-auto space-y-4">
              
              {/* Action Bar */}
              <div className="flex items-center justify-between">
                <Link 
                  href="/dashboard"
                  className="flex items-center gap-2 text-stone-600 hover:text-stone-900 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="text-sm font-medium">Volver</span>
                </Link>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleToggleSave}
                    className={`rounded-full ${
                      isSaved ? "bg-rose-50 border-rose-200 text-rose-500" : "border-stone-200"
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${isSaved ? "fill-current" : ""}`} />
                    <span className="ml-1.5 hidden sm:inline">{isSaved ? "Guardado" : "Guardar"}</span>
                  </Button>
                  
                  {sourceUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="rounded-full border-stone-200"
                    >
                      <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4" />
                        <span className="ml-1.5 hidden sm:inline">Original</span>
                      </a>
                    </Button>
                  )}
                </div>
              </div>
              
              {/* Fit Score Card */}
              {fit && <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200/50 rounded-2xl shadow-sm overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="w-5 h-5 text-amber-500" />
                        <h2 className="font-serif text-lg font-medium text-stone-900">
                          Tu Fit Score
                        </h2>
                      </div>
                      <div className="space-y-1.5">
                        {fitReasons.map((reason, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm">
                            {reason.good ? (
                              <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                            ) : (
                              <X className="w-4 h-4 text-amber-500 flex-shrink-0" />
                            )}
                            <span className={reason.good ? "text-stone-700" : "text-stone-500"}>
                              {reason.text}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-4xl font-bold text-amber-600">
                        {fitScore}%
                      </div>
                      <p className="text-xs text-amber-600/70 mt-1">compatibilidad</p>
                    </div>
                  </div>
                </CardContent>
              </Card>}

              {/* Photo Carousel */}
              <div 
                className="relative rounded-2xl overflow-hidden bg-stone-900 aspect-[16/10] cursor-pointer group"
                onMouseEnter={() => setIsCarouselHovered(true)}
                onMouseLeave={() => setIsCarouselHovered(false)}
                onClick={() => photos.length > 0 && handleOpenGallery(currentPhotoIndex)}
              >
                {photos.length > 0 ? (
                  <>
                    <div className="absolute inset-0">
                      <Image
                        src={photos[currentPhotoIndex].url}
                        alt={photos[currentPhotoIndex].caption || title}
                        fill
                        className="object-cover transition-opacity duration-500"
                        sizes="(max-width: 768px) 100vw, 50vw"
                        priority
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                    </div>

                    {/* Expand button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleOpenGallery(currentPhotoIndex); }}
                      className="absolute top-3 right-3 w-10 h-10 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Expand className="w-5 h-5 text-white" />
                    </button>

                    {photos.length > 1 && (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); prevPhoto(); }}
                          className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 rounded-full flex items-center justify-center hover:bg-white transition-all opacity-0 group-hover:opacity-100 hover:scale-105"
                          style={{ opacity: isCarouselHovered ? 1 : 0 }}
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); nextPhoto(); }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 rounded-full flex items-center justify-center hover:bg-white transition-all opacity-0 group-hover:opacity-100 hover:scale-105"
                          style={{ opacity: isCarouselHovered ? 1 : 0 }}
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                        
                        {/* Photo dots */}
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                          {photos.slice(0, 10).map((_, idx) => (
                            <button
                              key={idx}
                              onClick={(e) => { e.stopPropagation(); setCurrentPhotoIndex(idx); }}
                              className={`w-2 h-2 rounded-full transition-all ${
                                idx === currentPhotoIndex 
                                  ? "bg-white w-4" 
                                  : "bg-white/50 hover:bg-white/80"
                              }`}
                            />
                          ))}
                          {photos.length > 10 && (
                            <span className="text-white/70 text-xs ml-1">+{photos.length - 10}</span>
                          )}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-stone-100">
                    <Home className="w-16 h-16 text-stone-300" />
                  </div>
                )}
              </div>

              {/* Property Details */}
              <div className="space-y-4">
                <div>
                  <p className="text-2xl font-semibold text-stone-900">
                    {formatPrice(price)}
                    {isRental && (
                      <span className="text-base font-normal text-stone-500">/mes</span>
                    )}
                  </p>
                  <h1 className="text-lg text-stone-700 mt-1">{title}</h1>
                </div>

                <div className="flex flex-wrap gap-4 text-stone-600">
                  <div className="flex items-center gap-1.5 bg-stone-50 px-3 py-1.5 rounded-full">
                    <Bed className="w-4 h-4" />
                    <span>{bedrooms} hab</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-stone-50 px-3 py-1.5 rounded-full">
                    <Bath className="w-4 h-4" />
                    <span>{Math.floor(bathrooms)} baño</span>
                  </div>
                  {sqm && (
                    <div className="flex items-center gap-1.5 bg-stone-50 px-3 py-1.5 rounded-full">
                      <Maximize className="w-4 h-4" />
                      <span>{sqm}m²</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-stone-500">
                    <MapPin className="w-4 h-4" />
                    <span>{city || address}</span>
                  </div>
                </div>

                {/* Property Description */}
                {description && (
                  <div className="space-y-2">
                    <h3 className="font-medium text-stone-900">Descripción</h3>
                    <p className="text-sm text-stone-600 whitespace-pre-wrap leading-relaxed">
                      {description}
                    </p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <Button
                    onClick={handleContactAgent}
                    disabled={!agent?.whatsapp}
                    className="flex-1 h-12 rounded-xl bg-[#25d366] hover:bg-[#20bd5a] text-white"
                  >
                    <MessageCircle className="w-5 h-5 mr-2" />
                    Quiero verlo
                  </Button>
                  
                  {!viewingCompleted ? (
                    <Button
                      onClick={handleMarkViewed}
                      variant="outline"
                      className="h-12 rounded-xl border-stone-200"
                    >
                      <CheckCircle className="w-5 h-5 mr-2" />
                      Ya la visité
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2 text-green-600 bg-green-50 rounded-xl px-4">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-medium text-sm">Visitada</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Notes */}
          <div className="hidden md:flex w-80 lg:w-96 border-l border-stone-100 flex-col bg-stone-50/50">
            <div className="p-4 border-b border-stone-100 bg-white">
              <h2 className="font-serif text-lg font-medium text-stone-900">
                Mis notas
              </h2>
              <p className="text-sm text-stone-500 mt-0.5">
                Apuntes sobre esta propiedad
              </p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              {/* Add note form */}
              <div className="space-y-3 mb-4">
                <Textarea
                  placeholder="Escribe una nota..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="min-h-[100px] rounded-xl border-stone-200 resize-none bg-white"
                />
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full border-stone-200"
                      disabled
                    >
                      <Camera className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full border-stone-200"
                      disabled
                    >
                      <Mic className="w-4 h-4" />
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleAddNote}
                    disabled={!newNote.trim() || isAddingNote}
                    className="rounded-full"
                  >
                    <FileText className="w-4 h-4 mr-1" />
                    Añadir
                  </Button>
                </div>
              </div>

              {/* Notes list */}
              {notes.length > 0 ? (
                <div className="space-y-3">
                  {notes.map((note) => (
                    <div
                      key={note.id}
                      className="flex items-start justify-between gap-3 p-3 bg-white rounded-xl shadow-sm"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-stone-700">{note.content}</p>
                        <p className="text-xs text-stone-400 mt-1.5">
                          {new Date(note.created_at).toLocaleDateString("es-ES", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-stone-400 hover:text-rose-500 flex-shrink-0"
                        onClick={() => handleDeleteNote(note.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="w-10 h-10 text-stone-300 mx-auto mb-2" />
                  <p className="text-sm text-stone-400">
                    Aún no tienes notas
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      
      {/* Mobile Notes FAB - Shows on mobile only */}
      <div className="lg:hidden fixed bottom-4 right-4">
        <Button
          className="h-14 w-14 rounded-full shadow-lg"
          onClick={() => {
            // TODO: Open mobile notes sheet
          }}
        >
          <FileText className="w-6 h-6" />
        </Button>
      </div>

      {/* Fullscreen Photo Gallery */}
      <PhotoGalleryModal
        isOpen={isGalleryOpen}
        onClose={() => setIsGalleryOpen(false)}
        photos={photos.map((p) => ({ url: p.url, tag: p.caption || undefined }))}
        currentIndex={galleryIndex}
        onNavigate={setGalleryIndex}
      />
    </div>
  );
}
