import React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { 
    AlertTriangle, Check, Search, MapPin, Calendar, Ruler, Hammer, 
    AlertCircle, Eye, ThumbsUp, MessageSquare, Scale, HelpCircle, 
    AlertOctagon, CheckCircle2, Construction, FileText, Map, User, 
    ZoomIn, Camera, Quote, Smartphone, ExternalLink, Activity, Waves, HardHat, Shield
} from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Button } from "@/components/ui/button";

export const Layout12Optimism = ({ data }: { data: any }) => {
  // Safely access arrays with fallbacks
  const structuralAlerts = data.forensic_risk_audit?.structural_pathology?.alerts || [];
  const legalAlerts = data.forensic_risk_audit?.urban_legality?.alerts || [];
  
  // Access real source data if available
  const cadastral = data.source_data?.cadastral_data;
  const social = data.source_data?.social_radar;
  const streetView = data.source_data?.street_view;
  const visual = data.source_data?.visual_detective;
  const geology = data.source_data?.geology;
  const tenders = data.source_data?.tenders;
  const rooms = data.execution_reality_check?.room_by_room || [];
  const checklist = data.verification_checklist?.items || [];
  
  // Helper to parse alerts into title/desc
  const parseAlert = (text: string) => {
    const parts = text.replace(/\*\*/g, '').split(':');
    return {
      title: parts[0],
      desc: parts.slice(1).join(':').trim() || parts[0]
    };
  };

  // Helper to create WhatsApp link
  const createWhatsAppLink = () => {
    const agentPhone = data.property_info.agent_phone || "34600000000";
    const message = `Hola, estoy interesado en la propiedad en ${data.property_info.location} (Ref: ${data.listing_id}). 
    
Me gustaría aclarar un par de puntos importantes antes de la visita:
1. ${parseAlert(legalAlerts[0] || "Legal Situation").title} - ${parseAlert(legalAlerts[0] || "").desc}
2. ${parseAlert(structuralAlerts[0] || "Structural Status").title}

¿Tenéis documentación al respecto? Gracias.`;
    return `https://wa.me/${agentPhone}?text=${encodeURIComponent(message)}`;
  };

  return (
    <div className="h-full overflow-y-auto bg-[#f8f9fa] text-slate-800 font-sans">
      <div className="max-w-5xl mx-auto py-12 px-6">
        
        {/* 0. THE GOOD (Psychological Safety) */}
        <div className="mb-8 bg-emerald-50 border border-emerald-100 rounded-xl p-6 flex gap-4 items-start shadow-sm">
            <div className="p-2 bg-emerald-100 rounded-full shrink-0 text-emerald-700 mt-1">
                <ThumbsUp className="h-5 w-5" />
            </div>
            <div>
                <h3 className="font-bold text-emerald-900 text-lg mb-1">Why this property matters</h3>
                <p className="text-emerald-800 leading-relaxed">
                    {data.house_as_a_whole.narrative_synthesis.split('.')[0]}. 
                    The location in {data.property_info.location.split(',')[0]} is solid, and the underlying structure ("bones") allows for a significant value-add renovation.
                </p>
            </div>
        </div>

        {/* 1. THE ACTION LAYER (Checklist & Questions) - "What to do NOW" */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            {/* Left: The "Dealbreaker" Questions (Ask Agent NOW) */}
            <Card className="border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
                    <h3 className="font-bold flex items-center gap-2"><MessageSquare className="h-4 w-4 text-amber-400" /> Ask the Agent (Before Visit)</h3>
                    <Badge variant="secondary" className="bg-slate-700 text-slate-200 hover:bg-slate-600 border-none">High Priority</Badge>
                </div>
                <CardContent className="p-6 space-y-5 bg-white flex-1 flex flex-col">
                    <div className="space-y-5 flex-1">
                        {legalAlerts.slice(0, 1).map((alert: string, i: number) => (
                            <div key={i} className="flex gap-4 items-start">
                                <div className="bg-amber-100 p-2 rounded-full shrink-0">
                                    <HelpCircle className="h-5 w-5 text-amber-600" />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-900 text-lg">"Can you clarify the {parseAlert(alert).title} situation?"</p>
                                    <p className="text-sm text-slate-500 mt-1 leading-relaxed">Why: {parseAlert(alert).desc}</p>
                                </div>
                            </div>
                        ))}
                        {structuralAlerts.slice(0, 1).map((alert: string, i: number) => (
                            <div key={i} className="flex gap-4 items-start border-t border-slate-100 pt-5">
                                 <div className="bg-amber-100 p-2 rounded-full shrink-0">
                                    <HelpCircle className="h-5 w-5 text-amber-600" />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-900 text-lg">"Is there documentation regarding {parseAlert(alert).title}?"</p>
                                    <p className="text-sm text-slate-500 mt-1 leading-relaxed">Why: {parseAlert(alert).desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    
                    <div className="mt-6 pt-4 border-t border-slate-100">
                        <Button 
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2"
                            onClick={() => window.open(createWhatsAppLink(), '_blank')}
                        >
                            <Smartphone className="h-4 w-4" />
                            Open WhatsApp Chat with Agent
                        </Button>
                        <p className="text-center text-[10px] text-slate-400 mt-2">Pre-fills a message with these critical questions.</p>
                    </div>
                </CardContent>
            </Card>

            {/* Right: The "Visit" Checklist (Check on Site) */}
            <Card className="border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
                    <h3 className="font-bold flex items-center gap-2"><Eye className="h-4 w-4 text-emerald-400" /> Verify on Visit</h3>
                    <Badge variant="secondary" className="bg-slate-700 text-slate-200 hover:bg-slate-600 border-none">On Site</Badge>
                </div>
                <CardContent className="p-0 bg-white flex-1">
                    <div className="divide-y divide-slate-100">
                         {/* Render Checklist Items if available */}
                         {checklist.length > 0 ? (
                            checklist.slice(0, 3).map((item: any, i: number) => {
                                // Try to find a photo for this item
                                const itemPhoto = item.expansion?.photos?.[0]?.url || 
                                                  rooms.find((r: any) => r.room_id === item.expansion?.photos?.[0]?.room_id)?.image_url;

                                return (
                                    <div key={i} className="p-4 hover:bg-slate-50 transition-colors group cursor-pointer">
                            <div className="flex gap-4">
                                            {itemPhoto ? (
                                <div className="w-24 h-24 bg-slate-200 rounded-lg overflow-hidden shrink-0 relative border border-slate-200">
                                                    <img src={itemPhoto} className="w-full h-full object-cover" alt="check" />
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/10 group-hover:bg-black/0 transition-colors">
                                        <ZoomIn className="h-6 w-6 text-white drop-shadow-md" />
                                    </div>
                                                </div>
                                            ) : (
                                                <div className="w-24 h-24 bg-slate-100 rounded-lg flex items-center justify-center shrink-0 border border-slate-200 text-slate-300">
                                                    <Eye className="h-8 w-8" />
                                </div>
                                            )}
                                            
                                <div className="flex-1 py-1">
                                    <div className="flex items-center gap-2 mb-1">
                                                    <div className={`h-4 w-4 border-2 rounded-sm shrink-0 ${i === 0 ? 'border-amber-500 bg-amber-500' : 'border-slate-400'}`} />
                                                    <p className="font-bold text-slate-900">{item.headline}</p>
                                                </div>
                                                <p className="text-sm text-slate-600 leading-snug mb-2 line-clamp-2">{item.brief}</p>
                                                <div className="flex gap-2">
                                                    <Badge variant="outline" className="text-[10px] text-slate-600 bg-slate-50 border-slate-200">Priority {item.priority}</Badge>
                                                    {item.chapter_map && <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-100">{item.chapter_map}</Badge>}
                                    </div>
                                </div>
                            </div>
                        </div>
                                );
                            })
                         ) : (
                             // Fallback logic if checklist missing
                             rooms.slice(0,2).map((room: any, i: number) => (
                                <div key={i} className="p-4 hover:bg-slate-50 transition-colors group cursor-pointer">
                            <div className="flex gap-4">
                                <div className="w-24 h-24 bg-slate-200 rounded-lg overflow-hidden shrink-0 relative border border-slate-200">
                                            <img src={room.image_url} className="w-full h-full object-cover" alt="check" />
                                     <div className="absolute inset-0 flex items-center justify-center bg-black/10 group-hover:bg-black/0 transition-colors">
                                        <ZoomIn className="h-6 w-6 text-white drop-shadow-md" />
                                    </div>
                                </div>
                                <div className="flex-1 py-1">
                                     <div className="flex items-center gap-2 mb-1">
                                        <div className="h-4 w-4 border-2 border-slate-400 rounded-sm shrink-0" />
                                                <p className="font-bold text-slate-900">Inspect {room.room_name}</p>
                                            </div>
                                            <p className="text-sm text-slate-600 leading-snug mb-2">{room.one_liner}</p>
                                        </div>
                                    </div>
                                </div>
                             ))
                         )}
                    </div>
                </CardContent>
            </Card>
        </div>

        {/* 2. THE EVIDENCE BOARD (Visual Proof) */}
        <div className="mb-12">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                    <Search className="h-6 w-6 text-slate-400" /> The Evidence Board
                </h2>
                <p className="text-sm text-slate-500 hidden md:block">Forensic data & verified sources</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-min">

                {/* A. STREET VIEW ANALYSIS (Carousel + Pins) */}
                {streetView?.images?.length > 0 && (
                     <Card className="col-span-1 md:col-span-2 overflow-hidden border-slate-200 shadow-sm">
                        <div className="bg-slate-100 px-4 py-2 flex justify-between items-center border-b border-slate-200">
                            <div className="flex items-center gap-2">
                                <Camera className="h-4 w-4 text-slate-500" />
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Street View Analysis</span>
                            </div>
                            <Badge variant="secondary" className="text-[10px]">
                                {streetView.images.length} Views Analyzed
                            </Badge>
                        </div>
                        
                        <div className="p-0">
                            <Carousel className="w-full group">
                                <CarouselContent>
                                    {streetView.images.map((img: any, index: number) => (
                                        <CarouselItem key={index}>
                                            <div className="relative aspect-video w-full bg-slate-200 overflow-hidden">
                                                <img src={img.url} className="w-full h-full object-cover" alt={img.caption} />
                                                <div className="absolute inset-0 bg-black/10"></div>
                                                
                                                {/* Pins for this image */}
                                                {img.pins?.map((pin: any, pIndex: number) => (
                                                    <div key={pIndex} 
                                                         className="absolute group/pin"
                                                         style={{ top: `${pin.y}%`, left: `${pin.x}%` }}>
                                                        {/* Pulsing Dot */}
                                                        <div className="w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow-lg animate-pulse cursor-pointer transform -translate-x-1/2 -translate-y-1/2 hover:scale-125 transition-transform" />
                                                        
                                                        {/* Hover Card */}
                                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-48 bg-black/90 backdrop-blur-sm p-3 rounded-lg shadow-xl opacity-0 group-hover/pin:opacity-100 transition-opacity pointer-events-none z-10">
                                                            <p className="text-white text-xs font-bold mb-1 flex items-center gap-1">
                                                                <AlertCircle className="h-3 w-3 text-red-400" />
                                                                {pin.label}
                                                            </p>
                                                            <p className="text-slate-300 text-[10px] leading-tight">
                                                                {pin.description}
                                                            </p>
                                                            {/* Arrow */}
                                                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-black/90" />
                                                        </div>
                                                    </div>
                                                ))}

                                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                                                    <p className="text-white font-bold text-sm">{img.caption}</p>
                                                </div>
                                            </div>
                                        </CarouselItem>
                                    ))}
                                </CarouselContent>
                                <CarouselPrevious className="left-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                                <CarouselNext className="right-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </Carousel>
                            
                            <div className="p-4 bg-white border-t border-slate-100">
                                <h4 className="font-bold text-slate-900 text-xs uppercase mb-2 tracking-wide">Forensic Notes</h4>
                                <div className="flex flex-wrap gap-2">
                                    {streetView.annotations.map((note: string, i: number) => (
                                        <Badge key={i} variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 font-normal">
                                            {note}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        </div>
                     </Card>
                )}

                {/* B. CADASTRAL TRUTH (Data Card) */}
                {cadastral && (
                    <Card className="overflow-hidden border-slate-200 shadow-sm flex flex-col">
                        <div className="relative h-32 bg-slate-200">
                             {/* Placeholder Map Pattern */}
                             <div className="absolute inset-0 opacity-50" style={{backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '10px 10px'}}></div>
                             {/* Map Image if available */}
                             {cadastral.map_url && <img src={cadastral.map_url} className="absolute inset-0 w-full h-full object-cover mix-blend-multiply opacity-60 grayscale" alt="map" />}
                             
                             <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                                <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1"><Map className="h-3 w-3" /> Cadastral Record</span>
                             </div>
                        </div>
                        <div className="p-5 space-y-4 bg-white flex-1">
                            <div className="flex justify-between items-end border-b border-slate-100 pb-3">
                                <div>
                                    <p className="text-[10px] text-slate-400 uppercase font-bold">Year Built</p>
                                    <p className="text-2xl font-mono font-bold text-slate-900">{cadastral.level4?.unit?.yearBuilt || 'Unknown'}</p>
                                </div>
                                <Badge variant="outline" className={cadastral.level4?.unit?.yearBuilt < 1980 ? "bg-amber-50 text-amber-600 border-amber-200" : "bg-emerald-50 text-emerald-600"}>
                                    {cadastral.level4?.unit?.yearBuilt < 1980 ? "Pre-1980 Code" : "Modern Code"}
                                </Badge>
                            </div>
                            
                            <div className="space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Official Surface</span>
                                    <span className="font-bold font-mono">{cadastral.level4?.unit?.surfaceConstructed} m²</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Ref. Catastral</span>
                                    <span className="font-mono text-xs text-slate-400">{cadastral.level4?.unit?.refCat?.substring(0, 14)}...</span>
                                </div>
                            </div>

                             {/* Discrepancy Alert */}
                             <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 mt-2">
                                <div className="flex gap-2">
                                    <AlertOctagon className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                                    <p className="text-xs text-slate-600 leading-tight">
                                        Declared {data.property_info.size_m2}m² vs Official {cadastral.level4?.unit?.surfaceConstructed}m². 
                                        <span className="font-bold block mt-1">Difference: {Math.abs(data.property_info.size_m2 - cadastral.level4?.unit?.surfaceConstructed)}m²</span>
                                    </p>
                                </div>
                             </div>
                        </div>
                    </Card>
                )}

                {/* C. SOCIAL RADAR (Voice on the Ground) */}
                {social && (
                    <Card className="col-span-1 md:col-span-1 lg:col-span-1 overflow-hidden border-slate-200 shadow-sm flex flex-col">
                        <div className="bg-indigo-900 px-4 py-3 flex justify-between items-center text-white">
                             <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-indigo-300" />
                                <span className="text-xs font-bold uppercase tracking-wider">Social Radar</span>
                            </div>
                            <div className="flex gap-1">
                                {[1,2,3,4,5].map(n => <div key={n} className={`h-1.5 w-1.5 rounded-full ${n <= 3 ? 'bg-indigo-400' : 'bg-indigo-800'}`} />)}
                            </div>
                        </div>
                        <div className="p-0 bg-white flex-1 flex flex-col">
                            {/* Airbnb "Map" Visualization - Realistically Scaled */}
                            <div className="h-48 bg-slate-100 relative overflow-hidden border-b border-slate-100">
                                <div className="absolute inset-0 opacity-20" style={{backgroundImage: 'radial-gradient(#6366f1 2px, transparent 2px)', backgroundSize: '20px 20px'}}></div>
                                
                                {/* Center Pin (Property) */}
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
                                    <div className="w-4 h-4 bg-slate-900 rounded-full border-2 border-white shadow-lg animate-pulse" />
                                </div>

                                {/* Nearby Airbnb Pins - Plotted relative to center */}
                                {social.airbnb_listings?.map((ab: any, i: number) => {
                                    // Simple scaling logic: 1 unit lat/lng diff = X pixels
                                    // Mock center: 39.5345, 2.5712
                                    // Scale factor (very rough for mock display)
                                    const latDiff = (ab.lat - social.center.lat) * 20000; 
                                    const lngDiff = (ab.lng - social.center.lng) * 20000; 
                                    
                                    // Clamp to avoid overflow (keep within visual box 0-100%)
                                    // Center is 50%, 50%
                                    // We invert Y because screen Y goes down, Map lat goes up
                                    const topPct = 50 - latDiff; 
                                    const leftPct = 50 + lngDiff;

                                    return (
                                        <div key={i} 
                                             className="absolute w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center text-[10px] font-bold text-indigo-600 border border-indigo-100 transform hover:scale-110 transition-transform cursor-help z-10"
                                             style={{ top: `${Math.max(10, Math.min(90, topPct))}%`, left: `${Math.max(10, Math.min(90, leftPct))}%` }}
                                             title={`${ab.price} - ${ab.rating}★`}>
                                            €
                                        </div>
                                    );
                                })}
                                
                                <div className="absolute bottom-2 right-2 bg-white/90 px-2 py-1 rounded text-[10px] font-bold text-indigo-900 shadow-sm z-30">
                                    {social.airbnb_listings?.length} Active Listings Nearby
                                </div>
                            </div>

                            {/* Review Quotes */}
                            <div className="p-5 space-y-4 flex-1">
                                <p className="text-xs font-bold uppercase text-slate-400 mb-2">Voice on the Ground</p>
                                {social.reviews?.slice(0, 2).map((review: any, i: number) => (
                                    <div key={i} className="relative pl-4 border-l-2 border-indigo-100">
                                        <Quote className="absolute -top-1 -left-1.5 h-3 w-3 text-indigo-200 fill-indigo-200" />
                                        <p className="text-sm text-slate-700 italic leading-relaxed">"{review.text}"</p>
                                        <div className="mt-1 flex items-center gap-2">
                                            <span className="text-[10px] font-bold text-slate-900">{review.source}</span>
                                            <span className="text-[10px] text-slate-400">• {review.date}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </Card>
                )}
                
                {/* D. VISUAL DETECTIVE & DEEP CONTEXT (New Section) */}
                {visual && (
                    <Card className="col-span-1 md:col-span-1 lg:col-span-1 overflow-hidden border-slate-200 shadow-sm flex flex-col">
                        <div className="bg-slate-800 px-4 py-3 flex justify-between items-center text-white">
                             <div className="flex items-center gap-2">
                                <Activity className="h-4 w-4 text-emerald-300" />
                                <span className="text-xs font-bold uppercase tracking-wider">Visual Detective</span>
                            </div>
                            <Badge variant="outline" className="text-white border-emerald-400 bg-emerald-900/30 text-[10px]">
                                Vibe: {visual.vibe_score}/10
                            </Badge>
                        </div>
                         <div className="p-5 space-y-5 bg-white flex-1">
                            {/* Maintenance */}
                            <div>
                                <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Maintenance</p>
                                <p className="text-sm text-slate-700">{visual.maintenance_condition}</p>
                            </div>
                            {/* Security */}
                            <div>
                                <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Security Features</p>
                                <div className="flex flex-wrap gap-1">
                                    {visual.security_features.map((feat: string, i: number) => (
                                        <Badge key={i} variant="secondary" className="text-[10px] bg-slate-100 text-slate-600 hover:bg-slate-200">{feat}</Badge>
                                    ))}
                                </div>
                            </div>
                            {/* Geology / Tenders */}
                            <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-2">
                                {geology && (
                                    <div className={`p-2 rounded border ${geology.floodRisk ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
                                        <div className="flex items-center gap-1 mb-1">
                                            <Waves className={`h-3 w-3 ${geology.floodRisk ? 'text-red-500' : 'text-green-500'}`} />
                                            <span className="text-[10px] font-bold uppercase text-slate-600">Flood Risk</span>
                                        </div>
                                        <span className={`text-xs font-bold ${geology.floodRisk ? 'text-red-700' : 'text-green-700'}`}>{geology.floodRisk ? 'Detected' : 'Low'}</span>
                                    </div>
                                )}
                                {tenders && (
                                    <div className="p-2 rounded border bg-slate-50 border-slate-100">
                                        <div className="flex items-center gap-1 mb-1">
                                            <HardHat className="h-3 w-3 text-amber-500" />
                                            <span className="text-[10px] font-bold uppercase text-slate-600">Public Works</span>
                                        </div>
                                        <span className="text-xs font-bold text-slate-700">{tenders.activeWorks.length} Active</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </Card>
                )}

            </div>
        </div>

        {/* 3. ROOM SCAN (Detailed Findings) */}
        <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <LayoutTemplateIcon className="h-6 w-6 text-slate-400" /> Room-by-Room Scan
            </h2>
            <div className="space-y-8">
                {rooms.map((room: any, i: number) => (
                    <div key={i} className="flex flex-col md:flex-row gap-6 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        {/* Room Image */}
                        <div className="w-full md:w-1/3 aspect-[4/3] rounded-lg overflow-hidden bg-slate-100 relative group">
                            <img src={room.image_url || "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&q=80&w=800"} className="w-full h-full object-cover" alt={room.room_name} />
                             {room.zoom_points?.map((point: any, j: number) => (
                                <div key={j} 
                                     className="absolute w-6 h-6 rounded-full border-2 border-white shadow-lg bg-black/50 hover:bg-amber-500 cursor-pointer transition-colors flex items-center justify-center group/point"
                                     style={{ top: `${point.y}%`, left: `${point.x}%` }}>
                                    <div className="w-1.5 h-1.5 bg-white rounded-full" />
                                    {/* Tooltip */}
                                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-black/80 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover/point:opacity-100 pointer-events-none transition-opacity z-20">
                                        {point.label}
                                    </div>
                                </div>
                             ))}
                        </div>
                        
                        {/* Room Details */}
                        <div className="flex-1 space-y-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold text-xl text-slate-900">{room.room_name}</h3>
                                    <p className="text-sm text-slate-500 font-medium italic">"{room.one_liner}"</p>
                                </div>
                                <Badge variant="outline">Priority: High</Badge>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <p className="text-xs font-bold uppercase text-slate-400">Key Findings</p>
                                    <ul className="space-y-1">
                                        {room.findings.map((finding: string, j: number) => (
                                            <li key={j} className="text-sm text-slate-700 flex gap-2">
                                                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                                                {finding}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-xs font-bold uppercase text-slate-400">Est. Renovation</p>
                                    <ul className="space-y-1">
                                        {room.renovation_costs.map((cost: string, j: number) => (
                                            <li key={j} className="text-sm text-slate-600 font-mono bg-slate-50 px-2 py-1 rounded inline-block w-full">
                                                {cost}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>

      </div>
    </div>
  );
};

// Simple Icon component needed for the section header
const LayoutTemplateIcon = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="7" x="3" y="3" rx="1" />
        <rect width="9" height="7" x="3" y="14" rx="1" />
        <rect width="5" height="7" x="16" y="14" rx="1" />
    </svg>
);
