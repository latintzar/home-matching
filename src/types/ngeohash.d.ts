declare module 'ngeohash' {
  export function encode(lat: number, lng: number, precision?: number): string;
  export function decode(hashstring: string): { latitude: number; longitude: number };
  export function decode_bbox(hashstring: string): [number, number, number, number]; // [minLat, minLng, maxLat, maxLng]
  export function neighbors(hashstring: string): string[];
  export function neighbor(hashstring: string, direction: [number, number]): string;
  export function bboxes(minLat: number, minLng: number, maxLat: number, maxLng: number, precision: number): string[];

  const Geohash: {
    encode: typeof encode;
    decode: typeof decode;
    decode_bbox: typeof decode_bbox;
    neighbors: typeof neighbors;
    neighbor: typeof neighbor;
    bboxes: typeof bboxes;
  };

  export default Geohash;
}

