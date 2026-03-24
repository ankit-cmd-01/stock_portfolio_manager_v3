from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from .models import Portfolio


class PortfolioAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user_model = get_user_model()
        self.user = self.user_model.objects.create_user(
            username="portfolio_owner",
            email="owner@example.com",
            phone_number="+911234567895",
            password="StrongPassword123!",
            is_active=True,
        )
        self.other_user = self.user_model.objects.create_user(
            username="other_owner",
            email="other@example.com",
            phone_number="+911234567896",
            password="StrongPassword123!",
            is_active=True,
        )
        self.user_portfolio = Portfolio.objects.create(
            user=self.user,
            title="Long Term Holdings",
            description="Core investment ideas",
        )
        self.other_portfolio = Portfolio.objects.create(
            user=self.other_user,
            title="Private Portfolio",
            description="Should stay hidden",
        )

    # Ensure the list endpoint only returns the authenticated user's portfolios.
    def test_list_only_returns_authenticated_users_portfolios(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get("/portfolio/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["count"], 1)
        self.assertEqual(response.json()["portfolios"][0]["id"], self.user_portfolio.id)

    # Ensure create ignores any client-supplied user and assigns request.user.
    def test_create_portfolio_assigns_authenticated_user(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            "/portfolio/",
            {
                "user": self.other_user.id,
                "title": "Swing Trades",
                "description": "Short-term ideas",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created_portfolio = Portfolio.objects.get(id=response.json()["portfolio"]["id"])
        self.assertEqual(created_portfolio.user, self.user)

    # Ensure another user's portfolio returns 404 instead of leaking existence.
    def test_detail_returns_404_for_other_users_portfolio(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get(f"/portfolio/{self.other_portfolio.id}/")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(
            response.json(),
            {"error": "Portfolio not found or access denied"},
        )

    # Ensure partial updates only modify the authenticated user's own portfolio.
    def test_patch_updates_authenticated_users_portfolio(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.patch(
            f"/portfolio/{self.user_portfolio.id}/",
            {"title": "Updated Title"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user_portfolio.refresh_from_db()
        self.assertEqual(self.user_portfolio.title, "Updated Title")
        self.assertEqual(self.user_portfolio.description, "Core investment ideas")

    # Ensure delete removes only the authenticated user's own portfolio.
    def test_delete_removes_authenticated_users_portfolio(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.delete(f"/portfolio/{self.user_portfolio.id}/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(Portfolio.objects.filter(id=self.user_portfolio.id).exists())
