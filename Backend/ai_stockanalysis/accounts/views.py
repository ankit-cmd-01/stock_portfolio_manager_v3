from django.contrib.auth import authenticate
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import CustomUser
from .serializers import (
    ForgotPasswordSerializer,
    LoginSerializer,
    LogoutSerializer,
    OTPVerifySerializer,
    RegisterSerializer,
    ResendRegistrationOTPSerializer,
    ResetEmailLookupSerializer,
    ResetPasswordSerializer,
    ResetOtpVerifySerializer,
    UserProfileSerializer,
)
from .utils import generate_and_send_otp


def get_jwt_tokens(user):
    refresh = RefreshToken.for_user(user)
    return {
        "refresh": str(refresh),
        "access": str(refresh.access_token),
    }


def mask_phone_number(phone_number):
    digits = phone_number.replace(" ", "")
    if len(digits) <= 4:
        return digits
    return f"{digits[:3]}{'X' * max(len(digits) - 7, 0)}{digits[-4:]}"


class RegisterView(APIView):
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)

        if serializer.is_valid():
            user = serializer.save()
            success = generate_and_send_otp(user, purpose="register")

            if success:
                return Response(
                    {
                        "message": "Registered successfully.",
                        "next_step": "Enter the OTP sent to your Telegram account.",
                        "phone": user.phone_number,
                    },
                    status=status.HTTP_201_CREATED,
                )
            return Response(
                {"error": "Registered but OTP sending failed! Try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class VerifyOTPView(APIView):
    def post(self, request):
        serializer = OTPVerifySerializer(data=request.data)

        if serializer.is_valid():
            phone = serializer.validated_data["phone_number"]
            otp = serializer.validated_data["otp_code"]

            try:
                user = CustomUser.objects.get(phone_number=phone)
            except CustomUser.DoesNotExist:
                return Response({"error": "User not found!"}, status=status.HTTP_404_NOT_FOUND)

            if user.otp_purpose != "register":
                return Response({"error": "Invalid OTP purpose!"}, status=status.HTTP_400_BAD_REQUEST)

            is_valid, msg = user.is_otp_valid(otp)

            if is_valid:
                user.is_active = True
                user.is_phone_verified = True
                user.otp_is_used = True
                user.otp_code = None
                user.otp_purpose = None
                user.otp_created_at = None
                user.save(
                    update_fields=[
                        "is_active",
                        "is_phone_verified",
                        "otp_is_used",
                        "otp_code",
                        "otp_purpose",
                        "otp_created_at",
                    ]
                )

                tokens = get_jwt_tokens(user)
                return Response(
                    {
                        "message": "Account verified and activated.",
                        "tokens": tokens,
                    },
                    status=status.HTTP_200_OK,
                )

            return Response({"error": msg}, status=status.HTTP_400_BAD_REQUEST)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoginView(APIView):
    def post(self, request):
        serializer = LoginSerializer(data=request.data)

        if serializer.is_valid():
            email = serializer.validated_data["email"]
            password = serializer.validated_data["password"]

            try:
                user = CustomUser.objects.get(email__iexact=email)
            except CustomUser.DoesNotExist:
                return Response(
                    {"error": "No account found with this email!"},
                    status=status.HTTP_404_NOT_FOUND,
                )

            if not user.is_active:
                return Response(
                    {"error": "Account not verified! Please verify OTP first."},
                    status=status.HTTP_403_FORBIDDEN,
                )

            auth_user = authenticate(request, username=user.username, password=password)

            if auth_user:
                tokens = get_jwt_tokens(auth_user)
                return Response(
                    {
                        "message": "Login successful.",
                        "tokens": tokens,
                        "user": {
                            "first_name": auth_user.first_name,
                            "last_name": auth_user.last_name,
                            "email": auth_user.email,
                            "phone_number": auth_user.phone_number,
                        },
                    },
                    status=status.HTTP_200_OK,
                )

            return Response({"error": "Incorrect password!"}, status=status.HTTP_401_UNAUTHORIZED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ForgotPasswordView(APIView):
    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)

        if serializer.is_valid():
            email = serializer.validated_data["email"]
            user = CustomUser.objects.get(email__iexact=email)
            success = generate_and_send_otp(user, purpose="reset_password")

            if success:
                return Response(
                    {
                        "message": "OTP sent to your registered mobile number.",
                        "masked_phone": mask_phone_number(user.phone_number),
                    },
                    status=status.HTTP_200_OK,
                )
            return Response(
                {"error": "OTP sending failed! Try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class VerifyResetEmailView(APIView):
    def post(self, request):
        serializer = ResetEmailLookupSerializer(data=request.data)

        if serializer.is_valid():
            email = serializer.validated_data["email"]
            user = CustomUser.objects.get(email__iexact=email)
            return Response(
                {
                    "message": "Email verified.",
                    "email": user.email,
                    "masked_phone": mask_phone_number(user.phone_number),
                    "phone_number": user.phone_number,
                },
                status=status.HTTP_200_OK,
            )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ResendRegistrationOTPView(APIView):
    def post(self, request):
        serializer = ResendRegistrationOTPSerializer(data=request.data)

        if serializer.is_valid():
            phone = serializer.validated_data["phone_number"]
            user = CustomUser.objects.get(phone_number=phone)
            success = generate_and_send_otp(user, purpose="register")

            if success:
                return Response(
                    {"message": "OTP resent to your Telegram account."},
                    status=status.HTTP_200_OK,
                )
            return Response(
                {"error": "OTP sending failed! Try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = LogoutSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"message": "Logout successful."}, status=status.HTTP_200_OK)


class ResetPasswordView(APIView):
    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)

        if serializer.is_valid():
            email = serializer.validated_data["email"]
            otp = serializer.validated_data["otp_code"]
            new_password = serializer.validated_data["new_password"]

            try:
                user = CustomUser.objects.get(email__iexact=email)
            except CustomUser.DoesNotExist:
                return Response({"error": "User not found!"}, status=status.HTTP_404_NOT_FOUND)

            if user.otp_purpose != "reset_password":
                return Response({"error": "Invalid OTP purpose!"}, status=status.HTTP_400_BAD_REQUEST)

            is_valid, msg = user.is_otp_valid(otp)

            if is_valid:
                user.set_password(new_password)
                user.otp_is_used = True
                user.otp_code = None
                user.otp_purpose = None
                user.otp_created_at = None
                user.save(
                    update_fields=[
                        "password",
                        "otp_is_used",
                        "otp_code",
                        "otp_purpose",
                        "otp_created_at",
                    ]
                )
                return Response(
                    {"message": "Password reset successful. Please log in again."},
                    status=status.HTTP_200_OK,
                )

            return Response({"error": msg}, status=status.HTTP_400_BAD_REQUEST)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class VerifyResetOTPView(APIView):
    def post(self, request):
        serializer = ResetOtpVerifySerializer(data=request.data)

        if serializer.is_valid():
            email = serializer.validated_data["email"]
            otp = serializer.validated_data["otp_code"]

            try:
                user = CustomUser.objects.get(email__iexact=email)
            except CustomUser.DoesNotExist:
                return Response({"error": "User not found!"}, status=status.HTTP_404_NOT_FOUND)

            if user.otp_purpose != "reset_password":
                return Response({"error": "Invalid OTP purpose!"}, status=status.HTTP_400_BAD_REQUEST)

            is_valid, msg = user.is_otp_valid(otp)
            if is_valid:
                return Response(
                    {"message": "OTP verified successfully."},
                    status=status.HTTP_200_OK,
                )

            return Response({"error": msg}, status=status.HTTP_400_BAD_REQUEST)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class UserProfileView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    def get(self, request):
        serializer = UserProfileSerializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def put(self, request):
        serializer = UserProfileSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(
                {
                    "message": "Profile updated.",
                    "data": serializer.data,
                },
                status=status.HTTP_200_OK,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
