import numpy as np
import pandas as pd


def add_all_indicators(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df

    df = df.copy()
    close = df["Close"]
    high = df["High"]
    low = df["Low"]
    vol = df["Volume"]

    df["sma_20"] = close.rolling(20).mean()
    df["sma_50"] = close.rolling(50).mean()
    df["ema_20"] = close.ewm(span=20, adjust=False).mean()

    delta = close.diff()
    gain = delta.clip(lower=0).rolling(14).mean()
    loss = (-delta.clip(upper=0)).rolling(14).mean().replace(0, np.nan)
    rs = gain / loss
    df["rsi_14"] = (100 - (100 / (1 + rs))).round(2)

    std_20 = close.rolling(20).std()
    df["bb_upper"] = (df["sma_20"] + 2 * std_20).round(4)
    df["bb_lower"] = (df["sma_20"] - 2 * std_20).round(4)

    ema12 = close.ewm(span=12, adjust=False).mean()
    ema26 = close.ewm(span=26, adjust=False).mean()
    df["macd"] = (ema12 - ema26).round(4)
    df["signal"] = df["macd"].ewm(span=9, adjust=False).mean().round(4)

    tr = pd.concat(
        [
            high - low,
            (high - close.shift()).abs(),
            (low - close.shift()).abs(),
        ],
        axis=1,
    ).max(axis=1)
    df["atr_14"] = tr.rolling(14).mean().round(4)

    obv = [0.0]
    for index in range(1, len(close)):
        if close.iloc[index] > close.iloc[index - 1]:
            obv.append(obv[-1] + float(vol.iloc[index]))
        elif close.iloc[index] < close.iloc[index - 1]:
            obv.append(obv[-1] - float(vol.iloc[index]))
        else:
            obv.append(obv[-1])
    df["obv"] = obv

    return df
