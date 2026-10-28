"use client";
import {appFetch as fetch} from '@/lib/app-path';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Home, Key, ChevronDown, Plus, Check, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type ProfileType = "renter" | "buyer";

interface ProfileInfo {
  type: ProfileType;
  exists: boolean;
  intakeCompleted: boolean;
  profileId?: string;
}

interface ProfileSwitcherProps {
  activeProfileType: ProfileType;
  allProfiles: ProfileInfo[];
  onSwitch?: (type: ProfileType) => void;
  collapsed?: boolean;
  className?: string;
}

const PROFILE_CONFIG = {
  renter: {
    label: "Alquilando",
    icon: Home,
    description: "Buscando alquiler",
  },
  buyer: {
    label: "Comprando",
    icon: Key,
    description: "Buscando comprar",
  },
};

export function ProfileSwitcher({
  activeProfileType,
  allProfiles,
  onSwitch,
  collapsed = false,
  className,
}: ProfileSwitcherProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [pendingSwitch, setPendingSwitch] = useState<ProfileType | null>(null);

  const activeConfig = PROFILE_CONFIG[activeProfileType];
  const ActiveIcon = activeConfig.icon;

  const handleProfileSelect = async (type: ProfileType) => {
    if (type === activeProfileType) return;

    const targetProfile = allProfiles.find((p) => p.type === type);

    if (!targetProfile?.exists) {
      // Profile doesn't exist - show create modal
      setPendingSwitch(type);
      setShowCreateModal(true);
      return;
    }

    // Profile exists - switch to it
    await switchProfile(type);
  };

  const switchProfile = async (type: ProfileType) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/profile/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetProfile: type }),
      });

      const data = await response.json();

      if (data.success) {
        onSwitch?.(type);
        // Refresh the page to reload with new profile data
        router.refresh();
        
        // If intake not completed, redirect to speak with leo
        if (!data.intakeCompleted) {
          router.push("/speak-with-leo");
        }
      } else {
        console.error("Failed to switch profile:", data.error);
      }
    } catch (error) {
      console.error("Error switching profile:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const createAndSwitchProfile = async () => {
    if (!pendingSwitch) return;

    setIsLoading(true);
    try {
      const response = await fetch("/api/profile/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileType: pendingSwitch,
          switchToNew: true,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setShowCreateModal(false);
        onSwitch?.(pendingSwitch);
        router.refresh();
        // New profile needs intake
        router.push("/speak-with-leo");
      } else {
        console.error("Failed to create profile:", data.error);
      }
    } catch (error) {
      console.error("Error creating profile:", error);
    } finally {
      setIsLoading(false);
      setPendingSwitch(null);
    }
  };

  if (collapsed) {
    // Just show icon when collapsed
    return (
      <div className={cn("flex justify-center", className)}>
        <ActiveIcon className="h-5 w-5 text-stone-600" />
      </div>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-between px-3 py-2 h-auto hover:bg-stone-100 rounded-xl",
              className
            )}
            disabled={isLoading}
          >
            <div className="flex items-center gap-2">
              <ActiveIcon className="h-4 w-4 text-amber-600" />
              <span className="font-medium text-stone-900">
                {activeConfig.label}
              </span>
            </div>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-stone-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-stone-400" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {(["renter", "buyer"] as ProfileType[]).map((type) => {
            const config = PROFILE_CONFIG[type];
            const Icon = config.icon;
            const profile = allProfiles.find((p) => p.type === type);
            const isActive = type === activeProfileType;
            const exists = profile?.exists ?? false;

            return (
              <DropdownMenuItem
                key={type}
                onClick={() => handleProfileSelect(type)}
                className="flex items-center justify-between py-2"
              >
                <div className="flex items-center gap-2">
                  <Icon
                    className={cn(
                      "h-4 w-4",
                      isActive ? "text-amber-600" : "text-stone-500"
                    )}
                  />
                  <div className="flex flex-col">
                    <span
                      className={cn(
                        "text-sm",
                        isActive ? "font-medium" : "font-normal"
                      )}
                    >
                      {config.label}
                    </span>
                    {!exists && (
                      <span className="text-xs text-stone-400">
                        Sin configurar
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {isActive && (
                    <Check className="h-4 w-4 text-amber-600" />
                  )}
                  {!exists && (
                    <Plus className="h-3 w-3 text-stone-400" />
                  )}
                </div>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Create Profile Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Crear perfil de {pendingSwitch === "buyer" ? "compra" : "alquiler"}
            </DialogTitle>
            <DialogDescription>
              {pendingSwitch === "buyer" ? (
                <>
                  ¿Estás interesado en comprar una propiedad? Crea un perfil de
                  compra para que Leo te ayude a encontrar la casa perfecta.
                </>
              ) : (
                <>
                  ¿Buscas alquilar? Crea un perfil de alquiler para que Leo te
                  ayude a encontrar el piso ideal.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center gap-3 p-4 bg-stone-50 rounded-xl">
              {pendingSwitch && (
                <>
                  {(() => {
                    const Icon = PROFILE_CONFIG[pendingSwitch].icon;
                    return <Icon className="h-8 w-8 text-amber-600" />;
                  })()}
                  <div>
                    <p className="font-medium text-stone-900">
                      {pendingSwitch === "buyer"
                        ? "Perfil de compra"
                        : "Perfil de alquiler"}
                    </p>
                    <p className="text-sm text-stone-500">
                      Leo te hará algunas preguntas para conocerte mejor
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateModal(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              onClick={createAndSwitchProfile}
              disabled={isLoading}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creando...
                </>
              ) : (
                "Crear y empezar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default ProfileSwitcher;

