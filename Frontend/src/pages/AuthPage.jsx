import { Activity, ArrowRight, Eye, EyeOff, Mail, Phone } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";

const initialRegister = {
  first_name: "",
  last_name: "",
  email: "",
  password: "",
  confirm_password: "",
};

export default function AuthPage({ onToast }) {
  const navigate = useNavigate();
  const {
    login,
    register,
    confirmOtp,
    resendOtp,
    checkPasswordResetEmail,
    sendPasswordResetOtp,
    checkPasswordResetOtp,
    changePassword,
  } = useAuth();
  const [tab, setTab] = useState("login");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState(initialRegister);
  const [resetForm, setResetForm] = useState({
    email: "",
    otp_code: "",
    new_password: "",
    confirm_password: "",
  });
  const [resetStep, setResetStep] = useState(1);
  const [resetPhoneNumber, setResetPhoneNumber] = useState("");
  const [resetPhoneVisible, setResetPhoneVisible] = useState(false);
  const [resetEmailVerifying, setResetEmailVerifying] = useState(false);
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [otpStatus, setOtpStatus] = useState("idle");
  const [isMobileVerified, setIsMobileVerified] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [pendingPhoneNumber, setPendingPhoneNumber] = useState("");
  const [resetOtpSent, setResetOtpSent] = useState(false);
  const [resetSendingOtp, setResetSendingOtp] = useState(false);
  const [resetOtpVerifying, setResetOtpVerifying] = useState(false);
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetResendTimer, setResetResendTimer] = useState(0);
  const otpRefs = useRef([]);
  const wrongOtpTimeoutRef = useRef(null);

  const parseErrors = (error) => {
    if (!error.response?.data) {
      return { general: error?.message || "Something went wrong. Please try again." };
    }

    const payload = error.response.data;
    if (payload.error) {
      return { general: payload.error };
    }
    return payload;
  };

  const resetPhoneVerification = () => {
    setOtpSent(false);
    setOtp(["", "", "", "", "", ""]);
    setOtpStatus("idle");
    setIsMobileVerified(false);
    setResendTimer(30);
    setSendingOtp(false);
    setVerifyingOtp(false);
    setPendingPhoneNumber("");
    if (wrongOtpTimeoutRef.current) {
      window.clearTimeout(wrongOtpTimeoutRef.current);
      wrongOtpTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    if (!otpSent || resendTimer <= 0 || isMobileVerified) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setResendTimer((current) => {
        if (current <= 1) {
          window.clearInterval(intervalId);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [isMobileVerified, otpSent, resendTimer]);

  useEffect(() => {
    const joinedOtp = otp.join("");

    if (
      joinedOtp.length !== 6 ||
      isMobileVerified ||
      !otpSent ||
      !pendingPhoneNumber ||
      otpStatus !== "idle"
    ) {
      return undefined;
    }

    const verifyCode = async () => {
      setVerifyingOtp(true);
      setErrors({});

      try {
        await confirmOtp({
          phone_number: pendingPhoneNumber,
          otp_code: joinedOtp,
        });

        setOtpStatus("correct");
        setIsMobileVerified(true);
        onToast({
          type: "success",
          message: "Account verified successfully.",
        });
        window.setTimeout(() => {
          navigate("/dashboard");
        }, 400);
      } catch (error) {
        setErrors(parseErrors(error));
        setOtpStatus("wrong");
        wrongOtpTimeoutRef.current = window.setTimeout(() => {
          setOtp(["", "", "", "", "", ""]);
          setOtpStatus("idle");
          otpRefs.current[0]?.focus();
        }, 800);
      } finally {
        setVerifyingOtp(false);
      }
    };

    verifyCode();

    return () => {
      if (wrongOtpTimeoutRef.current) {
        window.clearTimeout(wrongOtpTimeoutRef.current);
        wrongOtpTimeoutRef.current = null;
      }
    };
  }, [
    confirmOtp,
    isMobileVerified,
    navigate,
    onToast,
    otp,
    otpStatus,
    otpSent,
    pendingPhoneNumber,
  ]);

  useEffect(() => {
    return () => {
      if (wrongOtpTimeoutRef.current) {
        window.clearTimeout(wrongOtpTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (tab !== "reset" || !resetOtpSent || resetResendTimer <= 0) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setResetResendTimer((current) => {
        if (current <= 1) {
          window.clearInterval(intervalId);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [resetOtpSent, resetResendTimer, tab]);

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoading(true);
    setErrors({});

    try {
      await login(loginForm);
      onToast({ type: "success", message: "Welcome back to AI StockAnalysis." });
      navigate("/dashboard");
    } catch (error) {
      setErrors(parseErrors(error));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (event) => {
    event.preventDefault();

    if (otpSent) {
      setErrors({ phone_number: ["Enter the OTP sent to your Telegram account."] });
      return;
    }

    if (phone.length !== 10) {
      setErrors({ phone_number: ["Enter a valid 10-digit mobile number."] });
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      const formattedPhone = `+91${phone}`;
      const response = await register({
        ...registerForm,
        phone_number: formattedPhone,
      });
      setPendingPhoneNumber(response.phone || formattedPhone);
      setOtpSent(true);
      setOtp(["", "", "", "", "", ""]);
      setOtpStatus("idle");
      setIsMobileVerified(false);
      setResendTimer(30);
      onToast({
        type: "success",
        message: response.next_step || response.message || "Registration successful.",
      });
      window.setTimeout(() => {
        otpRefs.current[0]?.focus();
      }, 30);
    } catch (error) {
      setErrors(parseErrors(error));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordClick = () => {
    setErrors({});
    setResetStep(1);
    setResetForm({
      email: "",
      otp_code: "",
      new_password: "",
      confirm_password: "",
    });
    setResetPhoneNumber("");
    setResetPhoneVisible(false);
    setResetOtpSent(false);
    setResetSendingOtp(false);
    setResetOtpVerifying(false);
    setResetSubmitting(false);
    setResetResendTimer(0);
    setTab("reset");
  };

  const handleResetEmailChange = (value) => {
    setResetForm((current) => ({ ...current, email: value }));
    setErrors((current) => ({ ...current, email: undefined }));
    setResetStep(1);
    setResetOtpSent(false);
    setResetResendTimer(0);
    setResetPhoneNumber("");
    setResetPhoneVisible(false);
    setResetForm((current) => ({ ...current, otp_code: "", new_password: "", confirm_password: "" }));
  };

  const handleVerifyResetEmail = async () => {
    if (resetEmailVerifying) {
      return;
    }

    if (!resetForm.email.trim()) {
      setErrors({ email: ["Enter your registered email address."] });
      return;
    }

    setResetEmailVerifying(true);
    setErrors({});

    try {
      const response = await checkPasswordResetEmail({ email: resetForm.email.trim() });
      setResetPhoneNumber(response.phone_number || "");
      setResetPhoneVisible(false);
      setResetStep(2);
      onToast({
        type: "success",
        message: response.message || "Email verified successfully.",
      });
    } catch (error) {
      const parsed = parseErrors(error);
      const notFound =
        String(parsed.general || "").toLowerCase().includes("no account found") ||
        String(parsed.email?.[0] || "").toLowerCase().includes("no account found");

      if (notFound) {
        setRegisterForm((current) => ({
          ...current,
          email: resetForm.email.trim(),
        }));
        setTab("register");
        setErrors({
          general: "No account found with that email. Please register first.",
        });
        onToast({
          type: "error",
          message: "No account found with that email. Please register first.",
        });
        return;
      }

      setResetStep(1);
      setErrors(parsed);
    } finally {
      setResetEmailVerifying(false);
    }
  };

  const handleSendResetOtp = async () => {
    if (resetSendingOtp || resetStep < 2) {
      return;
    }

    setResetSendingOtp(true);
    setErrors({});

    try {
      const response = await sendPasswordResetOtp({ email: resetForm.email.trim() });
      setResetOtpSent(true);
      setResetStep(2);
      setResetResendTimer(30);
      onToast({
        type: "success",
        message:
          response.message ||
          `OTP sent to ${response.masked_phone || resetPhoneNumber || "your registered mobile number"}.`,
      });
    } catch (error) {
      setErrors(parseErrors(error));
    } finally {
      setResetSendingOtp(false);
    }
  };

  const handleVerifyResetOtp = async () => {
    if (resetOtpVerifying) {
      return;
    }

    if (resetForm.otp_code.replace(/\D/g, "").length !== 6) {
      setErrors({ otp_code: ["Enter the 6-digit OTP sent to your mobile number."] });
      return;
    }

    setResetOtpVerifying(true);
    setErrors({});

    try {
      await checkPasswordResetOtp({
        email: resetForm.email.trim(),
        otp_code: resetForm.otp_code,
      });
      setResetStep(3);
      onToast({ type: "success", message: "Mobile number verified successfully." });
    } catch (error) {
      setErrors(parseErrors(error));
    } finally {
      setResetOtpVerifying(false);
    }
  };

  const handleResetPassword = async (event) => {
    event.preventDefault();
    setResetSubmitting(true);
    setErrors({});

    try {
      await changePassword({
        email: resetForm.email.trim(),
        otp_code: resetForm.otp_code,
        new_password: resetForm.new_password,
        confirm_password: resetForm.confirm_password,
      });
      onToast({ type: "success", message: "Password reset successfully. Please log in again." });
      setTab("login");
      setResetStep(1);
      setResetForm({
        email: "",
        otp_code: "",
        new_password: "",
        confirm_password: "",
      });
      setResetPhoneNumber("");
      setResetPhoneVisible(false);
      setResetOtpSent(false);
      setResetResendTimer(0);
    } catch (error) {
      setErrors(parseErrors(error));
    } finally {
      setResetSubmitting(false);
    }
  };

  const handlePhoneChange = (value) => {
    const sanitized = value.replace(/\D/g, "").slice(0, 10);
    setPhone(sanitized);
    setErrors((current) => ({ ...current, phone_number: undefined }));

    if (
      sanitized !== phone &&
      (otpSent || isMobileVerified || otp.some((digit) => digit))
    ) {
      resetPhoneVerification();
    }
  };

  const handleSendOtp = async () => {
    if (!otpSent || !pendingPhoneNumber || sendingOtp || isMobileVerified) {
      return;
    }

    setSendingOtp(true);
    setOtpStatus("idle");

    try {
      const response = await resendOtp({ phone_number: pendingPhoneNumber });
      setOtp(["", "", "", "", "", ""]);
      setResendTimer(30);
      onToast({
        type: "success",
        message: response.message || `OTP sent to ${pendingPhoneNumber}`,
      });
      window.setTimeout(() => {
        otpRefs.current[0]?.focus();
      }, 30);
    } catch (error) {
      setErrors(parseErrors(error));
    } finally {
      setSendingOtp(false);
    }
  };

  const handleOtpInput = (index, rawValue) => {
    if (isMobileVerified) {
      return;
    }

    const value = rawValue.replace(/\D/g, "").slice(-1);
    const nextOtp = [...otp];
    nextOtp[index] = value;
    setOtp(nextOtp);
    setOtpStatus("idle");

    if (value && index < otpRefs.current.length - 1) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, event) => {
    if (isMobileVerified) {
      event.preventDefault();
      return;
    }

    if (event.key === "Backspace") {
      event.preventDefault();
      const nextOtp = [...otp];

      if (nextOtp[index]) {
        nextOtp[index] = "";
        setOtp(nextOtp);
        setOtpStatus("idle");
        return;
      }

      if (index > 0) {
        nextOtp[index - 1] = "";
        setOtp(nextOtp);
        setOtpStatus("idle");
        otpRefs.current[index - 1]?.focus();
      }
    }
  };

  const handleOtpPaste = (event) => {
    if (isMobileVerified) {
      return;
    }

    event.preventDefault();
    const pastedDigits = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6)
      .split("");

    if (!pastedDigits.length) {
      return;
    }

    const nextOtp = ["", "", "", "", "", ""];
    pastedDigits.forEach((digit, index) => {
      nextOtp[index] = digit;
    });
    setOtp(nextOtp);
    setOtpStatus("idle");
    otpRefs.current[Math.min(pastedDigits.length, 5)]?.focus();
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <style>{`
        @keyframes otp-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }

        @keyframes check-draw {
          to {
            stroke-dashoffset: 0;
          }
        }

        .otp-rail--wrong {
          animation: otp-shake 0.35s ease;
        }

        .otp-checkmark path {
          stroke-dasharray: 32;
          stroke-dashoffset: 32;
          animation: check-draw 0.45s ease forwards;
        }
      `}</style>

      <section className="hero-mesh cyber-grid hidden border-r border-white/5 lg:flex lg:flex-col lg:justify-between lg:p-10">
        <div>
          <p className="text-xs uppercase tracking-widest text-primary">AI StockAnalysis</p>
          <h1 className="mt-6 font-display text-6xl leading-none text-text">
            Premium market intelligence for retail investors.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-muted">
            Track portfolios, visualize OHLCV movement, and stage PE signals
            inside a professional-grade dark interface.
          </p>
        </div>

        <div className="panel w-full max-w-xl p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted">Animated preview</p>
              <h2 className="font-display text-2xl text-text">Terminal Snapshot</h2>
            </div>
            <span className="rounded-chip bg-profit/10 px-3 py-1 text-xs text-profit">Live</span>
          </div>
          <div className="flex h-56 items-end gap-2">
            {[30, 68, 55, 74, 90, 78, 110, 86, 124, 118].map((height) => (
              <div key={height} className="flex-1 animate-drift rounded-t-md bg-gradient-to-t from-primary to-cyan-200" style={{ height: `${height}px` }} />
            ))}
          </div>
        </div>
      </section>

      <section className="flex items-center justify-center bg-surface px-4 py-10">
        <div className="panel-elevated w-full max-w-xl p-6 sm:p-8">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted">Secure Access</p>
              <h2 className="font-display text-4xl text-text">Sign In</h2>
            </div>
            <Activity className="text-primary" />
          </div>

          <div className="mb-8 flex gap-2 rounded-panel bg-white/5 p-1">
            {[
              { id: "login", label: "Login" },
              { id: "register", label: "Register" },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`flex-1 rounded-panel px-3 py-2 text-sm font-semibold transition ${
                  tab === item.id ? "bg-primary text-slate-950" : "text-muted"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {errors.general ? (
            <p className="mb-5 rounded-panel border border-loss/20 bg-loss/10 px-4 py-3 text-sm text-loss">
              {errors.general}
            </p>
          ) : null}

          {tab === "login" ? (
            <form className="space-y-5" onSubmit={handleLogin}>
              <Field label="Email" value={loginForm.email} onChange={(value) => setLoginForm((current) => ({ ...current, email: value }))} error={errors.email?.[0]} />
              <Field label="Password" type="password" value={loginForm.password} onChange={(value) => setLoginForm((current) => ({ ...current, password: value }))} error={errors.password?.[0]} />
              <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-panel bg-primary px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60">
                {loading ? <Spinner /> : null}
                Login <ArrowRight size={16} />
              </button>
              <button type="button" onClick={handleForgotPasswordClick} className="text-sm text-muted transition hover:text-primary">
                Forgot password?
              </button>
            </form>
          ) : null}

          {tab === "reset" ? (
            <form className="space-y-5" onSubmit={handleResetPassword}>
              <div className="flex items-center gap-2">
                {[1, 2, 3].map((step) => (
                  <div
                    key={step}
                    className={`h-2 flex-1 rounded-full transition ${
                      resetStep >= step ? "bg-primary" : "bg-white/10"
                    }`}
                  />
                ))}
              </div>

              {resetStep === 1 ? (
                <div className="space-y-4">
                  <label className="block">
                    <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-text">
                      <Mail size={14} className="text-muted" />
                      Registered email address
                    </span>
                    <input
                      type="email"
                      value={resetForm.email}
                      onChange={(event) => handleResetEmailChange(event.target.value)}
                      placeholder="Enter your registered email address"
                      className="w-full rounded-panel border border-border bg-base px-4 py-3 text-text outline-none transition focus:border-primary"
                    />
                  </label>
                  {errors.email?.[0] ? (
                    <span className="block text-sm text-loss">{errors.email[0]}</span>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleVerifyResetEmail}
                    disabled={resetEmailVerifying}
                    className="rounded-panel bg-primary px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60"
                  >
                    {resetEmailVerifying ? "Verifying..." : "Verify Email"}
                  </button>
                </div>
              ) : null}

              {resetStep >= 2 ? (
                <div className="space-y-4">
                  <div className="rounded-panel border border-white/10 bg-white/5 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-widest text-muted">Registered mobile</p>
                        <p className="mt-2 text-sm font-semibold text-text">
                          {resetPhoneVisible ? resetPhoneNumber || "Unavailable" : `${(resetPhoneNumber || "").slice(0, 3)}${(resetPhoneNumber || "").length > 6 ? "*****" : ""}${(resetPhoneNumber || "").slice(-4)}`}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setResetPhoneVisible((current) => !current)}
                        className="rounded-chip border border-white/10 p-2 text-muted transition hover:border-primary/40 hover:text-primary"
                        aria-label={resetPhoneVisible ? "Hide phone number" : "Show phone number"}
                      >
                        {resetPhoneVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleSendResetOtp}
                      disabled={resetSendingOtp || resetResendTimer > 0}
                      className="rounded-panel bg-primary px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60"
                    >
                      {resetSendingOtp
                        ? "Sending OTP..."
                        : resetResendTimer > 0
                          ? `Resend in ${resetResendTimer}s`
                          : resetOtpSent
                            ? "Resend OTP"
                            : "Send OTP"}
                    </button>
                    {resetOtpSent ? <span className="text-sm text-profit">OTP sent</span> : null}
                  </div>

                  {resetOtpSent ? (
                    <div className="space-y-4">
                      <div>
                        <span className="mb-2 block text-sm font-semibold text-text">OTP</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={resetForm.otp_code}
                          onChange={(event) =>
                            setResetForm((current) => ({
                              ...current,
                              otp_code: event.target.value.replace(/\D/g, "").slice(0, 6),
                            }))
                          }
                          placeholder="Enter 6-digit OTP"
                          className="w-full rounded-panel border border-border bg-base px-4 py-3 text-text outline-none transition focus:border-primary"
                        />
                        {errors.otp_code?.[0] ? (
                          <span className="mt-2 block text-sm text-loss">{errors.otp_code[0]}</span>
                        ) : null}
                      </div>

                      <button
                        type="button"
                        onClick={handleVerifyResetOtp}
                        disabled={resetOtpVerifying}
                        className="rounded-panel bg-primary px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60"
                      >
                        {resetOtpVerifying ? "Verifying..." : "Verify OTP"}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {resetStep >= 3 ? (
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field
                    label="New password"
                    type="password"
                    value={resetForm.new_password}
                    onChange={(value) => setResetForm((current) => ({ ...current, new_password: value }))}
                    error={errors.new_password?.[0]}
                  />
                  <Field
                    label="Confirm password"
                    type="password"
                    value={resetForm.confirm_password}
                    onChange={(value) => setResetForm((current) => ({ ...current, confirm_password: value }))}
                    error={errors.confirm_password?.[0]}
                  />
                </div>
              ) : null}

              {errors.general ? (
                <p className="rounded-panel border border-loss/20 bg-loss/10 px-4 py-3 text-sm text-loss">
                  {errors.general}
                </p>
              ) : null}

              <div className="flex items-center gap-3">
                {resetStep >= 3 ? (
                  <button
                    type="submit"
                    disabled={resetSubmitting}
                    className="rounded-panel bg-primary px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60"
                  >
                    {resetSubmitting ? "Resetting..." : "Reset Password"}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setTab("login")}
                  className="text-sm text-muted transition hover:text-primary"
                >
                  Back to login
                </button>
              </div>
            </form>
          ) : null}

          {tab === "register" ? (
            <form className="space-y-5" onSubmit={handleRegister}>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="First name" value={registerForm.first_name} onChange={(value) => setRegisterForm((current) => ({ ...current, first_name: value }))} error={errors.first_name?.[0]} disabled={otpSent} />
                <Field label="Last name" value={registerForm.last_name} onChange={(value) => setRegisterForm((current) => ({ ...current, last_name: value }))} error={errors.last_name?.[0]} disabled={otpSent} />
              </div>
              <Field label="Email" value={registerForm.email} onChange={(value) => setRegisterForm((current) => ({ ...current, email: value }))} error={errors.email?.[0]} disabled={otpSent} />

              <div>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-text">Phone number</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={phone}
                    disabled={otpSent}
                    onChange={(event) => handlePhoneChange(event.target.value)}
                    placeholder="Enter 10-digit mobile number"
                    className="w-full rounded-panel border border-border bg-base px-4 py-3 text-text outline-none transition focus:border-primary disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </label>

                {otpSent ? (
                  <div className="mt-4 space-y-4">
                    <p className="rounded-panel border border-profit/20 bg-profit/10 px-4 py-3 text-sm text-profit">
                      OTP sent to your registered mobile number.
                    </p>

                    <div>
                      <div
                        className={`flex flex-wrap items-center gap-2 sm:gap-3 ${
                          otpStatus === "wrong" ? "otp-rail--wrong" : ""
                        }`}
                        onPaste={handleOtpPaste}
                      >
                        {otp.map((digit, index) => {
                          const statusClass =
                            otpStatus === "correct"
                              ? "border-profit shadow-green text-profit"
                              : otpStatus === "wrong"
                                ? "border-loss text-loss"
                                : "border-primary/50 text-text";

                          return (
                            <input
                              key={index}
                              ref={(node) => {
                                otpRefs.current[index] = node;
                              }}
                              type="text"
                              inputMode="numeric"
                              maxLength={1}
                              value={digit}
                              readOnly={isMobileVerified}
                              onChange={(event) => handleOtpInput(index, event.target.value)}
                              onKeyDown={(event) => handleOtpKeyDown(index, event)}
                              aria-label={`OTP digit ${index + 1}`}
                              className={`h-14 w-12 rounded-card border bg-base text-center font-mono text-xl outline-none transition focus:border-primary focus:shadow-cyan ${statusClass}`}
                              style={{ borderWidth: "1.5px" }}
                            />
                          );
                        })}

                        {otpStatus === "correct" ? (
                          <div className="flex items-center gap-2">
                            <svg className="otp-checkmark h-8 w-8" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                              <path
                                d="M5 13.2L9.2 17L19 7.5"
                                stroke="var(--accent-green)"
                                strokeWidth="2.6"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                            <span className="text-sm font-semibold text-profit">Mobile verified</span>
                          </div>
                        ) : null}
                      </div>

                      {otpStatus === "wrong" ? (
                        <p className="mt-3 text-sm text-loss">Incorrect OTP. Try again.</p>
                      ) : null}

                      {verifyingOtp ? (
                        <p className="mt-3 text-sm text-primary">Verifying OTP...</p>
                      ) : null}

                      {otpStatus !== "correct" ? (
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <button
                            type="button"
                            onClick={handleSendOtp}
                            disabled={resendTimer > 0 || sendingOtp}
                            className="rounded-chip border border-white/10 px-3 py-1.5 text-xs font-semibold text-primary transition hover:border-primary/40 disabled:cursor-not-allowed disabled:text-muted"
                          >
                            {sendingOtp
                              ? "Sending OTP..."
                              : resendTimer > 0
                                ? `Resend in ${resendTimer}s`
                                : "Resend OTP"}
                          </button>
                          {resendTimer > 0 ? (
                            <span className="text-xs text-muted">Resend in {resendTimer}s</span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {errors.phone_number?.[0] ? (
                  <span className="mt-2 block text-sm text-loss">{errors.phone_number[0]}</span>
                ) : null}
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Password" type="password" value={registerForm.password} onChange={(value) => setRegisterForm((current) => ({ ...current, password: value }))} error={errors.password?.[0]} disabled={otpSent} />
                <Field label="Confirm password" type="password" value={registerForm.confirm_password} onChange={(value) => setRegisterForm((current) => ({ ...current, confirm_password: value }))} error={errors.confirm_password?.[0]} disabled={otpSent} />
              </div>

              <button
                type="submit"
                disabled={loading || otpSent}
                title={otpSent ? "Enter the OTP sent to your Telegram account" : ""}
                className={`flex w-full items-center justify-center gap-2 rounded-panel px-4 py-3 text-sm font-semibold transition ${
                  !otpSent
                    ? "bg-primary text-slate-950 hover:shadow-cyan"
                    : "cursor-not-allowed bg-white/10 text-muted opacity-50"
                } disabled:opacity-50`}
              >
                {loading ? <Spinner /> : null}
                {otpSent ? "Waiting for OTP verification" : "Register"}
              </button>
            </form>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function Field({ label, error, type = "text", value, onChange, disabled = false }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-text">{label}</span>
      <input
        type={type}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-panel border border-border bg-base px-4 py-3 text-text outline-none transition focus:border-primary disabled:cursor-not-allowed disabled:opacity-60"
      />
      {error ? <span className="mt-2 block text-sm text-loss">{error}</span> : null}
    </label>
  );
}

function Spinner({ tone = "dark" }) {
  return (
    <span
      className={`h-4 w-4 animate-spin rounded-full border-2 ${
        tone === "primary"
          ? "border-primary border-t-transparent"
          : "border-slate-950 border-t-transparent"
      }`}
    />
  );
}
