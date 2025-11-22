export {};

declare global {
  interface Window {
    __probe?: {
      [symbol: string]: {
        macdBarSpacing?: number | null;
        seriesCount?: number;
        setMacdThickness?: (t: 'thin' | 'normal' | 'wide') => void;
        visibleLogicalRange?: { from: number; to: number } | null;
        dataLogicalRange?: { from: number; to: number } | null;
        econEventCount?: number;
        econMarkerCount?: number;
      };
    };
  }
}
