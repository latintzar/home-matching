import {notFound} from 'next/navigation';
import { getDictionary, type Locale, locales } from '@/lib/i18n';
import { LandingPageClient } from './LandingPageClient';

export async function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

interface LangPageProps {
  params: Promise<{ lang: string }>;
}

export default async function LangPage({ params }: LangPageProps) {
  const {lang:rawLang}=await params;
  if(!locales.includes(rawLang as Locale))notFound();
  const lang=rawLang as Locale;
  const dict = getDictionary(lang);
  
  return <LandingPageClient locale={lang} dictionary={dict} />;
}

