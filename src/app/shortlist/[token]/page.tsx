// Public Shortlist Page (for client sharing)
// Route: /shortlist/[token]
// No auth required - accessed via secure token

import { PublicShortlistClient } from './PublicShortlistClient';

export const metadata = {
  title: 'Tu Shortlist | Leo',
  description: 'Los pisos que tu agente ha seleccionado para ti',
};

export default async function PublicShortlistPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  
  // In production, would fetch shortlist data by token from database
  // For now, pass token to client component
  return <PublicShortlistClient token={token} />;
}

