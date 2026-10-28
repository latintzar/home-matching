import ClientSideScraper from '@/components/ClientSideScraper';
import BookmarkletGenerator from '@/components/BookmarkletGenerator';
import ExtensionDownload from '@/components/ExtensionDownload';

export default function ClientScraperPage() {
  return (
    <div className="container mx-auto py-10 space-y-12">
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold tracking-tight mb-3">Leo.casa Extraction Tools</h1>
        <p className="text-muted-foreground text-lg">
           Choose your preferred method to extract property data from restricted platforms.
        </p>
      </div>

      <div className="max-w-3xl mx-auto">
         <ExtensionDownload />
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">Alternative Methods</span>
        </div>
      </div>
      
      <div className="grid gap-8 md:grid-cols-2">
         <BookmarkletGenerator />
         <ClientSideScraper />
      </div>
    </div>
  );
}


