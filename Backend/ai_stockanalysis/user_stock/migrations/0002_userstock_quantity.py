from decimal import Decimal

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("user_stock", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="userstock",
            name="quantity",
            field=models.DecimalField(decimal_places=4, default=Decimal("1"), max_digits=14),
        ),
    ]
