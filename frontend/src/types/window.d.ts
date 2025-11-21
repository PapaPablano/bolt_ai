export {};

declare global {
  interface Window {
    __probe?: {
      macdBarSpacing: number | null;
      seriesCount: number;
      setMacdThickness: (t: 'thin' | 'normal' | 'wide') => void;
    };
  }
}
