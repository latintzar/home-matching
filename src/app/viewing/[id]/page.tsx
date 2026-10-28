// Viewing Notes Page
// Route: /viewing/[id]?token=[optional]
// Used by both direct users (authenticated) and pro clients (via token)

import { ViewingNotesClient } from './ViewingNotesClient';

export const metadata = {
  title: 'Notas de la visita | Leo',
  description: 'Toma notas durante tu visita al piso',
};

export default async function ViewingNotesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { id } = await params;
  const { token } = await searchParams;
  
  return <ViewingNotesClient listingId={id} token={token} />;
}

