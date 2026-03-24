from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


class CustomUser(AbstractUser):
    OTP_PURPOSE_CHOICES = [
        ("register", "Register"),
        ("reset_password", "Reset Password"),
    ]

    email = models.EmailField(unique=True)
    phone_number = models.CharField(
        max_length=15,
        unique=True,
        help_text="Format: +91XXXXXXXXXX",
    )
    profile_pic = models.ImageField(
        upload_to="profiles/",
        blank=True,
        null=True,
    )
    otp_code = models.CharField(
        max_length=6,
        blank=True,
        null=True,
        help_text="6-digit OTP",
    )
    otp_created_at = models.DateTimeField(
        blank=True,
        null=True,
        help_text="When was OTP generated?",
    )
    otp_is_used = models.BooleanField(
        default=False,
        help_text="True = already used, cannot reuse!",
    )
    otp_purpose = models.CharField(
        max_length=20,
        choices=OTP_PURPOSE_CHOICES,
        blank=True,
        null=True,
        help_text="Why was OTP generated?",
    )
    is_phone_verified = models.BooleanField(
        default=False,
        help_text="True = phone verified via OTP",
    )
    is_active = models.BooleanField(
        default=False,
        help_text="False until OTP is verified",
    )

    REQUIRED_FIELDS = ["phone_number", "email"]

    def is_otp_valid(self, otp_entered):
        if not self.otp_code or not self.otp_created_at or not self.otp_purpose:
            return False, "No active OTP found. Request a new one."

        if self.otp_is_used:
            return False, "OTP already used!"

        if self.otp_code != otp_entered:
            return False, "Invalid OTP!"

        expiry_time = self.otp_created_at + timezone.timedelta(minutes=5)
        if timezone.now() > expiry_time:
            return False, "OTP expired! Request a new one."

        return True, "OTP is valid."

    def __str__(self):
        return f"{self.username} | {self.phone_number}"

    class Meta:
        verbose_name = "User"
        verbose_name_plural = "Users"
        ordering = ["-date_joined"]
