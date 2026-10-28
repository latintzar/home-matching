import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Chrome, Puzzle } from 'lucide-react';

export default function ExtensionDownload() {
  return (
    <Card className="w-full border-orange-200 bg-orange-50/30">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-orange-600 flex items-center justify-center text-white">
               <Puzzle className="h-6 w-6" />
            </div>
            <div>
                <CardTitle>Leo.casa Browser Extension</CardTitle>
                <CardDescription>
                    The official extraction tool. Adds an "Analyse with Leo" button directly to property listings.
                </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-white p-6 rounded-xl border border-orange-100 shadow-sm space-y-4">
             <div className="flex items-start gap-3 text-sm text-slate-600">
                <span className="font-bold text-slate-900 mt-0.5">1.</span>
                <p>Download the <strong>Leo.casa Extension .zip</strong> file.</p>
             </div>
             <div className="flex items-start gap-3 text-sm text-slate-600">
                <span className="font-bold text-slate-900 mt-0.5">2.</span>
                <p>Unzip it to a folder on your computer.</p>
             </div>
             <div className="flex items-start gap-3 text-sm text-slate-600">
                <span className="font-bold text-slate-900 mt-0.5">3.</span>
                <p>
                    Go to <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800">chrome://extensions</code> in your browser.
                    <br/>
                    Turn on <strong>Developer Mode</strong> (top right).
                </p>
             </div>
             <div className="flex items-start gap-3 text-sm text-slate-600">
                <span className="font-bold text-slate-900 mt-0.5">4.</span>
                <p>Click <strong>Load Unpacked</strong> and select your unzipped folder.</p>
             </div>
          </div>

          <a 
              href="/extension.zip" 
              download="leo-casa-extension.zip"
              className="flex w-full items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-6 rounded-lg shadow-md transition-all active:scale-95"
            >
              <Download className="h-5 w-5" />
              Download Extension Package
          </a>
          
          <p className="text-xs text-center text-muted-foreground">
             Version 1.0.1 • Manifest V3 • Secure & Private
          </p>
        </CardContent>
    </Card>
  );
}

