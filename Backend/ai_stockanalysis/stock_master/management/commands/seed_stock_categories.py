from django.core.management.base import BaseCommand
from django.db import transaction

from stock_master.models import StockCategory, StockMaster


CATEGORY_DEFINITIONS = [
    ("NIFTY 50", "nifty-50", StockCategory.CategoryType.INDEX, "Blue-chip Indian leaders."),
    ("NIFTY NEXT 50", "nifty-next-50", StockCategory.CategoryType.INDEX, "Next layer of Indian large caps."),
    ("NIFTY 100", "nifty-100", StockCategory.CategoryType.INDEX, "Broad Indian market exposure."),
    ("IT", "it", StockCategory.CategoryType.SECTOR, "Technology and software names."),
    ("Banking", "banking", StockCategory.CategoryType.SECTOR, "Banks and financial institutions."),
    ("Pharma", "pharma", StockCategory.CategoryType.SECTOR, "Healthcare and pharma names."),
    ("Energy", "energy", StockCategory.CategoryType.SECTOR, "Power, oil, and energy exposure."),
    ("FMCG", "fmcg", StockCategory.CategoryType.SECTOR, "Fast-moving consumer goods."),
    ("Auto", "auto", StockCategory.CategoryType.SECTOR, "Automotive and mobility names."),
    ("Metals", "metals", StockCategory.CategoryType.SECTOR, "Metals, mining, and steel."),
    ("Telecom", "telecom", StockCategory.CategoryType.SECTOR, "Telecom and connectivity plays."),
    ("Financial Services", "financial-services", StockCategory.CategoryType.SECTOR, "Broader finance and NBFC names."),
    ("Top Global 20", "top-global-20", StockCategory.CategoryType.INTERNATIONAL, "Large global leaders."),
    ("US Tech", "us-tech", StockCategory.CategoryType.INTERNATIONAL, "US software, cloud, and semiconductor names."),
    ("Dividend Picks", "dividend-picks", StockCategory.CategoryType.THEME, "Income-oriented holdings."),
    ("Growth Stocks", "growth-stocks", StockCategory.CategoryType.THEME, "Faster growing businesses."),
    ("Undervalued", "undervalued", StockCategory.CategoryType.THEME, "Value-oriented holdings."),
    ("High Momentum", "high-momentum", StockCategory.CategoryType.THEME, "Stocks with strong trend leadership."),
]

INDIAN_NIFTY_50_PATTERNS = [
    "RELIANCE",
    "TCS",
    "INFOSYS",
    "HDFCBANK",
    "ICICIBANK",
    "KOTAK",
    "AXISBANK",
    "SBIN",
    "LT",
    "ITC",
    "HINDUNILVR",
    "ASIANPAINT",
    "MARUTI",
    "SUNPHARMA",
    "BAJFINANCE",
    "BAJAJFINSV",
    "NTPC",
    "POWERGRID",
    "TITAN",
    "WIPRO",
    "HCLTECH",
    "TECHM",
    "ULTRACEMCO",
    "NESTLE",
    "ONGC",
    "COALINDIA",
    "ADANIENT",
    "ADANIPORTS",
    "TATAMOTORS",
    "TATASTEEL",
    "TATACONSUM",
    "BHARTI",
    "DRREDDY",
    "CIPLA",
    "GRASIM",
    "APOLLOHOSP",
    "HEROMOTOCO",
    "EICHER",
    "DIVIS",
    "JSWSTEEL",
    "HINDALCO",
    "BRITANNIA",
    "SHRIRAMFIN",
    "BPCL",
    "HDFCLIFE",
    "INDUSINDBK",
    "M&MFIN",
    "M&M",
    "DMART",
    "PIDILITIND",
]

SECTOR_RULES = {
    "it": ["TECH", "INFOSYS", "WIPRO", "TCS", "HCL", "LTIM", "LTTS", "PERSISTENT", "MPHASIS", "COFORGE", "MINDTREE"],
    "banking": ["BANK", "HDFC", "ICICI", "AXIS", "KOTAK", "INDUSIND", "SBIN", "FEDERAL", "BANDHAN", "IDFC", "AUBANK", "RBL", "M&MFIN", "SHRIRAMFIN", "CHOLAFIN"],
    "pharma": ["PHARMA", "DRREDDY", "CIPLA", "SUNPHARMA", "LUPIN", "ALKEM", "AUROBINDO", "BIOCON", "DIVIS", "GLENMARK", "TORNTPHARM"],
    "energy": ["ENERGY", "POWER", "NTPC", "ONGC", "COAL", "BPCL", "HPCL", "ADANI", "OIL", "RELIANCE"],
    "fmcg": ["ITC", "HUL", "NESTLE", "BRITANNIA", "DABUR", "MARICO", "COLPAL", "GODREJ", "TATACONSUM"],
    "auto": ["AUTO", "MARUTI", "MOTOR", "EICHER", "HERO", "TVS", "TATA MOTORS", "M&M", "BAJAJ AUTO", "BAJAJ", "HEROMOTOCO", "EICHERMOT"],
    "metals": ["METAL", "STEEL", "HINDALCO", "JSW", "TATASTEEL", "SAIL", "JINDAL", "NMDC", "COAL"],
    "telecom": ["TELECOM", "BHARTI", "AIRTEL", "IDEA", "VODAFONE"],
    "financial-services": ["FINANCE", "CAPITAL", "INSURANCE", "BAJAJFINSV", "CHOLAFIN", "SHRIRAMFIN", "M&MFIN", "BIRLA", "NIPPON"],
}

