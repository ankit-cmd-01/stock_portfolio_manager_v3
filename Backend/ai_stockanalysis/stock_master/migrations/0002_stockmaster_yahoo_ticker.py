from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("stock_master", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="stockmaster",
            name="yahoo_ticker",
            field=models.CharField(
                blank=True,
                help_text="Exact Yahoo Finance symbol, e.g. TATACOMM.NS",
                max_length=50,
                null=True,
            ),
        ),
    ]
