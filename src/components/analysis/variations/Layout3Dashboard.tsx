
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Activity, AlertTriangle, Banknote, CheckCircle2, Clock, Hammer, Home } from "lucide-react";

export const Layout3Dashboard = ({ data }: { data: any }) => {
  return (
    <div className="h-full overflow-y-auto bg-slate-900 text-slate-100 p-6">
      <div className="max-w-[1400px] mx-auto space-y-6">
        {/* Top Metrics Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-slate-800 border-slate-700 text-slate-100">
                <CardContent className="p-4 flex items-center gap-4">
                    <div className="p-3 rounded-full bg-blue-500/20 text-blue-400"><Home className="h-6 w-6" /></div>
                    <div>
                        <p className="text-xs text-slate-400 uppercase font-semibold">Property</p>
                        <p className="font-bold truncate">{data.property_info.title}</p>
                    </div>
                </CardContent>
            </Card>
             <Card className="bg-slate-800 border-slate-700 text-slate-100">
                <CardContent className="p-4 flex items-center gap-4">
                    <div className="p-3 rounded-full bg-green-500/20 text-green-400"><Banknote className="h-6 w-6" /></div>
                    <div>
                        <p className="text-xs text-slate-400 uppercase font-semibold">Valuation</p>
                        <p className="font-bold text-xl">{new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(data.property_info.price_eur)}</p>
                    </div>
                </CardContent>
            </Card>
             <Card className="bg-slate-800 border-slate-700 text-slate-100">
                <CardContent className="p-4 flex items-center gap-4">
                    <div className="p-3 rounded-full bg-amber-500/20 text-amber-400"><AlertTriangle className="h-6 w-6" /></div>
                    <div>
                        <p className="text-xs text-slate-400 uppercase font-semibold">Risk Score</p>
                        <div className="flex items-center gap-2">
                            <Progress value={65} className="w-20 h-2 bg-slate-700 [&>div]:bg-amber-500" />
                            <span className="font-bold">Medium</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
             <Card className="bg-slate-800 border-slate-700 text-slate-100">
                <CardContent className="p-4 flex items-center gap-4">
                    <div className="p-3 rounded-full bg-purple-500/20 text-purple-400"><Hammer className="h-6 w-6" /></div>
                    <div>
                        <p className="text-xs text-slate-400 uppercase font-semibold">Reno Budget</p>
                        <p className="font-bold">~€75k</p>
                    </div>
                </CardContent>
            </Card>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Risks */}
            <Card className="bg-slate-800 border-slate-700 text-slate-100 lg:col-span-1">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg"><Activity className="h-5 w-5 text-red-400" /> Risk Analysis</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {['structural_pathology', 'environmental_hostility', 'urban_legality'].map(key => {
                         const section = data.forensic_risk_audit[key];
                         return (
                             <div key={key} className="bg-slate-700/50 p-3 rounded-lg border border-slate-600">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="font-semibold capitalize text-sm">{key.replace('_', ' ')}</span>
                                    <Badge variant="outline" className={
                                        section.risk_level === 'Low' ? 'border-green-500 text-green-500' :
                                        section.risk_level === 'Medium' ? 'border-amber-500 text-amber-500' :
                                        'border-red-500 text-red-500'
                                    }>{section.risk_level}</Badge>
                                </div>
                                <ul className="space-y-1">
                                    {section.alerts.slice(0,2).map((a: string, i: number) => (
                                        <li key={i} className="text-xs text-slate-300 flex items-start gap-1">
                                            <span className="text-red-400">•</span> {a.replace(/\*\*/g, '').split(':')[0]}
                                        </li>
                                    ))}
                                </ul>
                             </div>
                         )
                    })}
                </CardContent>
            </Card>

            {/* Middle: Renovation */}
            <Card className="bg-slate-800 border-slate-700 text-slate-100 lg:col-span-1">
                 <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg"><Hammer className="h-5 w-5 text-blue-400" /> Execution Plan</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div className="p-4 bg-blue-900/20 border border-blue-800/50 rounded-lg">
                        <div className="flex items-center gap-2 mb-3">
                            <Clock className="h-4 w-4 text-blue-400" />
                            <span className="font-semibold text-blue-100">Timeline Estimate</span>
                        </div>
                        <div className="space-y-3">
                            <div className="flex justify-between text-sm text-slate-300">
                                <span>Licensing</span>
                                <span>2-3 mo</span>
                            </div>
                             <div className="flex justify-between text-sm text-slate-300">
                                <span>Construction</span>
                                <span>3-4 mo</span>
                            </div>
                            <div className="w-full bg-slate-700 h-2 rounded-full mt-2 overflow-hidden">
                                <div className="bg-blue-500 h-full w-2/3"></div>
                            </div>
                             <p className="text-xs text-center text-slate-500 mt-1">Total ~6-7 months</p>
                        </div>
                     </div>

                     <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-slate-400 uppercase">Room Breakdown</h4>
                        {data.execution_reality_check.room_by_room.slice(0,3).map((room: any) => (
                            <div key={room.room_id} className="flex justify-between items-center p-2 hover:bg-slate-700 rounded transition-colors">
                                <span className="text-sm">{room.room_name}</span>
                                <span className="text-xs font-mono text-slate-400">High Priority</span>
                            </div>
                        ))}
                     </div>
                </CardContent>
            </Card>

             {/* Right: Financials */}
             <Card className="bg-slate-800 border-slate-700 text-slate-100 lg:col-span-1">
                 <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg"><Banknote className="h-5 w-5 text-green-400" /> Financial Intel</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div className="bg-green-900/20 border border-green-800/50 p-4 rounded-lg">
                        <h4 className="font-bold text-green-100 mb-2">Hidden Costs (OpEx)</h4>
                        <ul className="space-y-2">
                             {data.financial_intelligence.hidden_opex_incentives.hidden_costs.map((c: string, i: number) => (
                                 <li key={i} className="text-sm text-slate-300 flex items-center gap-2">
                                     <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                                     {c.replace(/\*\*/g, '')}
                                 </li>
                             ))}
                        </ul>
                     </div>
                     
                      <div className="bg-purple-900/20 border border-purple-800/50 p-4 rounded-lg">
                        <h4 className="font-bold text-purple-100 mb-2">Negotiation Leverage</h4>
                         <ul className="space-y-2">
                             {data.financial_intelligence.market_context.negotiation_leverage.map((c: string, i: number) => (
                                 <li key={i} className="text-sm text-slate-300 flex items-center gap-2">
                                     <CheckCircle2 className="h-3 w-3 text-purple-400" />
                                     {c}
                                 </li>
                             ))}
                        </ul>
                     </div>
                </CardContent>
             </Card>
        </div>
      </div>
    </div>
  );
};

