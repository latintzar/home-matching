'use client';
import {appFetch as fetch} from '@/lib/app-path';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, Bookmark } from 'lucide-react';

export default function BookmarkletGenerator() {
  const [copied, setCopied] = React.useState(false);

  // The bookmarklet code
  // Note: We use process.env.NEXT_PUBLIC_SITE_URL or fall back to localhost
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  
  const scriptCode = `
    (function() {
      const API_URL = '${origin}/api/storeListing';
      
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;top:20px;right:20px;z-index:999999;background:#1a1a1a;color:white;padding:20px;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,0.5);font-family:sans-serif;width:300px;text-align:left;';
      overlay.innerHTML = '<h3 style="margin:0 0 10px;font-size:16px;">🏠 Puedo Casa Extractor</h3><div id="pc-status" style="font-size:14px;color:#ccc;">Initializing...</div>';
      document.body.appendChild(overlay);

      function log(msg) {
        const el = document.getElementById('pc-status');
        if(el) el.innerHTML += '<div style="margin-top:5px;">' + msg + '</div>';
        console.log('[PuedoCasa]', msg);
      }

      async function run() {
        try {
          log('🔍 extracting html...');
          const html = document.documentElement.outerHTML;
          
          log('📸 processing images...');
          const imgEls = Array.from(document.querySelectorAll('img'));
          const urls = imgEls.map(img => img.src).filter(src => src && !src.startsWith('data:'));
          const uniqueUrls = [...new Set(urls)];
          
          log('found ' + uniqueUrls.length + ' images. converting...');
          
          const images = [];
          let processed = 0;
          
          for (const url of uniqueUrls) {
             try {
               const resp = await fetch(url);
               const blob = await resp.blob();
               const reader = new FileReader();
               const base64 = await new Promise(resolve => {
                 reader.onloadend = () => resolve(reader.result);
                 reader.readAsDataURL(blob);
               });
               images.push(base64);
             } catch(e) {}
             processed++;
             if(processed % 5 === 0) log('processed ' + processed + '/' + uniqueUrls.length);
          }

          log('🚀 uploading to puedo casa...');
          
          const payload = {
            url: window.location.href,
            html: html,
            images: images,
            timestamp: Date.now(),
            userId: null
          };

          const res = await fetch(API_URL, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
          });

          if(res.ok) {
            log('✅ SUCCESS! Listing Saved.');
            setTimeout(() => overlay.remove(), 3000);
          } else {
            const txt = await res.text();
            log('❌ Error: ' + res.status);
            console.error(txt);
          }

        } catch (e) {
          log('❌ Fatal Error: ' + e.message);
        }
      }

      run();
    })();
  `;

  // Minify the script code slightly for the href
  const bookmarkletHref = `javascript:${encodeURIComponent(scriptCode.replace(/\s+/g, ' ').trim())}`;

  return (
    <Card className="w-full max-w-4xl mx-auto mt-8 border-orange-200 bg-orange-50/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
            <Bookmark className="h-5 w-5 text-orange-500" />
            The "Universal" Bookmarklet Solution
        </CardTitle>
        <CardDescription>
            Since major platforms (Idealista, Fotocasa) strictly block iframes, the most reliable "Client-Side" method is to run the extractor <strong>directly on their page</strong>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="bg-white p-6 rounded-xl border-2 border-dashed border-orange-200 text-center">
            <p className="mb-4 text-sm text-muted-foreground font-medium">
                Drag this button to your Browser Bookmarks Bar:
            </p>
            
            <a 
                href={bookmarkletHref}
                className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-6 rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95 cursor-move"
                title="Drag me to your bookmarks bar"
                onClick={(e) => e.preventDefault()} // Prevent clicking
            >
                🏠 Save to Puedo Casa
            </a>

            <p className="mt-4 text-xs text-muted-foreground">
                (Don't click it here - drag it to the bar below the URL address)
            </p>
        </div>

        <div className="space-y-2">
            <h3 className="font-semibold text-sm">How to use:</h3>
            <ol className="list-decimal list-inside text-sm text-slate-600 space-y-1">
                <li>Go to <strong>Idealista</strong>, <strong>Fotocasa</strong>, or any other site in a new tab.</li>
                <li>Navigate to the property listing you want.</li>
                <li>Click the <strong>"Save to Puedo Casa"</strong> bookmark in your toolbar.</li>
                <li>A black status box will appear, extract the data, and upload it to your dashboard.</li>
            </ol>
        </div>
      </CardContent>
    </Card>
  );
}

