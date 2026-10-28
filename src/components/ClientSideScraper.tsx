'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, ShieldAlert, CheckCircle, RefreshCcw, Eye, Play } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const TEST_DOMAINS = [
  'idealista.com',
  'fotocasa.es',
  'savills.es',
  'lucasfox.es',
  'engelvoelkers.com',
  'remax.es',
  'century21.es',
  'donpiso.com',
  'tecnocasa.es',
  'inmoweb.es',
  'habitaclia.com'
];

export default function ClientSideScraper() {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'extracting' | 'uploading' | 'success' | 'error' | 'captcha'>('idle');
  const [logs, setLogs] = useState<string[]>([]);
  const [isCaptchaModalOpen, setIsCaptchaModalOpen] = useState(false);
  const [testingIndex, setTestingIndex] = useState<number | null>(null);
  
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Auto-scroll logs
  const logsContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const addLog = (msg: string) => setLogs(prev => [...prev, `${new Date().toLocaleTimeString()} - ${msg}`]);

  const resetIframe = (targetUrl: string) => {
    if (iframeRef.current) {
      iframeRef.current.src = 'about:blank';
      setTimeout(() => {
        if (iframeRef.current) {
            iframeRef.current.src = targetUrl;
        }
      }, 100);
    }
  };

  const handleAnalyze = async (overrideUrl?: string) => {
    const targetUrl = overrideUrl || url;
    if (!targetUrl) return;
    
    setStatus('loading');
    if (!overrideUrl) setLogs([]); // Only clear logs if manual run
    addLog(`Starting analysis for: ${targetUrl}`);
    
    resetIframe(targetUrl);
  };

  const handleTestAll = async () => {
    setLogs([]);
    addLog('🚀 Starting Connectivity Test for all known domains...');
    setTestingIndex(0);
  };

  useEffect(() => {
    if (testingIndex !== null && testingIndex < TEST_DOMAINS.length) {
      const domain = TEST_DOMAINS[testingIndex];
      const testUrl = `https://www.${domain}`;
      setUrl(testUrl);
      addLog(`\n--- Testing ${domain} ---`);
      handleAnalyze(testUrl);
    } else if (testingIndex === TEST_DOMAINS.length) {
      addLog('✅ All domains tested.');
      setTestingIndex(null);
      setStatus('idle');
    }
  }, [testingIndex]);

  const proceedToNextTest = () => {
    if (testingIndex !== null) {
      setTestingIndex(prev => (prev !== null ? prev + 1 : null));
    }
  };

  const handleIframeLoad = async () => {
    // Ignore initial blank load
    if (iframeRef.current?.src === 'about:blank') return;
    
    // Only process if we are expecting a load
    if (status !== 'loading' && status !== 'captcha') return;
    
    try {
      addLog('Iframe loaded event fired. Checking access...');
      
      const iframe = iframeRef.current;
      if (!iframe) throw new Error('Iframe reference missing');

      let doc: Document | null = null;
      try {
        doc = iframe.contentDocument || iframe.contentWindow?.document || null;
      } catch (e) {
        addLog('⚠️ Access blocked (CORS/X-Frame-Options). Possible Captcha or Anti-Bot protection.');
        setStatus('captcha');
        setIsCaptchaModalOpen(true);
        // Don't throw immediately, let the user decide if they want to solve it
        return; 
      }
      
      if (!doc) {
        // This usually means blocked by X-Frame-Options
        addLog('⚠️ Document is null. Blocked by X-Frame-Options?');
        setStatus('captcha');
        // Do NOT auto-open modal if we are just testing, unless we want to pause
        // For mass testing, maybe just log and move on?
        // But user requested modal logic.
        setIsCaptchaModalOpen(true);
        return;
      }

      setStatus('extracting');
      const fullHTML = doc.documentElement.outerHTML;
      addLog(`HTML extracted. Length: ${fullHTML.length} chars`);

      // Extract images
      const imgEls = Array.from(doc.querySelectorAll('img'));
      addLog(`Found ${imgEls.length} image elements.`);

      const imageUrls = imgEls
        .map(img => img.getAttribute('src'))
        .filter(src => src && !src.startsWith('data:'))
        .map(src => {
            // Fix: Use the actual current URL being tested or the input URL
            const currentUrl = testingIndex !== null && testingIndex < TEST_DOMAINS.length 
                ? `https://www.${TEST_DOMAINS[testingIndex]}` 
                : url;
            
            if (src && !src.startsWith('http') && !src.startsWith('//')) {
                try {
                    return new URL(src, currentUrl).href;
                } catch (e) {
                    return null;
                }
            }
            if (src && src.startsWith('//')) {
                return `https:${src}`;
            }
            return src;
        })
        .filter(Boolean) as string[];
      
      const uniqueUrls = Array.from(new Set(imageUrls));
      addLog(`Processing ${uniqueUrls.length} unique images...`);

      // If testing, we stop here
      if (testingIndex !== null) {
        addLog(`✅ Connectivity confirmed for ${TEST_DOMAINS[testingIndex]}`);
        setTimeout(proceedToNextTest, 2000); // Increased delay to 2s
        return;
      }

      const base64Images = await Promise.all(
        uniqueUrls.map(async (imgUrl) => {
          try {
            const response = await fetch(imgUrl);
            const blob = await response.blob();
            return new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
            });
          } catch (err) {
            // silent fail for individual images
            return null;
          }
        })
      );

      const validImages = base64Images.filter(Boolean) as string[];
      addLog(`Successfully converted ${validImages.length} images.`);

      // Upload
      setStatus('uploading');
      addLog('Uploading payload to server...');

      const payload = {
        url,
        html: fullHTML,
        images: validImages,
        timestamp: Date.now(),
        userId: null 
      };

      const payloadStr = JSON.stringify(payload);
      const sizeInBytes = new TextEncoder().encode(payloadStr).length;
      const sizeInMB = sizeInBytes / (1024 * 1024);
      
      if (sizeInMB > 4.0) {
        addLog(`⚠️ Warning: Payload size is ${sizeInMB.toFixed(2)}MB.`);
      }

      const res = await fetch('/api/storeListing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payloadStr,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      setStatus('success');
      addLog('Successfully stored listing in Supabase! ID: ' + (await res.json()).id || 'Stored');

    } catch (err: any) {
      console.error(err);
      setStatus('error');
      addLog(`Error: ${err.message}`);
      // If we failed during test, move next
      if (testingIndex !== null) {
        // Fix: Ensure we don't crash if index is out of bounds
        const domain = testingIndex < TEST_DOMAINS.length ? TEST_DOMAINS[testingIndex] : 'unknown';
        addLog(`❌ Failed test for ${domain}`);
        setTimeout(proceedToNextTest, 1000);
      }
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4 notranslate" translate="no">
      <Card>
        <CardHeader>
          <CardTitle>Client-Side Scraper & Connectivity Test</CardTitle>
          <CardDescription>
            Extracts HTML and Images client-side. Tests connectivity to known domains.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="url">Property URL</Label>
            <div className="flex gap-2">
              <Input 
                id="url" 
                placeholder="https://www.idealista.com/..." 
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={status === 'loading' || status === 'extracting' || status === 'uploading' || testingIndex !== null}
              />
              <Button 
                onClick={() => handleAnalyze()}
                disabled={!url || status === 'loading' || status === 'extracting' || status === 'uploading' || testingIndex !== null}
              >
                {status === 'loading' || status === 'extracting' || status === 'uploading' ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing</>
                ) : (
                  'Analyze'
                )}
              </Button>
            </div>
            <div className="flex gap-2 mt-2">
               <Button 
                variant="secondary" 
                size="sm" 
                onClick={handleTestAll}
                disabled={status !== 'idle' && status !== 'error' && status !== 'success'}
               >
                 <Play className="mr-2 h-4 w-4" /> Test All Domains
               </Button>
               <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setIsCaptchaModalOpen(true)}
               >
                 <Eye className="mr-2 h-4 w-4" /> Show Iframe / Captcha
               </Button>
            </div>
          </div>

          {/* Status Console */}
          <div 
            ref={logsContainerRef}
            className="bg-slate-950 text-slate-50 p-4 rounded-md text-sm font-mono h-64 overflow-y-auto border border-slate-800"
          >
            {logs.length === 0 && <span className="text-slate-500">Ready...</span>}
            {logs.map((log, i) => (
                <div key={i} className="mb-1 border-b border-slate-900/50 pb-1 last:border-0 break-all">{log}</div>
            ))}
            {status === 'error' && <div className="text-red-400 font-bold mt-2">❌ Process Failed</div>}
            {status === 'success' && <div className="text-green-400 font-bold mt-2">✅ Process Complete</div>}
          </div>

          {/* Hidden Iframe (Always mounted to maintain state) */}
          <div className="w-0 h-0 overflow-hidden">
            {!isCaptchaModalOpen && (
             <iframe 
                ref={iframeRef}
                style={{ width: '100%', height: '100%', border: 'none' }}
                sandbox="allow-same-origin allow-scripts allow-forms"
                onLoad={handleIframeLoad}
                title="scraping-frame"
            />
            )}
          </div>

        </CardContent>
      </Card>

      {/* Captcha / Blocked Modal */}
      <Dialog open={isCaptchaModalOpen} onOpenChange={setIsCaptchaModalOpen}>
        <DialogContent className="max-w-5xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-orange-500" />
              Security Check / Connection View
            </DialogTitle>
            <DialogDescription>
              If you see a Captcha, solve it. If the screen is blank/error, the site blocks iframes.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 border rounded-md overflow-hidden bg-white relative">
             <div className="absolute inset-0 flex items-center justify-center text-muted-foreground z-0">
                Loading target site...
             </div>
             {isCaptchaModalOpen && (
                <iframe 
                    src={url}
                    className="w-full h-full relative z-10"
                    // Removed allow-scripts when showing captcha modal to prevent reload loops
                    // Idealista and others use JS to force reload or break out of frames
                    // However, we NEED scripts to solve captcha usually... 
                    // Let's try restrictive sandbox first.
                    sandbox="allow-forms allow-popups allow-modals allow-same-origin allow-scripts"
                />
             )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="secondary" onClick={() => {
                setIsCaptchaModalOpen(false);
                // If we were testing, skip this one
                if (testingIndex !== null) proceedToNextTest();
            }}>
                Skip / Cancel
            </Button>
            <Button onClick={() => {
                setIsCaptchaModalOpen(false);
                // Trigger analysis again (assuming cookie is set)
                handleAnalyze();
            }}>
                <CheckCircle className="mr-2 h-4 w-4" />
                I solved it, Retry
            </Button>
             <Button variant="outline" onClick={() => {
                 const currentUrl = testingIndex !== null ? `https://www.${TEST_DOMAINS[testingIndex]}` : url;
                 if (currentUrl) {
                    const win = window.open(currentUrl, '_blank');
                    win?.focus();
                 }
            }}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                Open in New Tab (Fallback)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
