// Client Profile Page
// Route: /pro/clients/[id]

import { getCurrentUser, getAuthRedirect } from '@/lib/auth-helpers';
import { redirect } from 'next/navigation';
import { ClientProfileClient } from './ClientProfileClient';

export const metadata = {
  title: 'Cliente | Leo Pro',
  description: 'Perfil del cliente',
};

export default async function ClientProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  const { id } = await params;
  
  if (!user) {
    redirect(getAuthRedirect(`/pro/clients/${id}`));
  }

  return <ClientProfileClient clientId={id} user={user} />;
}

