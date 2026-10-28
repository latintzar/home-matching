"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  CreditCard,
  Check,
  Loader2,
  ExternalLink,
  Pause,
  Play,
  AlertCircle,
  Receipt,
  Home,
  Key,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface BillingContentProps {
  userId: string;
  userEmail: string;
  activeProfileType?: 'renter' | 'buyer';
}

interface Subscription {
  id: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  planName: string;
  planType: 'renter' | 'buyer' | 'pro';
  amount: number;
  currency: string;
  interval: string;
}

interface Invoice {
  id: string;
  number: string;
  status: string;
  amount: number;
  currency: string;
  date: string;
  pdfUrl: string | null;
  hostedUrl: string | null;
}

// Plan Card Component
interface PlanCardProps {
  type: 'renter' | 'buyer';
  icon: React.ElementType;
  title: string;
  subtitle: string;
  price: string;
  description: string;
  isActive: boolean;
  isPaused?: boolean;
  subscription: Subscription | null;
  isLoading: boolean;
  isPauseLoading: boolean;
  isResumeLoading: boolean;
  onSubscribe: () => void;
  onPause: () => void;
  onResume: () => void;
  formatDate: (date: string) => string;
  formatPrice: (amount: number, currency: string) => string;
  isRecommended?: boolean;
}

function PlanCard({
  type,
  icon: Icon,
  title,
  subtitle,
  price,
  description,
  isActive,
  isPaused,
  subscription,
  isLoading,
  isPauseLoading,
  isResumeLoading,
  onSubscribe,
  onPause,
  onResume,
  formatDate,
  formatPrice,
  isRecommended,
}: PlanCardProps) {
  const borderClass = isActive 
    ? "border-green-300 bg-green-50/30" 
    : isRecommended 
      ? "border-amber-300 bg-amber-50/30" 
      : "border-stone-200";

  return (
    <div className={`p-4 border rounded-xl transition-colors ${borderClass}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg ${isActive ? 'bg-green-100' : 'bg-stone-100'}`}>
            <Icon className={`w-4 h-4 ${isActive ? 'text-green-600' : 'text-stone-600'}`} />
          </div>
          <div>
            <h3 className="font-medium text-stone-900">{title}</h3>
            <p className="text-xs text-stone-500">{subtitle}</p>
          </div>
        </div>
        {isActive && (
          <Badge variant="default" className="bg-green-600">
            Activa
          </Badge>
        )}
        {isPaused && (
          <Badge variant="secondary">
            Finaliza pronto
          </Badge>
        )}
        {!isActive && !isPaused && isRecommended && (
          <Badge variant="outline" className="border-amber-300 text-amber-700">
            Recomendado
          </Badge>
        )}
      </div>

      <p className="text-2xl font-semibold text-stone-900">
        {price}<span className="text-base font-normal text-stone-500">/mes</span>
      </p>
      
      <p className="text-sm text-stone-500 mt-1 mb-4">
        {description}
      </p>

      {isActive && subscription && (
        <div className="space-y-3 mb-4 p-3 bg-white/50 rounded-lg">
          <div className="flex justify-between text-sm">
            <span className="text-stone-500">Próximo cobro</span>
            <span className="font-medium">{formatDate(subscription.currentPeriodEnd)}</span>
          </div>
          {isPaused && (
            <div className="flex items-center gap-2 text-sm text-amber-700">
              <AlertCircle className="w-4 h-4" />
              <span>Finaliza el {formatDate(subscription.currentPeriodEnd)}</span>
            </div>
          )}
        </div>
      )}

      {isActive ? (
        <div className="flex gap-2">
          {isPaused ? (
            <Button
              onClick={onResume}
              disabled={isResumeLoading}
              className="flex-1 rounded-xl"
              size="sm"
            >
              {isResumeLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              ) : (
                <Play className="w-4 h-4 mr-1" />
              )}
              Reanudar
            </Button>
          ) : (
            <Button
              onClick={onPause}
              disabled={isPauseLoading}
              variant="outline"
              className="flex-1 rounded-xl border-stone-200"
              size="sm"
            >
              {isPauseLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              ) : (
                <Pause className="w-4 h-4 mr-1" />
              )}
              Pausar
            </Button>
          )}
        </div>
      ) : (
        <Button
          onClick={onSubscribe}
          disabled={isLoading}
          className={`w-full rounded-xl ${isRecommended ? 'bg-amber-600 hover:bg-amber-700' : ''}`}
          size="sm"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            "Suscribirse"
          )}
        </Button>
      )}
    </div>
  );
}

