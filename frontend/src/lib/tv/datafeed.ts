import { normalizeForTV, type Bar } from '@/utils/bars-tv';
import { validateSeriesMs } from '@/utils/validateSeries';
import type { TF } from '@/utils/nyseTime';

export type PeriodParams = {
  from: number;
  to: number;
  countBack: number;
  firstDataRequest: boolean;
};

export type HistoryCallback = (bars: Bar[], meta: { noData?: boolean; nextTime?: number }) => void;
export type ErrorCallback = (reason?: string) => void;
export type FetchBars = (symbolInfo: unknown, tf: TF, periodParams: PeriodParams) => Promise<Bar[]>;
export type ResolutionMapper = (resolution: string) => TF;

export interface TvDatafeedDeps {
  fetchBars: FetchBars;
  resToTf: ResolutionMapper;
  logger?: (msg: string, ...args: unknown[]) => void;
  validatorLabel?: string;
}

export function createTvDatafeed({ fetchBars, resToTf, logger, validatorLabel = 'tv-history' }: TvDatafeedDeps) {
  return {
    async getBars(
      symbolInfo: unknown,
      resolution: string,
      periodParams: PeriodParams,
      onHistoryCallback: HistoryCallback,
      onErrorCallback?: ErrorCallback,
    ) {
      try {
        const tf = resToTf(resolution);
        const raw = await fetchBars(symbolInfo, tf, periodParams);
        const norm = normalizeForTV(raw, tf);
        const info = (symbolInfo as { name?: string; ticker?: string }) ?? {};
        const symLabel = info.ticker || info.name || '';
        const label = symLabel ? `${validatorLabel}:${symLabel}` : validatorLabel;
        validateSeriesMs(norm, tf, label);
        onHistoryCallback(norm, { noData: norm.length === 0 });
      } catch (err) {
        logger?.('[tv/getBars]', err);
        onErrorCallback?.(err instanceof Error ? err.message : String(err));
      }
    },
  };
}
