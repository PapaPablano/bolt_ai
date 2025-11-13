CREATE TABLE "public"."ml_training_data" (
    "symbol" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "open" REAL,
    "high" REAL,
    "low" REAL,
    "close" REAL,
    "volume" BIGINT,
    "sma20" REAL,
    "sma50" REAL,
    "sma200" REAL,
    "ema12" REAL,
    "ema26" REAL,
    "rsi14" REAL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (symbol, date)
);

COMMENT ON TABLE "public"."ml_training_data" IS 'Stores historical stock data enriched with technical indicators for ML model training.';

CREATE TABLE "public"."ml_predictions" (
    "symbol" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "predicted_close" REAL,
    "model_version" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (symbol, date, model_version)
);

COMMENT ON TABLE "public"."ml_predictions" IS 'Stores the output of ML models, such as predicted future prices.';

-- Create indexes for faster queries
CREATE INDEX "idx_ml_training_data_symbol_date" ON "public"."ml_training_data" (symbol, date DESC);
CREATE INDEX "idx_ml_predictions_symbol_date" ON "public"."ml_predictions" (symbol, date DESC);
