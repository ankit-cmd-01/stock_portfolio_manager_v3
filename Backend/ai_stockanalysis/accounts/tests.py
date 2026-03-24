from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken
from unittest.mock import patch

from .models import CustomUser
from .serializers import RegisterSerializer


class CustomUserModelTests(TestCase):
    def test_is_otp_valid_returns_clear_error_when_otp_missing(self):
        user = CustomUser.objects.create_user(
            username="missingotp",
            email="missing@example.com",
            phone_number="+911234567890",
            password="StrongPassword123!",
        )

        is_valid, message = user.is_otp_valid("123456")

        self.assertFalse(is_valid)
        self.assertEqual(message, "No active OTP found. Request a new one.")

    def test_is_otp_valid_rejects_expired_otp(self):
        user = CustomUser.objects.create_user(
            username="expiredotp",
            email="expired@example.com",
            phone_number="+911234567891",
            password="StrongPassword123!",
            otp_code="123456",
            otp_created_at=timezone.now() - timezone.timedelta(minutes=6),
            otp_purpose="register",
        )

        is_valid, message = user.is_otp_valid("123456")

        self.assertFalse(is_valid)
        self.assertEqual(message, "OTP expired! Request a new one.")


class RegisterSerializerTests(TestCase):
    def test_register_serializer_normalizes_email_and_generates_unique_username(self):
        CustomUser.objects.create_user(
            username="john",
            email="john@example.com",
            phone_number="+911234567892",
            password="StrongPassword123!",
        )
        serializer = RegisterSerializer(
            data={
                "first_name": "John",
                "last_name": "Second",
                "email": "John@another.com",
                "phone_number": "+911234567893",
                "password": "StrongPassword123!",
                "confirm_password": "StrongPassword123!",
            }
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        user = serializer.save()

        self.assertEqual(user.email, "john@another.com")
        self.assertEqual(user.username, "john_2")
        self.assertFalse(user.is_active)


class LogoutAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = CustomUser.objects.create_user(
            username="logoutuser",
            email="logout@example.com",
            phone_number="+911234567894",
            password="StrongPassword123!",
            is_active=True,
        )
        self.refresh = RefreshToken.for_user(self.user)
        self.access = str(self.refresh.access_token)

    def test_logout_blacklists_refresh_token(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.access}")

        response = self.client.post(
            "/accounts/logout/",
            {"refresh": str(self.refresh)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json(), {"message": "Logout successful."})
        self.assertTrue(
            BlacklistedToken.objects.filter(token__jti=self.refresh["jti"]).exists()
        )

    def test_logout_requires_authentication(self):
        response = self.client.post(
            "/accounts/logout/",
            {"refresh": str(self.refresh)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class ResendRegistrationOTPAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = CustomUser.objects.create_user(
            username="pendinguser",
            email="pending@example.com",
            phone_number="+911234567899",
            password="StrongPassword123!",
            is_active=False,
            is_phone_verified=False,
        )

    @patch("accounts.views.generate_and_send_otp", return_value=True)
    def test_resend_registration_otp_for_pending_user(self, mocked_generate_and_send_otp):
        response = self.client.post(
            "/accounts/resend-register-otp/",
            {"phone_number": self.user.phone_number},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json(), {"message": "OTP resent to your Telegram account."})
        mocked_generate_and_send_otp.assert_called_once_with(self.user, purpose="register")

    def test_resend_registration_otp_rejects_verified_user(self):
        self.user.is_active = True
        self.user.is_phone_verified = True
        self.user.save(update_fields=["is_active", "is_phone_verified"])

        response = self.client.post(
            "/accounts/resend-register-otp/",
            {"phone_number": self.user.phone_number},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            response.json(),
            {"phone_number": ["This account is already verified."]},
        )
