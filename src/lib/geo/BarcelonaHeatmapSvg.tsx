// Barcelona Heatmap SVG Component
// Original SVG renderer; geometry is supplied by the recipient.

/** Recipient-provided geometry; original unverified generated paths stay private. */
export interface BarcelonaHeatmapPaths {
  BARCELONA_BOUNDARY_PATH: string;
  RED_ZONE_PATHS: string[];
  YELLOW_ZONE_PATHS: string[];
}

export const BarcelonaHeatmapSvg = ({paths}: {paths: BarcelonaHeatmapPaths}) => {
  const {BARCELONA_BOUNDARY_PATH, RED_ZONE_PATHS, YELLOW_ZONE_PATHS} = paths;
  return (
  <svg viewBox="0 0 400 300" className="absolute inset-0 w-full h-full">
    <defs>
      <clipPath id="barcelona-clip">
        <path d={BARCELONA_BOUNDARY_PATH} />
      </clipPath>
    </defs>
    
    <g clipPath="url(#barcelona-clip)">
      {/* Blue base - entire Barcelona */}
      <path d={BARCELONA_BOUNDARY_PATH} fill="#3b82f6" fillOpacity="0.4" />
      
      {/* Yellow commute zones */}
      {YELLOW_ZONE_PATHS.map((path, i) => (
        <path key={`yellow-${i}`} d={path} fill="#eab308" fillOpacity="0.5" />
      ))}
      
      {/* Red lifestyle hotspots */}
      {RED_ZONE_PATHS.map((path, i) => (
        <path key={`red-${i}`} d={path} fill="#ef4444" fillOpacity="0.6" />
      ))}
    </g>
  </svg>
);
};
