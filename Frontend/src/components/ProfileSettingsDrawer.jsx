import { Camera, KeyRound, LockKeyhole, Mail, Phone, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import Drawer from "./Drawer";
import { resolveBackendUrl } from "../config/runtime";
import { useAuth } from "../hooks/useAuth";

const otpDigitsLength = 6;
const resolveProfilePic = (value) => {
  if (!value) {
    return "";
  }
  return resolveBackendUrl(value);
};

const emptyPasswordForm = {
  otp: "",
  new_password: "",
  confirm_password: "",
};

export default function ProfileSettingsDrawer({ open, onClose, onToast }) {
  const { user, updateProfile, sendPasswordResetOtp, changePassword } = useAuth();
  const [activeTab, setActiveTab] = useState("profile");
  const [profileForm, setProfileForm] = useState({ first_name: "", last_name: "" });
  const [profileFile, setProfileFile] = useState(null);
  const [profilePreview, setProfilePreview] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [passwordForm, setPasswordForm] = useState(emptyPasswordForm);
  const [passwordError, setPasswordError] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);

  const maskedPhone = useMemo(() => {
    const phone = user?.phone_number || "";
    if (phone.length < 4) {
      return phone;
    }
    return `${phone.slice(0, 3)}******${phone.slice(-3)}`;
  }, [user?.phone_number]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setActiveTab("profile");
    setProfileForm({
      first_name: user?.first_name || "",
      last_name: user?.last_name || "",
    });
    setProfileFile(null);
    setProfilePreview(resolveProfilePic(user?.profile_pic) || "");
    setProfileError("");
    setPasswordForm(emptyPasswordForm);
    setPasswordError("");
    setOtpSent(false);
    setOtpTimer(0);
  }, [open, user]);

  useEffect(() => {
    if (!profileFile) {
      return undefined;
    }

    const previewUrl = URL.createObjectURL(profileFile);
    setProfilePreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [profileFile]);

  useEffect(() => {
    if (!otpSent || otpTimer <= 0) {
      return undefined;
    }

    const timerId = window.setInterval(() => {
      setOtpTimer((current) => {
        if (current <= 1) {
          window.clearInterval(timerId);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [otpSent, otpTimer]);

  const parseError = (error) =>
    error.response?.data?.error ||
    Object.values(error.response?.data || {})
      .flat()
      .filter(Boolean)
      .join(" ") ||
    error.message ||
    "Something went wrong.";

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    setProfileSaving(true);
    setProfileError("");

    try {
      const payload = new FormData();
      payload.append("first_name", profileForm.first_name);
      payload.append("last_name", profileForm.last_name);
      if (profileFile) {
        payload.append("profile_pic", profileFile);
      }

      await updateProfile(payload);
      onToast({ type: "success", message: "Profile updated successfully." });
    } catch (error) {
      setProfileError(parseError(error));
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSendOtp = async () => {
    if (!user?.phone_number) {
      setPasswordError("Phone number is missing on this account.");
      return;
    }

    setPasswordSaving(true);
    setPasswordError("");

    try {
      await sendPasswordResetOtp({ phone_number: user.phone_number });
      setOtpSent(true);
      setOtpTimer(30);
      onToast({ type: "success", message: "Password reset OTP sent to your Telegram account." });
    } catch (error) {
      setPasswordError(parseError(error));
    } finally {
      setPasswordSaving(false);
    }
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    setPasswordSaving(true);
    setPasswordError("");

    try {
      await changePassword({
        phone_number: user?.phone_number,
        otp_code: passwordForm.otp,
        new_password: passwordForm.new_password,
        confirm_password: passwordForm.confirm_password,
      });
      onToast({ type: "success", message: "Password reset successfully." });
      setPasswordForm(emptyPasswordForm);
      setOtpSent(false);
      setOtpTimer(0);
    } catch (error) {
      setPasswordError(parseError(error));
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <Drawer open={open} onClose={onClose} title="Profile Settings" widthClass="max-w-4xl">
      <div className="space-y-5">
        <div className="flex items-center gap-2 rounded-panel bg-white/5 p-1">
          <button
            type="button"
            onClick={() => setActiveTab("profile")}
            className={`flex-1 rounded-panel px-4 py-3 text-sm font-semibold transition ${
              activeTab === "profile" ? "bg-primary text-slate-950" : "text-muted"
            }`}
          >
            <UserRound size={16} className="mr-2 inline" />
            Edit Profile
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("password")}
            className={`flex-1 rounded-panel px-4 py-3 text-sm font-semibold transition ${
              activeTab === "password" ? "bg-primary text-slate-950" : "text-muted"
            }`}
          >
            <KeyRound size={16} className="mr-2 inline" />
            Reset Password
          </button>
        </div>

        {activeTab === "profile" ? (
          <form className="space-y-5" onSubmit={handleProfileSubmit}>
            <div className="grid gap-4 lg:grid-cols-[160px_1fr]">
              <div className="panel flex flex-col items-center justify-center gap-3 p-4">
                {profilePreview ? (
                  <img
                    src={profilePreview}
                    alt="Profile preview"
                    className="h-28 w-28 rounded-full border border-primary/20 object-cover"
                  />
                ) : (
                  <div className="flex h-28 w-28 items-center justify-center rounded-full bg-primary/10 text-4xl font-bold text-primary">
                    {user?.first_name?.[0] || "U"}
                  </div>
                )}
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-panel border border-border bg-base px-3 py-2 text-xs font-semibold text-text">
                  <Camera size={14} />
                  Change photo
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => setProfileFile(event.target.files?.[0] || null)}
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-text">First name</span>
                  <input
                    value={profileForm.first_name}
                    onChange={(event) => setProfileForm((current) => ({ ...current, first_name: event.target.value }))}
                    className="w-full rounded-panel border border-border bg-base px-4 py-3 text-text outline-none transition focus:border-primary"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-text">Last name</span>
                  <input
                    value={profileForm.last_name}
                    onChange={(event) => setProfileForm((current) => ({ ...current, last_name: event.target.value }))}
                    className="w-full rounded-panel border border-border bg-base px-4 py-3 text-text outline-none transition focus:border-primary"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-text">
                    <Mail size={14} className="text-muted" />
                    Email
                  </span>
                  <input
                    value={user?.email || ""}
                    disabled
                    className="w-full rounded-panel border border-border bg-white/5 px-4 py-3 text-muted outline-none disabled:cursor-not-allowed"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-text">
                    <Phone size={14} className="text-muted" />
                    Phone number
                  </span>
                  <input
                    value={user?.phone_number || ""}
                    disabled
                    className="w-full rounded-panel border border-border bg-white/5 px-4 py-3 text-muted outline-none disabled:cursor-not-allowed"
                  />
                </label>
              </div>
            </div>

            {profileError ? <p className="rounded-panel border border-loss/20 bg-loss/10 px-4 py-3 text-sm text-loss">{profileError}</p> : null}

            <button
              type="submit"
              disabled={profileSaving}
              className="rounded-panel bg-primary px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60"
            >
              {profileSaving ? "Saving..." : "Save Profile Changes"}
            </button>
          </form>
        ) : (
          <form className="space-y-5" onSubmit={handlePasswordSubmit}>
            <div className="rounded-panel border border-white/5 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-widest text-muted">Linked phone</p>
              <p className="mt-2 text-lg font-semibold text-text">{maskedPhone || user?.phone_number || "--"}</p>
              <p className="mt-1 text-sm text-muted">We send the reset OTP to your Telegram account linked to this number.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={passwordSaving || otpTimer > 0}
                className="rounded-panel border border-border bg-white/5 px-4 py-3 text-sm font-semibold text-text transition hover:border-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {otpTimer > 0 ? `Resend in ${otpTimer}s` : "Send OTP"}
              </button>
              <div className="rounded-panel border border-white/5 bg-white/5 px-4 py-3 text-sm text-muted">
                <p className="uppercase tracking-widest">OTP status</p>
                <p className="mt-1">{otpSent ? "OTP sent and ready for reset." : "Waiting for OTP request."}</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block sm:col-span-1">
                <span className="mb-2 block text-sm font-semibold text-text">OTP</span>
                <input
                  value={passwordForm.otp}
                  onChange={(event) =>
                    setPasswordForm((current) => ({
                      ...current,
                      otp: event.target.value.replace(/\D/g, "").slice(0, otpDigitsLength),
                    }))
                  }
                  inputMode="numeric"
                  placeholder="123456"
                  className="w-full rounded-panel border border-border bg-base px-4 py-3 text-text outline-none transition focus:border-primary"
                />
              </label>
              <label className="block sm:col-span-1">
                <span className="mb-2 block text-sm font-semibold text-text">New password</span>
                <input
                  type="password"
                  value={passwordForm.new_password}
                  onChange={(event) => setPasswordForm((current) => ({ ...current, new_password: event.target.value }))}
                  className="w-full rounded-panel border border-border bg-base px-4 py-3 text-text outline-none transition focus:border-primary"
                />
              </label>
              <label className="block sm:col-span-1">
                <span className="mb-2 block text-sm font-semibold text-text">Confirm password</span>
                <input
                  type="password"
                  value={passwordForm.confirm_password}
                  onChange={(event) =>
                    setPasswordForm((current) => ({ ...current, confirm_password: event.target.value }))
                  }
                  className="w-full rounded-panel border border-border bg-base px-4 py-3 text-text outline-none transition focus:border-primary"
                />
              </label>
            </div>

            {passwordError ? (
              <p className="rounded-panel border border-loss/20 bg-loss/10 px-4 py-3 text-sm text-loss">{passwordError}</p>
            ) : null}

            <button
              type="submit"
              disabled={passwordSaving}
              className="inline-flex items-center gap-2 rounded-panel bg-primary px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60"
            >
              <LockKeyhole size={16} />
              {passwordSaving ? "Resetting..." : "Reset Password"}
            </button>
          </form>
        )}
      </div>
    </Drawer>
  );
}
