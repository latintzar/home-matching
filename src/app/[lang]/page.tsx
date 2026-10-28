import { getDictionary, type Locale, locales } from '@/lib/i18n';
import { LandingPageClient } from './LandingPageClient';

export async function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

interface LangPageProps {
  params: Promise<{ lang: Locale }>;
}

export default async function LangPage({ params }: LangPageProps) {
  const { lang } = await params;
  const dict = getDictionary(lang);
  
  return <LandingPageClient locale={lang} dictionary={dict} />;
}

