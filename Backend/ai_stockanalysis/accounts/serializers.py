from django.contrib.auth.password_validation import validate_password
from django.utils.text import slugify
from rest_framework import serializers
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from .models import CustomUser


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = CustomUser
        fields = [
            "first_name",
            "last_name",
            "email",
            "phone_number",
            "password",
            "confirm_password",
        ]

    def validate_first_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("First name cannot be empty.")
        return value

    def validate_last_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Last name cannot be empty.")
        return value

    def validate_email(self, value):
        email = value.strip().lower()
        if CustomUser.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("This email is already registered.")
        return email

    def validate_phone_number(self, value):
        phone_number = value.strip()
        if not phone_number.startswith("+"):
            raise serializers.ValidationError(
                "Phone number must include the country code, for example +91XXXXXXXXXX."
            )
        if not phone_number[1:].isdigit():
            raise serializers.ValidationError("Phone number must contain only digits after '+'.")
        if CustomUser.objects.filter(phone_number=phone_number).exists():
            raise serializers.ValidationError("This phone number is already registered.")
        return phone_number

    def validate(self, data):
        if data["password"] != data["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        validate_password(data["password"])
        return data

    def _build_unique_username(self, email):
        base_username = slugify(email.split("@", 1)[0]).replace("-", "_") or "user"
        username = base_username
        suffix = 1

        while CustomUser.objects.filter(username=username).exists():
            suffix += 1
            username = f"{base_username}_{suffix}"

        return username

    def create(self, validated_data):
        validated_data.pop("confirm_password")
        username = self._build_unique_username(validated_data["email"])

        user = CustomUser.objects.create_user(
            username=username,
            first_name=validated_data["first_name"],
            last_name=validated_data["last_name"],
            email=validated_data["email"],
            phone_number=validated_data["phone_number"],
            password=validated_data["password"],
        )
        user.is_active = False
        user.save(update_fields=["is_active"])
        return user


class OTPVerifySerializer(serializers.Serializer):
    phone_number = serializers.CharField()
    otp_code = serializers.CharField(max_length=6, min_length=6)


class ResendRegistrationOTPSerializer(serializers.Serializer):
    phone_number = serializers.CharField()

    def validate_phone_number(self, value):
        phone_number = value.strip()

        try:
            user = CustomUser.objects.get(phone_number=phone_number)
        except CustomUser.DoesNotExist as exc:
            raise serializers.ValidationError("No account found with this phone number.") from exc

        if user.is_phone_verified or user.is_active:
            raise serializers.ValidationError("This account is already verified.")

        return phone_number


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate_email(self, value):
        return value.strip().lower()


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        email = value.strip().lower()
        if not CustomUser.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("No account found with this email.")
        return email


class ResetEmailLookupSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        email = value.strip().lower()
        if not CustomUser.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("No account found with this email.")
        return email


class ResetOtpVerifySerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp_code = serializers.CharField(max_length=6, min_length=6)

    def validate_email(self, value):
        return value.strip().lower()


class ResetPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp_code = serializers.CharField(max_length=6, min_length=6)
    new_password = serializers.CharField(min_length=8)
    confirm_password = serializers.CharField(min_length=8)

    def validate_email(self, value):
        email = value.strip().lower()
        if not CustomUser.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("No account found with this email.")
        return email

    def validate(self, data):
        if data["new_password"] != data["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        validate_password(data["new_password"])
        return data


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField()

    default_error_messages = {
        "invalid_token": "Invalid or expired refresh token.",
        "token_user_mismatch": "Refresh token does not belong to the authenticated user.",
    }

    def validate_refresh(self, value):
        try:
            token = RefreshToken(value)
        except TokenError as exc:
            raise serializers.ValidationError(self.error_messages["invalid_token"]) from exc

        user = self.context["request"].user
        if str(token["user_id"]) != str(user.id):
            raise serializers.ValidationError(self.error_messages["token_user_mismatch"])

        self.token = token
        return value

    def save(self, **kwargs):
        self.token.blacklist()


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = [
            "id",
            "first_name",
            "last_name",
            "email",
            "phone_number",
            "profile_pic",
            "is_phone_verified",
            "date_joined",
            "last_login",
        ]
        read_only_fields = [
            "id",
            "first_name",
            "last_name",
            "email",
            "phone_number",
            "is_phone_verified",
            "date_joined",
            "last_login",
        ]
