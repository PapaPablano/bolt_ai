import os
from typing import Tuple

import pandas as pd
import psycopg2
from lightgbm import LGBMRegressor
from sklearn.metrics import mean_absolute_error
from sklearn.model_selection import TimeSeriesSplit


def get_connection() -> psycopg2.extensions.connection:
  dsn = os.environ.get("DATABASE_URL")
  if not dsn:
    raise RuntimeError("DATABASE_URL environment variable is required")
  return psycopg2.connect(dsn)


def load_training_data(conn: psycopg2.extensions.connection) -> pd.DataFrame:
  query = """
    SELECT
      symbol,
      date,
      open,
      high,
      low,
      close,
      volume,
      sma20,
      sma50,
      sma200,
      ema12,
      ema26,
      rsi14
    FROM public.ml_training_data
    ORDER BY symbol, date
  """
  return pd.read_sql(query, conn)


def build_features(df: pd.DataFrame, horizon_days: int = 1) -> Tuple[pd.DataFrame, pd.Series]:
  df = df.copy()
  df["return"] = df.groupby("symbol")["close"].pct_change()
  df["target"] = df.groupby("symbol")["close"].shift(-horizon_days) / df["close"] - 1.0
  feature_cols = [
    "open",
    "high",
    "low",
    "close",
    "volume",
    "sma20",
    "sma50",
    "sma200",
    "ema12",
    "ema26",
    "rsi14",
    "return",
  ]
  df = df.dropna(subset=feature_cols + ["target"])
  X = df[feature_cols]
  y = df["target"]
  return X, y


def train_model(X: pd.DataFrame, y: pd.Series) -> Tuple[LGBMRegressor, float]:
  tscv = TimeSeriesSplit(n_splits=5)
  best_mae = float("inf")
  best_model: LGBMRegressor | None = None
  for train_idx, test_idx in tscv.split(X):
    X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
    y_train, y_test = y.iloc[train_idx], y.iloc[test_idx]
    model = LGBMRegressor(n_estimators=200, learning_rate=0.05, max_depth=-1)
    model.fit(X_train, y_train)
    preds = model.predict(X_test)
    mae = mean_absolute_error(y_test, preds)
    if mae < best_mae:
      best_mae = mae
      best_model = model
  if best_model is None:
    raise RuntimeError("No model trained")
  return best_model, best_mae


def write_forecasts(
  conn: psycopg2.extensions.connection,
  df: pd.DataFrame,
  preds: pd.Series,
  model_name: str,
  model_version: str,
  horizon_minutes: int,
) -> None:
  cursor = conn.cursor()
  insert_sql = """
    INSERT INTO public.forecasts (
      symbol_id,
      timeframe,
      asof,
      horizon_minutes,
      yhat,
      yhat_lo,
      yhat_hi,
      model,
      version
    )
    VALUES (
      (SELECT id FROM public.symbols WHERE ticker = %s),
      %s,
      %s,
      %s,
      %s,
      NULL,
      NULL,
      %s,
      %s
    )
    ON CONFLICT (symbol_id, timeframe, asof, horizon_minutes)
    DO UPDATE SET
      yhat = EXCLUDED.yhat,
      model = EXCLUDED.model,
      version = EXCLUDED.version
  """
  for (_, row), yhat in zip(df.iterrows(), preds):
    cursor.execute(
      insert_sql,
      (
        row["symbol"],
        "1d",
        row["date"],
        horizon_minutes,
        float(yhat),
        model_name,
        model_version,
      ),
    )
  conn.commit()
  cursor.close()


def main() -> None:
  conn = get_connection()
  try:
    df = load_training_data(conn)
    if df.empty:
      return
    X, y = build_features(df, horizon_days=1)
    if X.empty:
      return
    model, mae = train_model(X, y)
    preds = pd.Series(model.predict(X), index=X.index)
    latest_date = df["date"].max()
    latest_mask = df["date"] == latest_date
    df_latest = df.loc[latest_mask, ["symbol", "date"]].drop_duplicates()
    if df_latest.empty:
      return
    preds_latest = preds.loc[df_latest.index]
    write_forecasts(
      conn,
      df_latest,
      preds_latest,
      model_name="lgbm_return_1d",
      model_version="v0",
      horizon_minutes=24 * 60,
    )
  finally:
    conn.close()


if __name__ == "__main__":
  main()
