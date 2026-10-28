"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Settings,
  User,
  ChevronDown,
  LogOut,
  PanelLeftClose,
  PanelLeft,
  CreditCard,
} from "lucide-react";
import { MiniAmorphousOrb } from "@/components/ui/AmorphousOrb";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { signOut } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/index";
import { ProfileSwitcher, ProfileType } from "@/components/profile/ProfileSwitcher";

interface ProfileInfo {
  type: ProfileType;
  exists: boolean;
  intakeCompleted: boolean;
  profileId?: string;
}

interface AppSidebarProps {
  user?: {
    id: string;
    email?: string;
    user_metadata?: {
      full_name?: string;
      avatar_url?: string;
    };
  } | null;
  isOnboardingComplete?: boolean;
  activeProfileType?: ProfileType;
  allProfiles?: ProfileInfo[];
}

export function AppSidebar({ 
  user, 
  isOnboardingComplete = true,
  activeProfileType = 'renter',
  allProfiles = [
    { type: 'renter', exists: true, intakeCompleted: isOnboardingComplete },
    { type: 'buyer', exists: false, intakeCompleted: false },
  ],
}: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { state, toggleSidebar, setOpenMobile, isMobile } = useSidebar();
  const isCollapsed = state === "collapsed";
  const t = useTranslations();
  
  // Navigation items for non-pro users (renters/buyers)
  const navItems = [
    {
      title: t.nav.properties,
      href: "/dashboard",
      icon: Home,
    },
    {
      title: t.nav.profile,
      href: "/profile",
      icon: User,
    },
    {
      title: "Facturación",
      href: "/billing",
      icon: CreditCard,
    },
    {
      title: t.nav.settings,
      href: "/settings",
      icon: Settings,
    },
  ];
  
  // Close mobile sidebar when navigating
  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  // Get user display info
  const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Usuario";
  const userEmail = user?.email || "";
  const userInitials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // Render nav item with optional tooltip and disabled state
  const renderNavItem = (item: typeof navItems[0]) => {
    const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
    const isDisabled = !isOnboardingComplete && item.href !== "/speak-with-leo";
    
    const content = (
      <SidebarMenuButton
        asChild={!isDisabled}
        isActive={isActive}
        className={`rounded-xl transition-all ${
          isMobile ? 'h-14 px-6 justify-center' : 'h-12 px-4'
        } ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
        onClick={isDisabled ? (e) => e.preventDefault() : undefined}
      >
        {isDisabled ? (
          <div className={`flex items-center ${isMobile ? 'justify-center gap-4' : 'gap-3'}`}>
            <item.icon className={isMobile ? 'h-6 w-6' : 'h-5 w-5'} />
            {(!isCollapsed || isMobile) && <span className={`font-medium ${isMobile ? 'text-lg' : 'text-base'}`}>{item.title}</span>}
          </div>
        ) : (
          <Link href={item.href} onClick={handleNavClick} className={isMobile ? 'justify-center' : ''}>
            <item.icon className={isMobile ? 'h-6 w-6' : 'h-5 w-5'} />
            {(!isCollapsed || isMobile) && <span className={`font-medium ${isMobile ? 'text-lg' : 'text-base'}`}>{item.title}</span>}
          </Link>
        )}
      </SidebarMenuButton>
    );

    if (isDisabled) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            {content}
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>{t.speakWithLeo.titleOnboarding}</p>
          </TooltipContent>
        </Tooltip>
      );
    }

    if (isCollapsed) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            {content}
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>{item.title}</p>
          </TooltipContent>
        </Tooltip>
      );
    }

    return content;
  };

  return (
    <Sidebar 
      className="border-r border-stone-100"
      collapsible="icon"
    >
      {/* Header with Toggle + Logo */}
      <SidebarHeader className={`border-b border-stone-100 ${isMobile ? 'px-6 py-5' : 'px-3 py-3'}`}>
        <div className={`flex items-center ${isMobile ? 'justify-center' : 'gap-2'}`}>
          {!isMobile && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="h-8 w-8 rounded-lg hover:bg-stone-100"
            >
              {isCollapsed ? (
                <PanelLeft className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </Button>
          )}
          {(!isCollapsed || isMobile) && (
            <span className={`font-serif font-medium tracking-tight text-stone-900 ${isMobile ? 'text-2xl' : 'text-xl'}`}>
              Leo.casa
            </span>
          )}
        </div>
        
        {/* Profile Switcher */}
        {(!isCollapsed || isMobile) && (
          <div className="mt-3">
            <ProfileSwitcher
              activeProfileType={activeProfileType}
              allProfiles={allProfiles}
              collapsed={isCollapsed && !isMobile}
            />
          </div>
        )}
      </SidebarHeader>

      {/* Main Navigation */}
      <SidebarContent className={`${isMobile ? 'px-4 py-6' : 'px-2 py-4'}`}>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className={isMobile ? 'space-y-2' : ''}>
              {/* Speak with Leo - Always first and always enabled */}
              <SidebarMenuItem>
                {isCollapsed && !isMobile ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname === "/speak-with-leo"}
                        className="h-12 px-4 rounded-xl transition-all bg-gradient-to-r from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100 border border-amber-200/50 relative"
                      >
                        <Link href="/speak-with-leo" onClick={handleNavClick}>
                          <MiniAmorphousOrb className="h-5 w-5" />
                          {/* Notification badge for incomplete onboarding */}
                          {!isOnboardingComplete && (
                            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>{t.nav.speakWithLeo}</p>
                      {!isOnboardingComplete && (
                        <p className="text-xs text-amber-600">Completa tu perfil</p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === "/speak-with-leo"}
                    className={`rounded-xl transition-all bg-gradient-to-r from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100 border border-amber-200/50 relative ${
                      isMobile ? 'h-14 px-6 justify-center' : 'h-12 px-4'
                    }`}
                  >
                    <Link href="/speak-with-leo" onClick={handleNavClick} className={isMobile ? 'justify-center' : ''}>
                      <MiniAmorphousOrb className={isMobile ? 'h-7 w-7' : 'h-6 w-6'} />
                      <span className={`font-medium text-amber-700 ${isMobile ? 'text-lg' : 'text-base'}`}>{t.nav.speakWithLeo}</span>
                      {/* Notification badge for incomplete onboarding */}
                      {!isOnboardingComplete && (
                        <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                      )}
                    </Link>
                  </SidebarMenuButton>
                )}
              </SidebarMenuItem>

              {/* Divider */}
              <div className={`border-t border-stone-100 ${isMobile ? 'my-4' : 'my-2'}`} />

              {/* Other nav items */}
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  {renderNavItem(item)}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer with User Menu */}
      <SidebarFooter className={`border-t border-stone-100 ${isMobile ? 'p-4' : 'p-2'}`}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={`flex w-full items-center gap-3 rounded-xl text-left hover:bg-stone-100 transition-colors ${
              isMobile ? 'p-3 justify-center' : 'p-2'
            } ${isCollapsed && !isMobile ? "justify-center" : ""}`}>
              <Avatar className={isMobile ? 'h-11 w-11' : 'h-9 w-9'}>
                <AvatarImage src={user?.user_metadata?.avatar_url} />
                <AvatarFallback className={`bg-stone-200 text-stone-600 ${isMobile ? 'text-base' : 'text-sm'}`}>
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              {(!isCollapsed || isMobile) && (
                <>
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-stone-900 truncate ${isMobile ? 'text-base' : 'text-sm'}`}>
                      {userName}
                    </p>
                    <p className={`text-stone-500 truncate ${isMobile ? 'text-sm' : 'text-xs'}`}>
                      {userEmail}
                    </p>
                  </div>
                  <ChevronDown className={`text-stone-400 ${isMobile ? 'h-5 w-5' : 'h-4 w-4'}`} />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem asChild>
              <Link href="/profile" onClick={handleNavClick} className="flex items-center gap-2">
                <User className="h-4 w-4" />
                {t.nav.profile}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings" onClick={handleNavClick} className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                {t.nav.settings}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={handleSignOut}
              className="text-red-600 focus:text-red-600 focus:bg-red-50"
            >
              <LogOut className="h-4 w-4 mr-2" />
              {t.nav.signOut}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