TOP_GLOBAL_20 = [
    "3M",
    "ABBOTT",
    "ABBVIE",
    "ACCENTURE",
    "ADOBE",
    "AMAZON",
    "AMERICAN EXPRESS",
    "AMERICAN TOWER",
    "APPLIED MATERIALS",
    "APPLE",
    "BROADCOM",
    "CISCO",
    "COSTCO",
    "ELI LILLY",
    "MASTERCARD",
    "MICROSOFT",
    "NVIDIA",
    "ORACLE",
    "VISA",
    "AIRBNB",
]

US_TECH_RULES = [
    "ADBE",
    "AMD",
    "AMZN",
    "AAPL",
    "GOOGL",
    "GOOG",
    "META",
    "MSFT",
    "NVDA",
    "ORCL",
    "CRM",
    "SNOW",
    "UBER",
    "ABNB",
    "INTU",
    "QCOM",
    "CSCO",
    "TSLA",
    "NOW",
    "SHOP",
]

DIVIDEND_RULES = [
    "3M",
    "AFLAC",
    "ALLSTATE",
    "ALTRIA",
    "APPLIED MATERIALS",
    "AIR PRODUCTS",
    "AMERICAN TOWER",
    "JOHNSON & JOHNSON",
    "PEPSICO",
    "COCA-COLA",
    "VERIZON",
    "AT&T",
    "ABBVIE",
    "CISCO",
    "WALMART",
]

GROWTH_RULES = [
    "AMAZON",
    "ADOBE",
    "AMD",
    "AIRBNB",
    "ALPHABET",
    "META",
    "MICROSOFT",
    "NVIDIA",
    "TESLA",
    "UBER",
    "SNOW",
    "SERVICENOW",
    "SHOPIFY",
]

UNDERVALUED_RULES = [
    "ITC",
    "WIPRO",
    "TCS",
    "CIPLA",
    "SBI",
    "COAL INDIA",
    "BPCL",
    "ONGC",
    "ALLSTATE",
    "AFLAC",
    "ALTRIA",
    "INTEL",
    "VERIZON",
]

HIGH_MOMENTUM_RULES = [
    "ADANI",
    "AMD",
    "NVDA",
    "TSLA",
    "AMAZON",
    "META",
    "GOOGLE",
    "GOOG",
    "GOOGL",
    "AIRBNB",
    "UBER",
    "SNOW",
    "SHOP",
]


def match_any(stock, patterns):
    haystack = f"{stock.stock_name} {stock.ticker}".upper()
    return any(pattern.upper() in haystack for pattern in patterns)


class Command(BaseCommand):
    help = "Seed stock categories and assign them to stock master rows."

    def handle(self, *args, **options):
        with transaction.atomic():
            categories = {}
            for index, (name, slug, category_type, description) in enumerate(CATEGORY_DEFINITIONS):
                category, _ = StockCategory.objects.update_or_create(
                    slug=slug,
                    defaults={
                        "name": name,
                        "category_type": category_type,
                        "description": description,
                        "sort_order": index,
                        "is_active": True,
                    },
                )
                categories[slug] = category

            for stock in StockMaster.objects.all().prefetch_related("categories"):
                stock.categories.clear()

                if stock.market.upper() == "INDIAN":
                    stock.categories.add(categories["nifty-100"])
                    if match_any(stock, INDIAN_NIFTY_50_PATTERNS):
                        stock.categories.add(categories["nifty-50"])
                    else:
                        stock.categories.add(categories["nifty-next-50"])

                if match_any(stock, SECTOR_RULES["it"]):
                    stock.categories.add(categories["it"])
                if match_any(stock, SECTOR_RULES["banking"]):
                    stock.categories.add(categories["banking"])
                if match_any(stock, SECTOR_RULES["pharma"]):
                    stock.categories.add(categories["pharma"])
                if match_any(stock, SECTOR_RULES["energy"]):
                    stock.categories.add(categories["energy"])
                if match_any(stock, SECTOR_RULES["fmcg"]):
                    stock.categories.add(categories["fmcg"])
                if match_any(stock, SECTOR_RULES["auto"]):
                    stock.categories.add(categories["auto"])
                if match_any(stock, SECTOR_RULES["metals"]):
                    stock.categories.add(categories["metals"])
                if match_any(stock, SECTOR_RULES["telecom"]):
                    stock.categories.add(categories["telecom"])
                if match_any(stock, SECTOR_RULES["financial-services"]):
                    stock.categories.add(categories["financial-services"])

                if stock.market.upper() == "US":
                    if match_any(stock, TOP_GLOBAL_20):
                        stock.categories.add(categories["top-global-20"])
                    if match_any(stock, US_TECH_RULES):
                        stock.categories.add(categories["us-tech"])
                    if match_any(stock, DIVIDEND_RULES):
                        stock.categories.add(categories["dividend-picks"])
                    if match_any(stock, GROWTH_RULES):
                        stock.categories.add(categories["growth-stocks"])
                    if match_any(stock, UNDERVALUED_RULES):
                        stock.categories.add(categories["undervalued"])
                    if match_any(stock, HIGH_MOMENTUM_RULES):
                        stock.categories.add(categories["high-momentum"])
                else:
                    if match_any(stock, DIVIDEND_RULES):
                        stock.categories.add(categories["dividend-picks"])
                    if match_any(stock, UNDERVALUED_RULES):
                        stock.categories.add(categories["undervalued"])
                    if match_any(stock, HIGH_MOMENTUM_RULES):
                        stock.categories.add(categories["high-momentum"])

        self.stdout.write(self.style.SUCCESS("Stock categories seeded successfully."))
