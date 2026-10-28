"use client";

import { ReactNode } from "react";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "./AppSidebar";
import { Menu } from "lucide-react";
import { LanguageProvider, type Language } from "@/lib/i18n/index";
import type { ProfileType } from "@/components/profile/ProfileSwitcher";

interface ProfileInfo {
  type: ProfileType;
  exists: boolean;
  intakeCompleted: boolean;
  profileId?: string;
}

interface AppLayoutProps {
  children: ReactNode;
  user?: {
    id: string;
    email?: string;
    user_metadata?: {
      full_name?: string;
      avatar_url?: string;
    };
  } | null;
  isOnboardingComplete?: boolean;
  language?: Language;
  activeProfileType?: ProfileType;
  allProfiles?: ProfileInfo[];
}

export function AppLayout({ 
  children, 
  user,
  isOnboardingComplete = true,
  language = 'es',
  activeProfileType = 'renter',
  allProfiles,
}: AppLayoutProps) {
  return (
    <LanguageProvider initialLanguage={language}>
      <TooltipProvider delayDuration={0}>
        <SidebarProvider defaultOpen={true}>
          <div className="flex min-h-screen w-full bg-[#FDFBF7]">
            <AppSidebar 
              user={user} 
              isOnboardingComplete={isOnboardingComplete}
              activeProfileType={activeProfileType}
              allProfiles={allProfiles}
            />
            <SidebarInset className="flex-1 flex flex-col">
              {/* Mobile Header with Sidebar Trigger */}
              <header className="md:hidden sticky top-0 z-40 flex h-14 items-center gap-4 border-b border-stone-100 bg-[#FDFBF7] px-4">
                <SidebarTrigger className="-ml-1">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle sidebar</span>
                </SidebarTrigger>
                <span className="font-serif text-lg font-medium text-stone-900">
                  Leo.casa
                </span>
              </header>
              <main className="flex-1">
                {children}
              </main>
            </SidebarInset>
          </div>
        </SidebarProvider>
      </TooltipProvider>
    </LanguageProvider>
  );
}
