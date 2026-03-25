from django.core.management.base import BaseCommand
from django.db.models import Q

from advanced.models import NewsArticle
from advanced.services.finbert_service import batch_analyze
from advanced.services.news_scraper import DEFAULT_LIMIT, enrich_news, fetch_stock_news
from advanced.utils.cache_helpers import recompute_overall_sentiment, save_new_articles_to_db
from stock_master.models import StockMaster
from stock_master.yahoo import resolve_yahoo_symbol


def _exchange_candidate(symbol: str, exchange: str) -> str | None:
    base_symbol = (symbol or "").strip().upper()
    exchange = (exchange or "").strip().upper()
    if not base_symbol:
        return None
    if "." in base_symbol:
        base_symbol = base_symbol.rsplit(".", 1)[0]
    if exchange == "NSE":
        return f"{base_symbol}.NS"
    if exchange == "BSE":
        return f"{base_symbol}.BO"
    return base_symbol


def _build_ticker_candidates(stock: StockMaster) -> list[str]:
    raw_candidates = [stock.yahoo_ticker, stock.ticker]
    try:
        resolved_symbol = resolve_yahoo_symbol(
            stock_name=stock.stock_name,
            ticker=stock.ticker,
            exchange=stock.exchange,
        )
    except Exception:
        resolved_symbol = None
    raw_candidates.append(resolved_symbol)

    exchange = (stock.exchange or "").upper()
    market = (stock.market or "").lower()
    candidates = []

    for raw in raw_candidates:
        symbol = (raw or "").strip().upper()
        if not symbol:
            continue
        base_symbol = symbol.rsplit(".", 1)[0] if "." in symbol else symbol
        candidate_group = [symbol]
        if base_symbol:
            candidate_group.append(base_symbol)

        exact_exchange_symbol = _exchange_candidate(base_symbol, exchange)
        if exact_exchange_symbol:
            candidate_group.append(exact_exchange_symbol)

        if base_symbol and exchange == "NSE" and "indian" in market:
            candidate_group.append(f"{base_symbol}.BO")

        for candidate in candidate_group:
            if candidate and candidate not in candidates:
                candidates.append(candidate)

    return candidates


class Command(BaseCommand):
    help = (
        "Fetch news for all StockMaster rows, enrich the articles, run sentiment analysis, "
        "and store them in the existing advanced news tables."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--limit",
            type=int,
            default=0,
            help="Optional number of StockMaster rows to process.",
        )
        parser.add_argument(
            "--articles",
            type=int,
            default=30,
            help="Maximum number of recent articles to pull per stock.",
        )
        parser.add_argument(
            "--ticker",
            type=str,
            default="",
            help="Optional exact ticker/yahoo_ticker filter for a single stock.",
        )
        parser.add_argument(
            "--company-contains",
            type=str,
            default="",
            help="Optional partial company-name filter.",
        )
        parser.add_argument(
            "--skip-existing",
            action="store_true",
            help="Skip stocks that already have cached news rows.",
        )

    def handle(self, *args, **options):
        article_limit = max(1, options["articles"] or DEFAULT_LIMIT)
        ticker_filter = (options["ticker"] or "").strip()
        company_filter = (options["company_contains"] or "").strip()

        queryset = StockMaster.objects.all().order_by("stock_name", "ticker")
        if ticker_filter:
            queryset = queryset.filter(
                Q(yahoo_ticker__iexact=ticker_filter) | Q(ticker__iexact=ticker_filter)
            )
        if company_filter:
            queryset = queryset.filter(stock_name__icontains=company_filter)
        if options["limit"] and options["limit"] > 0:
            queryset = queryset[: options["limit"]]

        processed = 0
        skipped = 0
        empty = 0
        failed = 0
        inserted_total = 0

        for stock in queryset:
            ticker = (stock.yahoo_ticker or stock.ticker or "").strip().upper()
            company = (stock.stock_name or ticker).strip()
            if not ticker:
                skipped += 1
                self.stdout.write(self.style.WARNING(f"SKIP  {company} -> missing ticker"))
                continue

            if options["skip_existing"] and NewsArticle.objects.filter(ticker=ticker).exists():
                skipped += 1
                self.stdout.write(self.style.WARNING(f"SKIP  {company} -> existing cache found for {ticker}"))
                continue

            ticker_candidates = _build_ticker_candidates(stock)
            try:
                raw_df = fetch_stock_news(
                    ticker,
                    company,
                    limit=article_limit,
                    ticker_candidates=ticker_candidates,
                    market_hint=stock.market,
                )
                if raw_df.empty:
                    recompute_overall_sentiment(ticker)
                    empty += 1
                    processed += 1
                    self.stdout.write(self.style.WARNING(f"EMPTY {company} -> {ticker}"))
                    continue

                enriched_df = enrich_news(raw_df)
                analyzed_articles = batch_analyze(enriched_df.to_dict(orient="records"))
                inserted = save_new_articles_to_db(ticker, company, analyzed_articles)
                recompute_overall_sentiment(ticker)

                inserted_total += inserted
                processed += 1
                self.stdout.write(
                    self.style.SUCCESS(
                        f"OK    {company} -> {ticker} | scraped={len(analyzed_articles)} inserted={inserted}"
                    )
                )
            except Exception as exc:
                failed += 1
                self.stdout.write(self.style.ERROR(f"FAIL  {company} -> {ticker} | {exc}"))

        self.stdout.write(
            self.style.SUCCESS(
                "Done. "
                f"processed={processed}, inserted={inserted_total}, empty={empty}, "
                f"skipped={skipped}, failed={failed}"
            )
        )
