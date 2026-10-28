// Pro Dashboard Page
// Route: /pro/dashboard

import { getCurrentUser, getAuthRedirect } from '@/lib/auth-helpers';
import { redirect } from 'next/navigation';
import { ProDashboardClient } from './ProDashboardClient';

export const metadata = {
  title: 'Dashboard | Leo Pro',
  description: 'Gestiona tus clientes y propiedades',
};

export default async function ProDashboardPage() {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect(getAuthRedirect('/pro/dashboard'));
  }

  return <ProDashboardClient user={user} />;
}

