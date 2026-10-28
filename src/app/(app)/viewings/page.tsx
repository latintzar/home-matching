import { Metadata } from "next";
import Link from "next/link";
import { Calendar, Home, Clock, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getSupabaseServer } from "@/lib/supabase-server";

export const metadata: Metadata = {
  title: "Visitas | Leo.casa",
  description: "Tus visitas programadas",
};

export default async function ViewingsPage() {
  const user = await getCurrentUser();
  const supabase = await getSupabaseServer();

  // Fetch property views (properties marked as viewed)
  const { data: views } = await supabase
    .from("property_views")
    .select(`
      id,
      viewed_at,
      viewing_completed,
      viewing_completed_at,
      listing_id,
      listings (
        id,
        title,
        price_eur,
        city,
        address
      )
    `)
    .eq("user_id", user?.id)
    .order("viewed_at", { ascending: false });

  const viewsList = views || [];

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-serif text-2xl md:text-3xl font-medium text-stone-900 mb-1">
          Mis Visitas
        </h1>
        <p className="text-stone-600">
          Propiedades que has visitado o marcado para visitar
        </p>
      </div>

      {/* Viewings List */}
      {viewsList.length > 0 ? (
        <div className="space-y-4">
          {viewsList.map((view) => {
            // Supabase join can return array or single object
            const rawListings = view.listings as unknown;
            const listing = (Array.isArray(rawListings) ? rawListings[0] : rawListings) as { id: string; title: string; price_eur: string; city: string; address: string } | null;
            if (!listing) return null;

            return (
              <Link key={view.id} href={`/property/${listing.id}`}>
                <Card className="bg-white border-stone-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-12 h-12 bg-stone-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Home className="w-6 h-6 text-stone-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-stone-900 truncate">
                        {listing.title}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-stone-500">
                        <MapPin className="w-4 h-4" />
                        <span className="truncate">{listing.city}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="flex items-center gap-1 text-sm text-stone-500">
                        <Clock className="w-4 h-4" />
                        <span>
                          {new Intl.DateTimeFormat("es-ES", {
                            day: "numeric",
                            month: "short",
                          }).format(new Date(view.viewed_at))}
                        </span>
                      </div>
                      {view.viewing_completed && (
                        <span className="text-xs text-green-600 font-medium">
                          ✓ Visitado
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <Card className="bg-white border-stone-100 rounded-2xl shadow-sm">
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-blue-400" />
            </div>
            <h3 className="font-medium text-stone-900 mb-2">
              No tienes visitas registradas
            </h3>
            <p className="text-sm text-stone-500 mb-4">
              Cuando visites una propiedad, podrás registrarla aquí y añadir tus notas
            </p>
            <Button asChild className="rounded-full">
              <Link href="/recommend">
                Ver recomendaciones
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

