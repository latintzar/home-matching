'use client';

import dynamic from 'next/dynamic';
import { ListingEditorSkeleton } from '@/components/manual-entry/ListingEditorSkeleton';
const ListingEditor = dynamic(() => import('@/components/manual-entry/ListingEditor'), {
  loading: () => <ListingEditorSkeleton />,
  ssr: false
});

export default function AddPropertyPage() {
  return <ListingEditor />;
}

