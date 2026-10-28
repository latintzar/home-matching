'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

interface LifestyleFormProps {
  onProfileGenerated: (profile: any) => void;
}

export function LifestyleForm({ onProfileGenerated }: LifestyleFormProps) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/lifestyle/extract-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (data.success) {
        onProfileGenerated(data.profile);
      } else {
        alert('Error: ' + data.error);
      }
    } catch (err) {
      alert('Failed to extract profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Your Lifestyle Profile</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Textarea
            placeholder="Tell me about your life. Where do you work? How do you commute? What amenities do you need nearby? (e.g. 'I work at Puerta del Sol, commit by metro max 30 mins. I need a gym and specialty coffee nearby.')"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-h-[150px]"
          />
          <Button type="submit" disabled={loading || !text.trim()} className="w-full">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Analyze Profile
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

