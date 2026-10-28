
"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { X, Loader2, AlertCircle, CheckCircle, AlertTriangle } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { supabase } from "@/lib/supabase";

interface PersonaliseRenovationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listingId: string;
  onStrategiesGenerated?: () => void; // Callback to refresh tiers
}

export function PersonaliseRenovationModal({
  open,
  onOpenChange,
  listingId,
  onStrategiesGenerated
}: PersonaliseRenovationModalProps) {
  const [budget, setBudget] = useState<number>(50000);
  const [directives, setDirectives] = useState<string>("");
  // Removed fixed style preference state
  // const [stylePreference, setStylePreference] = useState<string>("Modern/Neutral");
  const [styleImageUrl, setStyleImageUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const [feedback, setFeedback] = useState<{
    status: 'loading' | 'red' | 'yellow' | 'green' | null;
    message: string;
    assessment: string;
  }>({ status: null, message: '', assessment: '' });
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedBudget = useDebounce(budget, 500);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${listingId}/style-refs/${Date.now()}.${fileExt}`;
      const filePath = `renovation-style-refs/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('renovation-assets')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data } = supabase.storage
        .from('renovation-assets')
        .getPublicUrl(filePath);

      setStyleImageUrl(data.publicUrl);
    } catch (error) {
      console.error('Error uploading image:', error);
      setError('Failed to upload image. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  // Check budget against baseline when budget changes (debounced)
  useEffect(() => {
    if (!open || !listingId) return;

    const checkBudget = async () => {
      setFeedback(prev => ({ ...prev, status: 'loading' }));
      try {
        const response = await fetch(`/api/listings/${listingId}/renovation/check-budget`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_budget: debouncedBudget })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            setFeedback({
              status: data.data.traffic_light,
              message: data.data.feedback,
              assessment: data.data.assessment
            });
          }
        } else {
            // Silent fail or generic message if baseline not ready
             setFeedback({ status: null, message: '', assessment: '' });
        }
      } catch (error) {
        console.error("Error checking budget:", error);
        setFeedback({ status: null, message: '', assessment: '' });
      }
    };

    checkBudget();
  }, [debouncedBudget, listingId, open]);

  const handleSubmit = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      // Trigger the full Orchestration (Upgrade) with user directives
      // NOTE: Ideally we call orchestrate-renovation, but that's SSE.
      // For a simple blocking call here, we might want to call unified-strategy first, 
      // then let the user know "We are designing your tiers...".
      
      // Let's call the orchestrator and just wait for it to start/finish? 
      // Actually, calling unified-strategy directly gives faster feedback for the "Strategy" part.
      // But we need the whole pipeline (Scope, Visuals) to update the UI fully.
      
      // Let's start by calling the Orchestrator in a way that updates the DB.
      // Since orchestrator is SSE, we can fetch it and read the stream, or just fire and forget.
      // For better UX, let's just call the strategy endpoint first to validate, then trigger the rest.
      
      // Actually, let's trigger the full orchestrator but treat it as a "Job Started".
      // Since this is a mock UI, we can simulate "Regenerating..."
      
      const response = await fetch(`/api/listings/${listingId}/orchestrate-renovation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userDirectives: {
            budget: budget,
            directives: directives,
            styleImageUrl: styleImageUrl || null
          }
        })
      });
      
      if (!response.ok) throw new Error("Failed to start renovation engine");
      
      // In a real app, we'd show a progress bar here reading the SSE stream.
      // For now, let's just assume it takes a few seconds for the Strategy part to be ready?
      // Actually, let's just close and tell the user "Designing..."
      
      // Wait for at least the strategy to be defined?
      // Let's just wait 2 seconds for "Submission" effect.
      await new Promise(resolve => setTimeout(resolve, 2000));

      onOpenChange(false);
      if (onStrategiesGenerated) onStrategiesGenerated();
      
      // Trigger a toast or alert: "Renovation designs are being updated!"
      alert("Renovation Engine Started! Your custom tiers are being generated.");

    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-semibold">Personalise Your Renovation</DialogTitle>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <DialogDescription>
            Adjust the budget and tell us your preferences. Our AI Architect will redesign the 3 tiers for you.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          
          {/* Budget Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="budget" className="text-base font-medium">Total Budget Target</Label>
            </div>
            
            <div className="flex items-center gap-4">
              <Slider
                id="budget"
                min={10000}
                max={300000}
                step={1000}
                value={[budget]}
                onValueChange={(val) => setBudget(val[0])}
                className="flex-1 py-4"
              />
              <Input
                type="number"
                min={10000}
                max={300000}
                step={1000}
                value={budget}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val) && val >= 10000 && val <= 300000) {
                    setBudget(val);
                  }
                }}
                className="w-32 font-mono"
              />
            </div>
            
            <div className="text-right">
              <span className="text-lg font-bold font-mono">€{budget.toLocaleString()}</span>
            </div>
            
            {/* Feedback Box */}
            <div className={`rounded-md p-3 border text-sm flex items-start gap-3 transition-colors ${
              feedback.status === 'loading' ? 'bg-gray-50 border-gray-200 text-gray-500' :
              feedback.status === 'green' ? 'bg-green-50 border-green-200 text-green-800' :
              feedback.status === 'yellow' ? 'bg-yellow-50 border-yellow-200 text-yellow-800' :
              feedback.status === 'red' ? 'bg-red-50 border-red-200 text-red-800' :
              'bg-gray-50 border-gray-200 text-gray-500'
            }`}>
              {feedback.status === 'loading' ? <Loader2 className="h-4 w-4 animate-spin mt-0.5" /> :
               feedback.status === 'green' ? <CheckCircle className="h-4 w-4 mt-0.5" /> :
               feedback.status === 'yellow' ? <AlertTriangle className="h-4 w-4 mt-0.5" /> :
               feedback.status === 'red' ? <AlertCircle className="h-4 w-4 mt-0.5" /> :
               <div className="h-4 w-4" />}
              
              <div>
                <span className="font-semibold block mb-1">
                  {feedback.status === 'loading' ? 'Analyzing market rates...' : 
                   feedback.assessment || 'Budget Check'}
                </span>
                <p className="opacity-90">
                  {feedback.message || "Set a budget to see feasibility."}
                </p>
              </div>
            </div>
          </div>

          {/* Style Reference Upload */}
          <div className="space-y-2">
            <Label htmlFor="style-upload">Style References (Optional)</Label>
            <div className="flex items-center gap-4">
              <Input
                id="style-upload"
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={isUploading}
                className="flex-1"
              />
              {isUploading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            {styleImageUrl && (
              <div className="mt-2 relative w-full h-32 rounded-md overflow-hidden border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={styleImageUrl} 
                  alt="Style Reference" 
                  className="object-cover w-full h-full"
                />
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute top-1 right-1 h-6 w-6"
                  onClick={() => setStyleImageUrl(null)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Upload a photo of a style you love. Our AI will analyze it.
            </p>
          </div>

          {/* Directives */}
          <div className="space-y-2">
            <Label htmlFor="directives">What would you like to change?</Label>
            <Textarea
              id="directives"
              placeholder="e.g. I want an open kitchen, remove the bidet, add an ensuite..."
              value={directives}
              onChange={(e) => setDirectives(e.target.value)}
              className="h-24 resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Tell the AI Architect what matters most to you.
            </p>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
              Error: {error}
            </div>
          )}

        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isGenerating}>
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Designing...
              </>
            ) : (
              'Update Renovation'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

