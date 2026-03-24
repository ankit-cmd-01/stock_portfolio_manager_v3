import csv
import os
import sys
from pathlib import Path

import django


def load_data():
    base_dir = Path(__file__).resolve().parent
    resources_dir = base_dir / "resources"
    project_root = base_dir.parent

    if str(project_root) not in sys.path:
        sys.path.insert(0, str(project_root))

    csv_files = sorted(resources_dir.glob("*.csv"))
    if not csv_files:
        raise FileNotFoundError(
            f"No CSV file found in resources folder: {resources_dir}"
        )

    if len(csv_files) > 1:
        raise RuntimeError(
            f"Multiple CSV files found in resources folder: {resources_dir}. "
            "Keep only one file there before running load_data()."
        )

    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "ai_stockanalysis.settings")
    django.setup()

    from stock_master.models import StockMaster

    csv_path = csv_files[0]
    created_count = 0
    updated_count = 0

    with csv_path.open(mode="r", encoding="utf-8-sig", newline="") as csv_file:
        reader = csv.DictReader(csv_file)
        required_columns = {"stock_name", "ticker", "market", "exchange"}
        missing_columns = required_columns.difference(reader.fieldnames or [])
        if missing_columns:
            raise ValueError(
                "CSV file is missing required columns: "
                + ", ".join(sorted(missing_columns))
            )

        for row in reader:
            stock_name = (row.get("stock_name") or "").strip()
            ticker = (row.get("ticker") or "").strip()
            market = (row.get("market") or "").strip()
            exchange = (row.get("exchange") or "").strip()

            if not all([stock_name, ticker, market, exchange]):
                continue

            _, created = StockMaster.objects.update_or_create(
                ticker=ticker,
                market=market,
                exchange=exchange,
                defaults={"stock_name": stock_name},
            )
            if created:
                created_count += 1
            else:
                updated_count += 1

    return {
        "file": str(csv_path),
        "created": created_count,
        "updated": updated_count,
    }


if __name__ == "__main__":
    print(load_data())
