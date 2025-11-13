import { MousePointer, TrendingUp, Minus, Square, Circle, Type, Pen, Trash2 } from 'lucide-react';
import { type DrawingTool } from '../lib/chartDrawings';
import { cn } from '../lib/utils';

interface ChartToolbarProps {
  activeTool: DrawingTool;
  onToolChange: (tool: DrawingTool) => void;
  onClearDrawings: () => void;
}

const TOOLS = [
  { id: 'cursor' as DrawingTool, icon: MousePointer, label: 'Select' },
  { id: 'trendline' as DrawingTool, icon: TrendingUp, label: 'Trend Line' },
  { id: 'horizontal' as DrawingTool, icon: Minus, label: 'Horizontal Line' },
  { id: 'rectangle' as DrawingTool, icon: Square, label: 'Rectangle' },
  { id: 'circle' as DrawingTool, icon: Circle, label: 'Circle' },
  { id: 'text' as DrawingTool, icon: Type, label: 'Text' },
  { id: 'freehand' as DrawingTool, icon: Pen, label: 'Freehand' },
];

export function ChartToolbar({ activeTool, onToolChange, onClearDrawings }: ChartToolbarProps) {
  return (
    <div className="flex items-center gap-2 p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
      <div className="flex items-center gap-1">
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          return (
            <button
              key={tool.id}
              onClick={() => onToolChange(tool.id)}
              title={tool.label}
              className={cn(
                'p-2 rounded-lg transition-all',
                activeTool === tool.id
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                  : 'text-slate-400 hover:bg-slate-700 hover:text-slate-200'
              )}
            >
              <Icon className="w-4 h-4" />
            </button>
          );
        })}
      </div>

      <div className="w-px h-6 bg-slate-700" />

      <button
        onClick={onClearDrawings}
        title="Clear All Drawings"
        className="p-2 rounded-lg text-slate-400 hover:bg-red-900/20 hover:text-red-400 transition-all"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}
