# accounts/urls.py

from django.urls import path
from .views import (
    ForgotPasswordView,
    LoginView,
    LogoutView,
    RegisterView,
    ResendRegistrationOTPView,
    ResetPasswordView,
    VerifyResetEmailView,
    VerifyResetOTPView,
    UserProfileView,
    VerifyOTPView,
)


urlpatterns = [

    # -----! REGISTER !--------------------------
    path('register/',        RegisterView.as_view(),       name='register'),

    # -----! OTP VERIFY !------------------------
    path('verify-otp/',      VerifyOTPView.as_view(),      name='verify-otp'),

    # -----! OTP RESEND !------------------------
    path('resend-register-otp/', ResendRegistrationOTPView.as_view(), name='resend-register-otp'),

    # -----! LOGIN !-----------------------------
    path('login/',           LoginView.as_view(),          name='login'),

    # -----! LOGOUT !----------------------------
    path('logout/',          LogoutView.as_view(),         name='logout'),

    # -----! FORGOT PASSWORD !-------------------
    path('forgot-password/', ForgotPasswordView.as_view(), name='forgot-password'),

    # -----! RESET EMAIL VERIFY !----------------
    path('verify-reset-email/', VerifyResetEmailView.as_view(), name='verify-reset-email'),

    # -----! RESET OTP VERIFY !------------------
    path('verify-reset-otp/', VerifyResetOTPView.as_view(), name='verify-reset-otp'),

    # -----! RESET PASSWORD !--------------------
    path('reset-password/',  ResetPasswordView.as_view(),  name='reset-password'),

    # -----! USER PROFILE !----------------------
    path('profile/',         UserProfileView.as_view(),    name='profile'),

]
