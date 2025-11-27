import * as React from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

export type IndicatorModel = {
  sma: { on: boolean; period: number };
  bb: { on: boolean; period: number; mult: number };
  macd: { on: boolean; fast: number; slow: number; signal: number };
  ema: { on: boolean; period: number };
  rsi: { on: boolean; period: number };
  vwap: { on: boolean };
};

export const DEFAULT_INDICATORS: IndicatorModel = {
  sma: { on: false, period: 20 },
  bb: { on: false, period: 20, mult: 2 },
  macd: { on: false, fast: 12, slow: 26, signal: 9 },
  ema: { on: true, period: 20 },
  rsi: { on: false, period: 14 },
  vwap: { on: false },
};

export function IndicatorTray({
  value,
  onChange,
  className,
}: {
  value: IndicatorModel;
  onChange: (next: IndicatorModel) => void;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);

  const set = <K extends keyof IndicatorModel, P extends keyof IndicatorModel[K]>(
    key: K,
    prop: P,
    val: IndicatorModel[K][P],
  ) => onChange({ ...value, [key]: { ...value[key], [prop]: val } as IndicatorModel[K] });

  const toggle = <K extends keyof IndicatorModel>(key: K) =>
    onChange({ ...value, [key]: { ...value[key], on: !value[key].on } as IndicatorModel[K] });

  const reset = () => onChange({ ...DEFAULT_INDICATORS });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="secondary" className={className} type="button">
          Indicators
        </Button>
      </PopoverTrigger>

      <PopoverContent
        side="bottom"
        align="start"
        className="w-[320px] p-3 space-y-4 bg-slate-900 text-slate-100 border-slate-800"
      >
        {/* SMA */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">SMA</Label>
            <div className="flex items-center gap-2">
              <span className="text-[10px] opacity-70">Period</span>
              <Input
                className="h-7 w-16"
                type="number"
                value={value.sma.period}
                onChange={(event) => set('sma', 'period', Number(event.target.value) || 0)}
              />
              <Switch checked={value.sma.on} onCheckedChange={() => toggle('sma')} />
            </div>
          </div>
        </section>

        <Separator className="bg-slate-800" />

        {/* Bollinger Bands */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Bollinger Bands</Label>
            <Switch checked={value.bb.on} onCheckedChange={() => toggle('bb')} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-[10px] mb-1 opacity-70">Period</div>
              <Input
                className="h-7"
                type="number"
                value={value.bb.period}
                onChange={(event) => set('bb', 'period', Number(event.target.value) || 0)}
              />
            </div>
            <div>
              <div className="text-[10px] mb-1 opacity-70">Mult</div>
              <Input
                className="h-7"
                type="number"
                value={value.bb.mult}
                onChange={(event) => set('bb', 'mult', Number(event.target.value) || 0)}
              />
            </div>
          </div>
        </section>

        <Separator className="bg-slate-800" />

        {/* MACD */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">MACD</Label>
            <Switch checked={value.macd.on} onCheckedChange={() => toggle('macd')} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <div className="text-[10px] mb-1 opacity-70">Fast</div>
              <Input
                className="h-7"
                type="number"
                value={value.macd.fast}
                onChange={(event) => set('macd', 'fast', Number(event.target.value) || 0)}
              />
            </div>
            <div>
              <div className="text-[10px] mb-1 opacity-70">Slow</div>
              <Input
                className="h-7"
                type="number"
                value={value.macd.slow}
                onChange={(event) => set('macd', 'slow', Number(event.target.value) || 0)}
              />
            </div>
            <div>
              <div className="text-[10px] mb-1 opacity-70">Signal</div>
              <Input
                className="h-7"
                type="number"
                value={value.macd.signal}
                onChange={(event) => set('macd', 'signal', Number(event.target.value) || 0)}
              />
            </div>
          </div>
        </section>

        <Separator className="bg-slate-800" />

        {/* EMA / RSI / VWAP */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs">EMA</Label>
            <div className="flex items-center gap-2">
              <Input
                className="h-7 w-16"
                type="number"
                value={value.ema.period}
                onChange={(event) => set('ema', 'period', Number(event.target.value) || 0)}
              />
              <Switch checked={value.ema.on} onCheckedChange={() => toggle('ema')} />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-xs">RSI</Label>
            <div className="flex items-center gap-2">
              <Input
                className="h-7 w-16"
                type="number"
                value={value.rsi.period}
                onChange={(event) => set('rsi', 'period', Number(event.target.value) || 0)}
              />
              <Switch checked={value.rsi.on} onCheckedChange={() => toggle('rsi')} />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-xs">VWAP</Label>
            <Switch checked={value.vwap.on} onCheckedChange={() => toggle('vwap')} />
          </div>
        </section>

        <div className="pt-1 flex justify-between">
          <Button variant="secondary" size="sm" type="button" onClick={reset}>
            Reset
          </Button>
          <Button size="sm" type="button" onClick={() => setOpen(false)}>
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
