from django.conf import settings
from django.db import models

from portfolio.models import Portfolio
from stock_master.models import StockMaster


class UserStock(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="user_stocks",
    )
    portfolio = models.ForeignKey(
        Portfolio,
        on_delete=models.CASCADE,
        related_name="user_stocks",
    )
    stock = models.ForeignKey(
        StockMaster,
        on_delete=models.CASCADE,
        related_name="user_stocks",
    )
    quantity = models.DecimalField(max_digits=14, decimal_places=4, default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    modified_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [["user", "portfolio", "stock"]]
        ordering = ["-created_at"]

    def __str__(self):
        symbol = self.stock.yahoo_ticker or self.stock.ticker
        return f"{self.user.username} | {symbol} | {self.portfolio.title}"


class UserStockData(models.Model):
    user_stock = models.ForeignKey(
        UserStock,
        on_delete=models.CASCADE,
        related_name="stock_data",
    )
    timestamp = models.DateTimeField()
    open = models.DecimalField(max_digits=14, decimal_places=4)
    high = models.DecimalField(max_digits=14, decimal_places=4)
    low = models.DecimalField(max_digits=14, decimal_places=4)
    close = models.DecimalField(max_digits=14, decimal_places=4)
    volume = models.BigIntegerField()
    pe_ratio = models.DecimalField(
        max_digits=14,
        decimal_places=4,
        null=True,
        blank=True,
    )

    class Meta:
        unique_together = [["user_stock", "timestamp"]]
        ordering = ["timestamp"]

    def __str__(self):
        symbol = self.user_stock.stock.yahoo_ticker or self.user_stock.stock.ticker
        return f"{symbol} @ {self.timestamp}"
