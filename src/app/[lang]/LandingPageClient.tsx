"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { ArrowRight, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RentersContent } from "@/components/landing/RentersContent";
import { BuyersContent } from "@/components/landing/BuyersContent";
import { BuyerAgentsContent } from "@/components/landing/BuyerAgentsContent";
import { RelocationContent } from "@/components/landing/RelocationContent";
import type { Persona } from "@/components/landing/content-data";
import { cn } from "@/lib/utils";
import { LanguageToggle } from "@/components/LanguageToggle";
import { DictionaryProvider } from "@/contexts/DictionaryContext";
import type { Locale } from "@/lib/i18n";
import type { Dictionary } from "@/lib/i18n";

type ConsumerPersona = 'renters' | 'buyers';
type ProfessionalPersona = 'buyer-agents' | 'relocation';

interface LandingPageClientProps {
  locale: Locale;
  dictionary: Dictionary;
}

export function LandingPageClient({ locale, dictionary }: LandingPageClientProps) {
  const [consumerPersona, setConsumerPersona] = useState<ConsumerPersona>('renters');
  const [professionalPersona, setProfessionalPersona] = useState<ProfessionalPersona>('buyer-agents');
  const [isProfessionalView, setIsProfessionalView] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const t = dictionary; // Shorthand for dictionary

  // Handle scroll for nav background
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Scroll to professionals section
  const scrollToProfessionals = () => {
    setIsProfessionalView(true);
    setTimeout(() => {
      document.getElementById("professionals")?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  // Handle nav link clicks
  const handleNavClick = (persona?: Persona) => {
    if (persona === 'renters' || persona === 'buyers') {
      setIsProfessionalView(false);
      setConsumerPersona(persona);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    setMobileMenuOpen(false);
  };

  // Determine which content to show
  const renderContent = () => {
    if (isProfessionalView) {
      return professionalPersona === 'buyer-agents' 
        ? <BuyerAgentsContent /> 
        : <RelocationContent />;
    }
    return consumerPersona === 'renters' 
      ? <RentersContent onProLinkClick={scrollToProfessionals} /> 
      : <BuyersContent onProLinkClick={scrollToProfessionals} />;
  };

  // Localized nav labels from dictionary
  const navLabels = {
    howLeoWorks: t.shared.nav.howLeoWorks,
    forRenters: t.shared.nav.forRenters,
    forBuyers: t.shared.nav.forBuyers,
    forProfessionals: t.shared.nav.forProfessionals,
    signIn: t.shared.nav.signIn,
    talkToLeo: t.shared.nav.talkToLeo,
    renting: t.shared.toggle.renting,
    buying: t.shared.toggle.buying,
    buyerAgents: t.shared.toggle.buyerAgents,
    relocation: t.shared.toggle.relocation,
  };

  return (
    <DictionaryProvider dictionary={t} locale={locale}>
    <div className="min-h-screen bg-[#FDFBF7] text-stone-900 font-sans selection:bg-stone-200">
      {/* Navigation */}
      <header 
        className={cn(
          "fixed top-0 w-full z-50 transition-all duration-300",
          scrolled 
            ? "bg-[#FDFBF7]/95 backdrop-blur-md border-b border-stone-100 shadow-sm" 
            : "bg-transparent"
        )}
      >
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <button 
            onClick={() => {
              setIsProfessionalView(false);
              setConsumerPersona('renters');
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="font-serif text-xl font-medium tracking-tight cursor-pointer hover:text-stone-600 transition-colors"
          >
            {t.shared.nav.logo}
          </button>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-6">
            <a href="#how-it-works" className="text-sm text-stone-600 hover:text-stone-900 transition-colors">
              {navLabels.howLeoWorks}
            </a>
            <button 
              onClick={() => handleNavClick('renters')}
              className={cn(
                "text-sm transition-colors",
                !isProfessionalView && consumerPersona === 'renters' 
                  ? "text-stone-900 font-medium" 
                  : "text-stone-600 hover:text-stone-900"
              )}
            >
              {navLabels.forRenters}
            </button>
            <button 
              onClick={() => handleNavClick('buyers')}
              className={cn(
                "text-sm transition-colors",
                !isProfessionalView && consumerPersona === 'buyers' 
                  ? "text-stone-900 font-medium" 
                  : "text-stone-600 hover:text-stone-900"
              )}
            >
              {navLabels.forBuyers}
            </button>
            <a 
              href="#professionals" 
              onClick={(e) => {
                e.preventDefault();
                scrollToProfessionals();
              }}
              className={cn(
                "text-sm transition-colors",
                isProfessionalView 
                  ? "text-stone-900 font-medium" 
                  : "text-stone-600 hover:text-stone-900"
              )}
            >
              {navLabels.forProfessionals}
            </a>
          </nav>

          {/* Desktop Right Side */}
          <div className="hidden md:flex items-center gap-4">
            <LanguageToggle currentLocale={locale} />
            <Button 
              asChild 
              variant="ghost" 
              className="text-sm text-stone-600 hover:text-stone-900 hover:bg-transparent"
            >
              <Link href="/login">{navLabels.signIn}</Link>
            </Button>
            <Button 
              className="rounded-full px-5 bg-stone-900 hover:bg-stone-800 text-white shadow-md shadow-stone-900/10"
            >
              {navLabels.talkToLeo} <ArrowRight className="ml-1 w-4 h-4" />
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            <LanguageToggle currentLocale={locale} />
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 -mr-2 text-stone-600 hover:text-stone-900"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden absolute top-16 left-0 right-0 bg-[#FDFBF7] border-b border-stone-100 shadow-lg animate-in slide-in-from-top-2 duration-200">
            <nav className="px-6 py-4 space-y-3">
              <a 
                href="#how-it-works" 
                onClick={() => setMobileMenuOpen(false)}
                className="block text-sm text-stone-600 hover:text-stone-900 py-2"
              >
                {navLabels.howLeoWorks}
              </a>
              <button 
                onClick={() => handleNavClick('renters')}
                className={cn(
                  "block w-full text-left text-sm py-2",
                  !isProfessionalView && consumerPersona === 'renters' 
                    ? "text-stone-900 font-medium" 
                    : "text-stone-600"
                )}
              >
                {navLabels.forRenters}
              </button>
              <button 
                onClick={() => handleNavClick('buyers')}
                className={cn(
                  "block w-full text-left text-sm py-2",
                  !isProfessionalView && consumerPersona === 'buyers' 
                    ? "text-stone-900 font-medium" 
                    : "text-stone-600"
                )}
              >
                {navLabels.forBuyers}
              </button>
              <button 
                onClick={() => {
                  scrollToProfessionals();
                  setMobileMenuOpen(false);
                }}
                className={cn(
                  "block w-full text-left text-sm py-2",
                  isProfessionalView 
                    ? "text-stone-900 font-medium" 
                    : "text-stone-600"
                )}
              >
                {navLabels.forProfessionals}
              </button>
              <div className="pt-4 border-t border-stone-100 space-y-3">
                <Link 
                  href="/login" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="block text-sm text-stone-600 hover:text-stone-900 py-2"
                >
                  {navLabels.signIn}
                </Link>
                <Button 
                  className="w-full rounded-full bg-stone-900 hover:bg-stone-800 text-white"
                >
                  {navLabels.talkToLeo} <ArrowRight className="ml-1 w-4 h-4" />
                </Button>
              </div>
            </nav>
          </div>
        )}
      </header>

      {/* Persona Toggle - Fixed pill that changes based on view */}
      <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40">
        <div className="bg-white/80 backdrop-blur-md p-1 rounded-full shadow-lg border border-stone-200/50 flex items-center">
          {!isProfessionalView ? (
            <>
              <button 
                onClick={() => setConsumerPersona('renters')}
                className={cn(
                  "px-5 py-2 text-sm font-medium rounded-full transition-all duration-300",
                  consumerPersona === 'renters' 
                    ? "bg-stone-900 text-white shadow-sm" 
                    : "text-stone-500 hover:text-stone-900"
                )}
              >
                {navLabels.renting}
              </button>
              <button 
                onClick={() => setConsumerPersona('buyers')}
                className={cn(
                  "px-5 py-2 text-sm font-medium rounded-full transition-all duration-300",
                  consumerPersona === 'buyers' 
                    ? "bg-stone-900 text-white shadow-sm" 
                    : "text-stone-500 hover:text-stone-900"
                )}
              >
                {navLabels.buying}
              </button>
            </>
          ) : (
            <>
              <button 
                onClick={() => setProfessionalPersona('buyer-agents')}
                className={cn(
                  "px-5 py-2 text-sm font-medium rounded-full transition-all duration-300",
                  professionalPersona === 'buyer-agents' 
                    ? "bg-stone-900 text-white shadow-sm" 
                    : "text-stone-500 hover:text-stone-900"
                )}
              >
                {navLabels.buyerAgents}
              </button>
              <button 
                onClick={() => setProfessionalPersona('relocation')}
                className={cn(
                  "px-5 py-2 text-sm font-medium rounded-full transition-all duration-300",
                  professionalPersona === 'relocation' 
                    ? "bg-stone-900 text-white shadow-sm" 
                    : "text-stone-500 hover:text-stone-900"
                )}
              >
                {navLabels.relocation}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Content */}
      <main className="pt-36 pb-20">
        {renderContent()}

        {/* Professionals Section - Only show cards when not already in pro view */}
        {!isProfessionalView && (
          <section id="professionals" className="max-w-5xl mx-auto px-6 pt-20 scroll-mt-24">
            <div className="text-center mb-12">
              <h2 className="font-serif text-4xl md:text-5xl mb-4">
                {t.shared.forProfessionals.title}
              </h2>
              <p className="text-lg text-stone-600 max-w-2xl mx-auto">
                {t.shared.forProfessionals.description}
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 mb-16">
              {/* Buyer Agents Card */}
              <div 
                onClick={() => {
                  setIsProfessionalView(true);
                  setProfessionalPersona('buyer-agents');
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="bg-white rounded-2xl p-8 shadow-sm border border-stone-100 hover:shadow-lg transition-all cursor-pointer group"
              >
                <div className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-3">
                  {t.shared.forProfessionals.buyerAgents.label}
                </div>
                <h3 className="font-serif text-2xl mb-4 group-hover:text-stone-600 transition-colors">
                  {t.shared.forProfessionals.buyerAgents.title}
                </h3>
                <p className="text-stone-600 mb-6">
                  {t.shared.forProfessionals.buyerAgents.description}
                </p>
                <span className="text-stone-900 font-medium text-sm flex items-center gap-2 group-hover:gap-3 transition-all">
                  {t.shared.forProfessionals.buyerAgents.cta} <ArrowRight className="w-4 h-4" />
                </span>
              </div>

              {/* Relocation Card */}
              <div 
                onClick={() => {
                  setIsProfessionalView(true);
                  setProfessionalPersona('relocation');
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="bg-white rounded-2xl p-8 shadow-sm border border-stone-100 hover:shadow-lg transition-all cursor-pointer group"
              >
                <div className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-3">
                  {t.shared.forProfessionals.relocation.label}
                </div>
                <h3 className="font-serif text-2xl mb-4 group-hover:text-stone-600 transition-colors">
                  {t.shared.forProfessionals.relocation.title}
                </h3>
                <p className="text-stone-600 mb-6">
                  {t.shared.forProfessionals.relocation.description}
                </p>
                <span className="text-stone-900 font-medium text-sm flex items-center gap-2 group-hover:gap-3 transition-all">
                  {t.shared.forProfessionals.relocation.cta} <ArrowRight className="w-4 h-4" />
                </span>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-stone-100 py-12">
        <div className="max-w-5xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6 text-sm text-stone-500">
          <div>
            {t.shared.footer.copyright}
          </div>
          <div className="flex items-center gap-6">
            <Link href="#" className="hover:text-stone-900 transition-colors">
              {t.shared.footer.privacy}
            </Link>
            <Link href="#" className="hover:text-stone-900 transition-colors">
              {t.shared.footer.cookies}
            </Link>
            <Link href="#" className="hover:text-stone-900 transition-colors">
              {t.shared.footer.faqs}
            </Link>
            <Link href="#" className="hover:text-stone-900 transition-colors">
              {t.shared.footer.contact}
            </Link>
            <Link href="#" className="hover:text-stone-900 transition-colors">
              {t.shared.footer.terms}
            </Link>
          </div>
        </div>
      </footer>
    </div>
    </DictionaryProvider>
  );
}

