import { useMemo } from 'react';
import type { TF } from '@/types/prefs';
import { useChartPrefs } from '@/hooks/useChartPrefs';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

export function IndicatorMenu({ timeframe }: { timeframe: TF }) {
  const { getTfPreset, updateTfPreset } = useChartPrefs();
  const preset = useMemo(() => getTfPreset(timeframe), [getTfPreset, timeframe]);

  const numberChange = (n: number, fallback: number) => (Number.isFinite(n) && n > 0 ? n : fallback);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="secondary">Indicators</Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-3">
        <Section title="SMA">
          <Row>
            <Switch checked={preset.useSMA} onCheckedChange={(v) => updateTfPreset(timeframe, { useSMA: v })} />
            <Param
              label="Period"
              value={preset.smaPeriod}
              onChange={(n) => updateTfPreset(timeframe, { smaPeriod: numberChange(n, preset.smaPeriod) })}
            />
          </Row>
        </Section>
        <Separator />
        <Section title="EMA">
          <Row>
            <Switch checked={preset.useEMA} onCheckedChange={(v) => updateTfPreset(timeframe, { useEMA: v })} />
            <Param
              label="Period"
              value={preset.emaPeriod}
              onChange={(n) => updateTfPreset(timeframe, { emaPeriod: numberChange(n, preset.emaPeriod) })}
            />
          </Row>
        </Section>
        <Separator />
        <Section title="Bollinger Bands">
          <Row>
            <Switch checked={preset.useBB} onCheckedChange={(v) => updateTfPreset(timeframe, { useBB: v })} />
            <Param
              label="Period"
              value={preset.bbPeriod}
              onChange={(n) => updateTfPreset(timeframe, { bbPeriod: numberChange(n, preset.bbPeriod) })}
            />
            <Param
              label="Mult"
              value={preset.bbMult}
              onChange={(n) => updateTfPreset(timeframe, { bbMult: numberChange(n, preset.bbMult) })}
            />
          </Row>
        </Section>
        <Separator />
        <Section title="RSI">
          <Row>
            <Switch checked={preset.useRSI} onCheckedChange={(v) => updateTfPreset(timeframe, { useRSI: v })} />
            <Param
              label="Period"
              value={preset.rsiPeriod}
              onChange={(n) => updateTfPreset(timeframe, { rsiPeriod: numberChange(n, preset.rsiPeriod) })}
            />
          </Row>
        </Section>
        <Separator />
        <Section title="SuperTrend-AI">
          <Row>
            <Switch checked={!!preset.useSTAI} onCheckedChange={(v) => updateTfPreset(timeframe, { useSTAI: v })} />
            {preset.useSTAI && (
              <>
                <Param
                  label="ATR"
                  value={preset.stAiAtrLen ?? 14}
                  onChange={(n) => updateTfPreset(timeframe, { stAiAtrLen: numberChange(n, preset.stAiAtrLen ?? 14) })}
                />
                <Param
                  label="Min"
                  step="0.1"
                  value={preset.stAiMin ?? 1.5}
                  onChange={(n) => updateTfPreset(timeframe, { stAiMin: numberChange(n, preset.stAiMin ?? 1.5) })}
                />
                <Param
                  label="Mid"
                  step="0.1"
                  value={preset.stAiMid ?? 2.0}
                  onChange={(n) => updateTfPreset(timeframe, { stAiMid: numberChange(n, preset.stAiMid ?? 2.0) })}
                />
                <Param
                  label="Max"
                  step="0.1"
                  value={preset.stAiMax ?? 3.0}
                  onChange={(n) => updateTfPreset(timeframe, { stAiMax: numberChange(n, preset.stAiMax ?? 3.0) })}
                />
              </>
            )}
          </Row>
        </Section>
        <Separator />
        <Section title="MACD">
          <Row>
            <Switch checked={!!preset.useMACD} onCheckedChange={(v) => updateTfPreset(timeframe, { useMACD: v })} />
            {preset.useMACD && (
              <>
                <Param
                  label="Fast"
                  value={preset.macdFast ?? 12}
                  onChange={(n) => updateTfPreset(timeframe, { macdFast: numberChange(n, preset.macdFast ?? 12) })}
                />
                <Param
                  label="Slow"
                  value={preset.macdSlow ?? 26}
                  onChange={(n) => updateTfPreset(timeframe, { macdSlow: numberChange(n, preset.macdSlow ?? 26) })}
                />
                <Param
                  label="Signal"
                  value={preset.macdSignal ?? 9}
                  onChange={(n) => updateTfPreset(timeframe, { macdSignal: numberChange(n, preset.macdSignal ?? 9) })}
                />
              </>
            )}
          </Row>
        </Section>
        <Separator />
        <Section title="VWAP">
          <Row>
            <Switch checked={!!preset.useVWAP} onCheckedChange={(v) => updateTfPreset(timeframe, { useVWAP: v })} />
          </Row>
        </Section>
      </PopoverContent>
    </Popover>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-slate-100">{title}</div>
      {children}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-3 flex-wrap">{children}</div>;
}

function Param({ label, value, onChange, step = '1' }: { label: string; value: number; step?: string; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Label className="w-14">{label}</Label>
      <Input
        className="w-20"
        type="number"
        min={1}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value || '0'))}
      />
    </div>
  );
}