export function BillingContent({ userId, userEmail, activeProfileType = 'renter' }: BillingContentProps) {
  const searchParams = useSearchParams();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [status, setStatus] = useState<string>("none");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    // Check for success/cancel params from Stripe redirect
    if (searchParams.get("success") === "true") {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 5000);
    }
    
    fetchBillingData();
  }, [searchParams]);

  const fetchBillingData = async () => {
    setLoading(true);
    try {
      const [subRes, invRes] = await Promise.all([
        fetch("/api/billing/subscription"),
        fetch("/api/billing/invoices"),
      ]);

      const subData = await subRes.json();
      const invData = await invRes.json();

      if (subData.success) {
        setSubscription(subData.subscription);
        setStatus(subData.status);
      }

      if (invData.success) {
        setInvoices(invData.invoices || []);
      }
    } catch (error) {
      console.error("Error fetching billing:", error);
    }
    setLoading(false);
  };

  const handleSubscribe = async (plan: "renter" | "buyer") => {
    setActionLoading(plan);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Error creating checkout:", error);
    }
    setActionLoading(null);
  };

  const handlePause = async () => {
    setActionLoading('pause');
    try {
      const res = await fetch("/api/billing/pause", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        await fetchBillingData();
      }
    } catch (error) {
      console.error("Error pausing subscription:", error);
    }
    setActionLoading(null);
  };

  const handleResume = async () => {
    setActionLoading('resume');
    try {
      const res = await fetch("/api/billing/resume", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        await fetchBillingData();
      }
    } catch (error) {
      console.error("Error resuming subscription:", error);
    }
    setActionLoading(null);
  };

  const formatPrice = (amount: number, currency: string) => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      active: { variant: "default", label: "Activa" },
      paused: { variant: "secondary", label: "Pausada" },
      canceled: { variant: "destructive", label: "Cancelada" },
      past_due: { variant: "destructive", label: "Pago pendiente" },
      none: { variant: "outline", label: "Sin suscripción" },
    };
    const { variant, label } = variants[status] || variants.none;
    return <Badge variant={variant}>{label}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-stone-400" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Success Banner */}
      {showSuccess && (
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl text-green-800">
          <Check className="w-5 h-5" />
          <span>¡Suscripción activada correctamente!</span>
        </div>
      )}

      {/* Page Header */}
      <div>
        <h1 className="font-serif text-2xl font-medium text-stone-900">Facturación</h1>
        <p className="text-stone-500 mt-1">Gestiona tu suscripción y facturas</p>
      </div>

      {/* Current Subscription */}
      <Card className="border-stone-200">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <CreditCard className="w-5 h-5" />
              Tu suscripción
            </CardTitle>
            {getStatusBadge(status)}
          </div>
        </CardHeader>
        <CardContent>
          {/* Always show both subscription types */}
            <div className="space-y-4">
            <p className="text-stone-600 text-sm">
              Cada perfil requiere su propia suscripción. Puedes tener activos ambos si buscas alquilar y comprar.
              </p>

              <div className="grid md:grid-cols-2 gap-4">
                {/* Renter Plan */}
              <PlanCard
                type="renter"
                icon={Home}
                title="Alquiler"
                subtitle="Leo.casa Renter"
                price="€9,99"
                description="Para quienes buscan alquilar"
                isActive={subscription?.planType === 'renter' && status === 'active'}
                isPaused={subscription?.planType === 'renter' && subscription?.cancelAtPeriodEnd}
                subscription={subscription?.planType === 'renter' ? subscription : null}
                isLoading={actionLoading === 'renter'}
                isPauseLoading={actionLoading === 'pause'}
                isResumeLoading={actionLoading === 'resume'}
                onSubscribe={() => handleSubscribe("renter")}
                onPause={handlePause}
                onResume={handleResume}
                formatDate={formatDate}
                formatPrice={formatPrice}
                isRecommended={activeProfileType === 'renter'}
              />

                {/* Buyer Plan */}
              <PlanCard
                type="buyer"
                icon={Key}
                title="Compra"
                subtitle="Leo.casa Buyer"
                price="€9,99"
                description="Para quienes buscan comprar"
                isActive={subscription?.planType === 'buyer' && status === 'active'}
                isPaused={subscription?.planType === 'buyer' && subscription?.cancelAtPeriodEnd}
                subscription={subscription?.planType === 'buyer' ? subscription : null}
                isLoading={actionLoading === 'buyer'}
                isPauseLoading={actionLoading === 'pause'}
                isResumeLoading={actionLoading === 'resume'}
                onSubscribe={() => handleSubscribe("buyer")}
                onPause={handlePause}
                onResume={handleResume}
                formatDate={formatDate}
                formatPrice={formatPrice}
                isRecommended={activeProfileType === 'buyer'}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoice History */}
      <Card className="border-stone-200">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Receipt className="w-5 h-5" />
            Historial de facturas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length > 0 ? (
            <div className="divide-y divide-stone-100">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="font-medium text-stone-900">
                        {formatPrice(invoice.amount, invoice.currency)}
                      </p>
                      <p className="text-sm text-stone-500">
                        {invoice.date ? formatDate(invoice.date) : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={invoice.status === "paid" ? "default" : "secondary"}
                    >
                      {invoice.status === "paid" ? "Pagada" : invoice.status}
                    </Badge>
                    {invoice.pdfUrl && (
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className="text-stone-500 hover:text-stone-900"
                      >
                        <a href={invoice.pdfUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-stone-500 text-center py-8">
              Aún no tienes facturas
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

