import {notFound} from 'next/navigation';
import { getDictionary, type Locale, locales } from '@/lib/i18n';
import type { Metadata } from 'next';

export async function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ lang: string }>
}): Promise<Metadata> {
  const {lang:rawLang}=await params;
  if(!locales.includes(rawLang as Locale))notFound();
  const lang=rawLang as Locale;
  const dict = getDictionary(lang);

  return {
    title: lang === 'es' ? 'Leo - Tu próximo piso, encontrado' : 'Leo - Your next flat, found',
    description: dict.renters.hero.subcopy,
    alternates: {
      languages: {
        es: '/es',
        en: '/en',
      },
    },
  };
}

interface LangLayoutProps {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}

export default async function LangLayout({ children, params }: LangLayoutProps) {
  const {lang:rawLang}=await params;
  if(!locales.includes(rawLang as Locale))notFound();
  const lang=rawLang as Locale;

  return (
    <html lang={lang}>
      <body>
        {children}
      </body>
    </html>
  );
}

