export type DrawingTool = 'cursor' | 'trendline' | 'horizontal' | 'rectangle' | 'circle' | 'text' | 'freehand';

export interface Drawing {
  id: string;
  tool: DrawingTool;
  points: Array<{ x: number; y: number }>;
  color: string;
  text?: string;
}

export class DrawingManager {
  private drawings: Drawing[] = [];
  private currentDrawing: Drawing | null = null;
  private activeTool: DrawingTool = 'cursor';

  setActiveTool(tool: DrawingTool) {
    this.activeTool = tool;
  }

  getActiveTool(): DrawingTool {
    return this.activeTool;
  }

  startDrawing(x: number, y: number, color: string = '#3b82f6') {
    if (this.activeTool === 'cursor') return;

    this.currentDrawing = {
      id: Date.now().toString(),
      tool: this.activeTool,
      points: [{ x, y }],
      color,
    };
  }

  continueDrawing(x: number, y: number) {
    if (!this.currentDrawing) return;

    if (this.activeTool === 'freehand') {
      this.currentDrawing.points.push({ x, y });
    } else {
      if (this.currentDrawing.points.length === 1) {
        this.currentDrawing.points.push({ x, y });
      } else {
        this.currentDrawing.points[1] = { x, y };
      }
    }
  }

  endDrawing() {
    if (this.currentDrawing) {
      this.drawings.push(this.currentDrawing);
      this.currentDrawing = null;
    }
  }

  getDrawings(): Drawing[] {
    return this.drawings;
  }

  getCurrentDrawing(): Drawing | null {
    return this.currentDrawing;
  }

  clearDrawings() {
    this.drawings = [];
    this.currentDrawing = null;
  }

  removeDrawing(id: string) {
    this.drawings = this.drawings.filter(d => d.id !== id);
  }
}
