from rest_framework.routers import DefaultRouter

from .views import QualityStockViewSet


router = DefaultRouter()
router.register("", QualityStockViewSet, basename="quality-stock")

urlpatterns = router.urls

