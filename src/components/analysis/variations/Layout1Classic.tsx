
import React from "react";
import { cn } from "@/lib/utils";

export const Layout1Classic = ({ data }: { data: any }) => {
  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-8">
      <div className="max-w-3xl mx-auto bg-white shadow-lg rounded-lg border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 bg-white">
            <div className="text-xs tracking-wide text-slate-500 uppercase font-semibold">Informe del Comprador</div>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{data.property_info.title}</h1>
            <p className="text-slate-500 text-sm mt-1">{data.property_info.location} • {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(data.property_info.price_eur)}</p>
        </div>

        {/* Content */}
        <div className="p-8 space-y-8">
             {/* Executive Summary */}
             <section>
                <h2 className="text-lg font-semibold text-slate-900 mb-3">Resumen Ejecutivo</h2>
                <p className="text-slate-700 leading-relaxed text-[15px]">{data.house_as_a_whole.narrative_synthesis}</p>
             </section>

             <hr className="border-slate-100" />

             {/* Chapter 1 */}
             <section>
                <div className="flex items-center gap-2 mb-4">
                    <span className="bg-slate-100 p-1.5 rounded text-lg">🛡️</span>
                    <h2 className="text-xl font-bold text-slate-900">Capítulo 1: Análisis Forense</h2>
                </div>
                <div className="grid gap-4">
                    {['structural_pathology', 'environmental_hostility', 'social_security', 'urban_legality'].map(key => {
                        const section = data.forensic_risk_audit[key];
                        if (!section) return null;
                        return (
                            <div key={key} className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                                <h3 className="font-semibold text-slate-900 mb-2 capitalize">{key.replace('_', ' ')}</h3>
                                <p className="text-slate-600 text-sm mb-3">{section.synthesis}</p>
                                {section.alerts && (
                                    <ul className="space-y-1">
                                        {section.alerts.map((alert: string, i: number) => (
                                            <li key={i} className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-100 inline-block mr-2 mb-1">
                                                {alert.replace(/\*\*/g, '')}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        );
                    })}
                </div>
             </section>
             
             <hr className="border-slate-100" />

             {/* Chapter 2 */}
             <section>
                <div className="flex items-center gap-2 mb-4">
                    <span className="bg-slate-100 p-1.5 rounded text-lg">🛠️</span>
                    <h2 className="text-xl font-bold text-slate-900">Capítulo 2: Realidad Ejecución</h2>
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-5 mb-6">
                    <h3 className="font-semibold text-blue-900 mb-2">Resumen de Renovación</h3>
                    <p className="text-blue-800 text-sm leading-relaxed mb-3">{data.execution_reality_check.renovation_reality.summary}</p>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <h4 className="text-xs font-bold text-blue-900 uppercase mb-1">Costes</h4>
                            <ul className="text-xs text-blue-800 space-y-1">
                                {data.execution_reality_check.renovation_reality.cost_estimates.map((c: string, i: number) => <li key={i}>• {c.replace(/\*\*/g, '')}</li>)}
                            </ul>
                        </div>
                        <div>
                            <h4 className="text-xs font-bold text-blue-900 uppercase mb-1">Plazos</h4>
                             <ul className="text-xs text-blue-800 space-y-1">
                                {data.execution_reality_check.renovation_reality.timeline_expectations.map((c: string, i: number) => <li key={i}>• {c.replace(/\*\*/g, '')}</li>)}
                            </ul>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    {data.execution_reality_check.room_by_room.map((room: any) => (
                        <div key={room.room_id} className="flex gap-4 border-b border-slate-100 pb-4 last:border-0">
                            <div className="w-24 h-24 bg-slate-200 rounded-lg shrink-0 flex items-center justify-center text-slate-400 text-xs">Foto</div>
                            <div>
                                <h3 className="font-semibold text-slate-900">{room.room_name}</h3>
                                <p className="text-slate-500 text-sm italic mb-2">{room.one_liner}</p>
                                <ul className="space-y-1">
                                    {room.findings.slice(0,2).map((f: string, i: number) => (
                                        <li key={i} className="text-xs text-slate-600">• {f}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    ))}
                </div>
             </section>
        </div>
      </div>
    </div>
  );
};

