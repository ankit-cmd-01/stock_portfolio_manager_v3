from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("advanced", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="newsarticle",
            name="link",
            field=models.URLField(max_length=500),
        ),
        migrations.AddConstraint(
            model_name="newsarticle",
            constraint=models.UniqueConstraint(
                fields=("ticker", "link"),
                name="advanced_newsarticle_ticker_link_uniq",
            ),
        ),
    ]
