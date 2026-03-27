from django.db import models

from portfolio.models import Portfolio
from stock_master.models import StockMaster


class QualityStock(models.Model):
    class BuySignal(models.TextChoices):
        BUY = "BUY", "Buy"
        HOLD = "HOLD", "Hold"
        SELL = "SELL", "Sell"

    portfolio = models.ForeignKey(
        Portfolio,
        on_delete=models.CASCADE,
        related_name="quality_stocks",
    )
    stock = models.ForeignKey(
        StockMaster,
        on_delete=models.CASCADE,
        related_name="quality_stock_reports",
    )
    ai_rating = models.FloatField(default=0.0)
    buy_signal = models.CharField(
        max_length=4,
        choices=BuySignal.choices,
        default=BuySignal.HOLD,
    )
    report_json = models.JSONField(default=dict, blank=True)
    graphs_data = models.JSONField(default=dict, blank=True)
    generated_at = models.DateTimeField(auto_now=True)
    selected_by_user = models.BooleanField(default=True)

    class Meta:
        ordering = ["-generated_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["portfolio", "stock"],
                name="quality_stocks_portfolio_stock_uniq",
            )
        ]

    def __str__(self):
        symbol = self.stock.yahoo_ticker or self.stock.ticker
        return f"{self.portfolio.title} | {symbol} | {self.buy_signal}"

