from django.contrib import admin

from .models import Portfolio


@admin.register(Portfolio)
class PortfolioAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "title", "created_at", "modified_at")
    list_select_related = ("user",)
    search_fields = ("user__username", "title", "description")
    list_filter = ("created_at", "modified_at")
