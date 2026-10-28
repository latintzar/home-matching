
import React from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, Check, Search, MapPin, Calendar, Ruler, Hammer, AlertCircle, Eye } from "lucide-react";

export const Layout11ForensicDossier = ({ data }: { data: any }) => {
  // Safely access arrays with fallbacks
  const structuralAlerts = data.forensic_risk_audit?.structural_pathology?.alerts || [];
  const socialAlerts = data.forensic_risk_audit?.social_security?.alerts || [];
  const legalAlerts = data.forensic_risk_audit?.urban_legality?.alerts || [];
  const renovationCosts = data.execution_reality_check?.renovation_reality?.cost_estimates || [];
  const rooms = data.execution_reality_check?.room_by_room || [];

  // Helper to parse alerts into title/desc
  const parseAlert = (text: string) => {
    const parts = text.replace(/\*\*/g, '').split(':');
    return {
      title: parts[0],
      desc: parts.slice(1).join(':').trim() || parts[0]
    };
  };

  return (
    <div className="h-full overflow-y-auto bg-stone-100 p-4 md:p-10 font-sans text-stone-800">
      <div className="max-w-5xl mx-auto bg-white shadow-xl border border-stone-200 rounded-sm overflow-hidden min-h-[800px] relative">
        
        {/* 1. THE EXECUTIVE DISCREPANCY (HERO) */}
        <div className="bg-stone-900 text-stone-100 p-8 relative">
            <div className="absolute top-0 right-0 bg-amber-500 text-stone-900 text-xs font-bold px-3 py-1 uppercase tracking-widest">Confidential Dossier</div>
            
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-8 items-center">
                {/* Left: Listing Claims */}
                <div className="text-right opacity-70 border-r border-stone-700 pr-8 hidden md:block">
                    <h3 className="text-xs uppercase tracking-widest text-stone-500 mb-2">Listing Claims</h3>
                    <div className="space-y-1">
                        <p className="font-light">"{data.property_info.title}"</p>
                        <p className="font-light">{data.property_info.location}</p>
                        <p className="font-bold text-xl">
                            {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(data.property_info.price_eur)}
                        </p>
                    </div>
                </div>

                {/* Center: The Verdict */}
                <div className="text-center z-10 bg-stone-900 p-2 md:p-0">
                    <div className="inline-block border-2 border-amber-500 px-6 py-2 mb-4">
                        <span className="text-amber-500 font-bold tracking-widest uppercase">Forensic Audit</span>
                    </div>
                    <h1 className="text-3xl md:text-4xl font-bold mb-2 text-white leading-tight">
                        {data.forensic_risk_audit?.structural_pathology?.risk_level === 'High' ? 'CRITICAL RISKS DETECTED' : 
                         data.forensic_risk_audit?.structural_pathology?.risk_level === 'Medium' ? 'PROCEED WITH CAUTION' : 
                         'VERIFIED OPPORTUNITY'}
                    </h1>
                    <p className="text-stone-400 max-w-md mx-auto text-sm leading-relaxed">
                        {data.house_as_a_whole.narrative_synthesis}
                    </p>
                </div>

                {/* Right: Reality Check */}
                <div className="text-left opacity-100 border-l border-stone-700 pl-8 hidden md:block">
                    <h3 className="text-xs uppercase tracking-widest text-amber-500 mb-2">Reality Check</h3>
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Ruler className="h-4 w-4 text-stone-500" />
                            <span className="font-mono text-sm">
                                {data.property_info.size_m2 ? `${data.property_info.size_m2}m² Claimed` : 'Size Check'} 
                                <span className="text-amber-500 ml-2">→ Verify</span>
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-stone-500" />
                            <span className="font-mono text-sm">1975 Build <span className="text-stone-500 text-xs">(50y old)</span></span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Hammer className="h-4 w-4 text-stone-500" />
                            <span className="font-mono text-sm">
                                {renovationCosts[0]?.split(':')[1]?.trim() || 'Needs Reno'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* 2. THE EVIDENCE GRID (BODY) */}
        <div className="p-8 bg-stone-50">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-stone-800 uppercase tracking-tight flex items-center gap-2">
                    <Search className="h-5 w-5" /> Evidence Board
                </h2>
                <Badge variant="outline" className="bg-white border-stone-300 text-stone-500">
                    {structuralAlerts.length + socialAlerts.length + legalAlerts.length} Findings
                </Badge>
            </div>

            <div className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6">
                
                {/* Structural Cards */}
                {structuralAlerts.map((alert: string, i: number) => {
                    const { title, desc } = parseAlert(alert);
                    return (
                        <div key={`struct-${i}`} className="break-inside-avoid bg-white p-0 shadow-sm border border-stone-200 rounded-sm group hover:shadow-md transition-shadow">
                            <div className="h-32 bg-stone-200 relative overflow-hidden">
                                <img src={`https://source.unsplash.com/random/400x300?construction,damage,${i}`} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all" alt="evidence" />
                                <div className="absolute top-2 left-2 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 uppercase">Physical Defect</div>
                            </div>
                            <div className="p-4">
                                <h3 className="font-bold text-stone-900 text-sm mb-1">{title}</h3>
                                <p className="text-stone-600 text-xs leading-relaxed">{desc}</p>
                            </div>
                        </div>
                    );
                })}

                {/* Legal Cards */}
                {legalAlerts.map((alert: string, i: number) => {
                    const { title, desc } = parseAlert(alert);
                    return (
                        <div key={`legal-${i}`} className="break-inside-avoid bg-white p-0 shadow-sm border border-stone-200 rounded-sm group hover:shadow-md transition-shadow">
                            <div className="h-32 bg-stone-200 relative overflow-hidden">
                                <div className="absolute inset-0 flex items-center justify-center bg-stone-100">
                                    <MapPin className="h-8 w-8 text-stone-300" />
                                </div>
                                <div className="absolute top-2 left-2 bg-amber-500 text-stone-900 text-[10px] font-bold px-2 py-0.5 uppercase">Legal Risk</div>
                            </div>
                            <div className="p-4">
                                <h3 className="font-bold text-stone-900 text-sm mb-1">{title}</h3>
                                <p className="text-stone-600 text-xs leading-relaxed">{desc}</p>
                            </div>
                        </div>
                    );
                })}

                {/* Social Cards */}
                {socialAlerts.map((alert: string, i: number) => {
                    const { title, desc } = parseAlert(alert);
                    return (
                        <div key={`social-${i}`} className="break-inside-avoid bg-white p-4 shadow-sm border border-stone-200 rounded-sm group hover:shadow-md transition-shadow relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-2 opacity-10">
                                <Eye className="h-12 w-12" />
                            </div>
                            <div className="mb-2">
                                <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 uppercase rounded-full">Social Intel</span>
                            </div>
                            <h3 className="font-bold text-stone-900 text-sm mb-2">{title}</h3>
                            <div className="relative pl-3 border-l-2 border-stone-300 italic text-stone-500 text-xs">
                                "{desc}"
                            </div>
                        </div>
                    );
                })}

            </div>
        </div>

        <Separator />

        {/* 3. THE ROOM SCAN (FOOTER) */}
        <div className="p-8 bg-white">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-stone-800 uppercase tracking-tight flex items-center gap-2">
                    <Hammer className="h-5 w-5" /> Room Scan
                </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {rooms.map((room: any, i: number) => (
                    <div key={i} className="border border-stone-100 hover:border-stone-300 transition-colors p-3 flex gap-3 items-start group">
                        <div className="w-16 h-16 bg-stone-100 shrink-0 overflow-hidden rounded-sm">
                             <img src={`https://source.unsplash.com/random/200x200?room,interior,${i}`} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt="room" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex justify-between items-baseline mb-1">
                                <h4 className="font-bold text-sm text-stone-900 truncate">{room.room_name}</h4>
                                <span className="text-xs font-mono text-stone-400">{room.room_id}</span>
                            </div>
                            <p className="text-xs text-stone-500 line-clamp-2 mb-1">{room.one_liner}</p>
                            {room.renovation_costs?.[0] && (
                                <div className="text-[10px] font-bold text-amber-600 bg-amber-50 inline-block px-1.5 rounded-sm">
                                    Est. {room.renovation_costs[0].split('(')[0]}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>

      </div>
    </div>
  );
};

