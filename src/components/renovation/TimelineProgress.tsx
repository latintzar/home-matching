'use client';

interface TimelineProgressProps {
  timeline: any[];
}

export function TimelineProgress({ timeline }: TimelineProgressProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Timeline</h3>
      </div>
      
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>
        
        <div className="space-y-4">
          {timeline.map((phase, index) => (
            <div key={index} className="relative flex items-start">
              {/* Timeline dot */}
              <div className="relative z-10 flex items-center justify-center w-8 h-8 bg-white border-2 border-gray-300 rounded-full">
                <div className={`w-3 h-3 rounded-full ${
                  phase.status === 'completed' ? 'bg-green-500' :
                  phase.status === 'active' ? 'bg-blue-500' : 'bg-gray-300'
                }`}></div>
              </div>
              
              {/* Phase content */}
              <div className="ml-4 flex-1">
                <h4 className="text-sm font-medium text-gray-900">{phase.name}</h4>
                <p className="text-xs text-gray-600 mt-1">{phase.description}</p>
                <p className="text-xs text-gray-500 mt-1">{phase.duration}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
