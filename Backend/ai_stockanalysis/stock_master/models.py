from django.db import models


class StockCategory(models.Model):
    class CategoryType(models.TextChoices):
        INDEX = "INDEX", "Index"
        SECTOR = "SECTOR", "Sector"
        INTERNATIONAL = "INTERNATIONAL", "International"
        THEME = "THEME", "Theme"

    name = models.CharField(max_length=120, unique=True)
    slug = models.SlugField(max_length=140, unique=True)
    category_type = models.CharField(max_length=20, choices=CategoryType.choices)
    description = models.TextField(blank=True, default="")
    sort_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["sort_order", "name"]

    def __str__(self):
        return self.name


class StockMaster(models.Model):
    stock_name = models.CharField(max_length=255)
    ticker = models.CharField(max_length=50)
    yahoo_ticker = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        help_text="Exact Yahoo Finance symbol, e.g. TATACOMM.NS",
    )
    market = models.CharField(max_length=100)
    exchange = models.CharField(max_length=100)
    market_cap = models.DecimalField(max_digits=22, decimal_places=2, null=True, blank=True)
    categories = models.ManyToManyField(StockCategory, related_name="stocks", blank=True)

    class Meta:
        db_table = "stock_master"
        ordering = ["stock_name", "ticker"]

    def __str__(self):
        symbol = self.yahoo_ticker or self.ticker
        return f"{self.stock_name} ({symbol})"
