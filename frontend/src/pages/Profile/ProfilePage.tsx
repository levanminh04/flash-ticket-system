import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useKeycloak } from "@react-keycloak/web";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { LoaderCircle } from "lucide-react";
import { FaCalendarAlt, FaPhoneAlt, FaUser } from "react-icons/fa";
import { IoCameraOutline } from "react-icons/io5";
import { MdEmail } from "react-icons/md";
import { useTranslation } from "react-i18next";
import { userService, UserProfile } from "../../services/userService";
import AccountSidebar from "../../components/account/AccountSidebar";
import AccountCategoryNav from "../../components/common/AccountCategoryNav";
import { PROFILE_UPDATED_EVENT } from "../../components/layout/Navbar";

type ProfileFormState = {
  firstName: string;
  lastName: string;
  displayName: string;
  phone: string;
  bio: string;
  dateOfBirth: string;
  gender: string;
};

function formatDateDisplay(value: string | null | undefined, language: string, fallback: string) {
  if (!value) return fallback;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(language === "en" ? "en-US" : "vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function createFormState(profile: UserProfile | null): ProfileFormState {
  return {
    firstName: profile?.firstName ?? "",
    lastName: profile?.lastName ?? "",
    displayName: profile?.displayName ?? "",
    phone: profile?.phone ?? "",
    bio: profile?.bio ?? "",
    dateOfBirth: profile?.dateOfBirth ?? "",
    gender: profile?.gender ?? "",
  };
}

export default function ProfilePage() {
  const { i18n, t } = useTranslation();
  const { keycloak } = useKeycloak();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [form, setForm] = useState<ProfileFormState>(createFormState(null));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarBroken, setAvatarBroken] = useState(false);
  const language = i18n.resolvedLanguage || "vi";

  const genderOptions = useMemo(
    () => [
      { value: "", label: t("profile.genderSelect") },
      { value: "MALE", label: t("profile.genderMale") },
      { value: "FEMALE", label: t("profile.genderFemale") },
      { value: "OTHER", label: t("profile.genderOther") },
      { value: "PREFER_NOT_TO_SAY", label: t("profile.genderPreferNot") },
    ],
    [t],
  );

  const genderLabels = useMemo<Record<string, string>>(
    () => ({
      MALE: t("profile.genderMale"),
      FEMALE: t("profile.genderFemale"),
      OTHER: t("profile.genderOther"),
      PREFER_NOT_TO_SAY: t("profile.genderPreferNot"),
    }),
    [t],
  );

  const formatGenderDisplay = (value?: string | null) => {
    if (!value) return t("profile.unavailable");
    return genderLabels[value] ?? value;
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await userService.getProfile();
        if (!cancelled) {
          setProfile(data);
          setForm(createFormState(data));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (keycloak.authenticated === false) {
      navigate("/", { replace: true });
    }
  }, [keycloak.authenticated, navigate]);

  const displayName = (
    profile?.displayName ||
    `${profile?.firstName || ""} ${profile?.lastName || ""}`.trim() ||
    (keycloak.tokenParsed?.name as string | undefined) ||
    keycloak.tokenParsed?.preferred_username ||
    t("profile.userFallback")
  ).trim();

  const email =
    profile?.email ?? (keycloak.tokenParsed?.email as string | undefined) ?? "";
  const usernameRaw =
    (keycloak.tokenParsed?.preferred_username as string | undefined) ||
    (email.includes("@") ? email.split("@")[0] : "") ||
    displayName.replace(/\s+/g, ".").toLowerCase();
  const defaultAvatarSeed = encodeURIComponent(usernameRaw || "flashticket-user");
  const defaultAvatar = `https://api.dicebear.com/7.x/initials/svg?seed=${defaultAvatarSeed}&backgroundColor=f59e0b,c084fc,34d399,60a5fa&fontWeight=700`;
  const avatarSrc = !avatarBroken ? profile?.avatarUrl || defaultAvatar : defaultAvatar;

  const isDirty = useMemo(() => {
    const initial = createFormState(profile);
    return JSON.stringify(initial) !== JSON.stringify(form);
  }, [form, profile]);

  const handleInputChange =
    (field: keyof ProfileFormState) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((current) => ({ ...current, [field]: event.target.value }));
    };

  const handleSaveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      const updatedProfile = await userService.updateProfile({
        firstName: form.firstName.trim() || undefined,
        lastName: form.lastName.trim() || undefined,
        displayName: form.displayName.trim() || undefined,
        phone: form.phone.trim() || undefined,
        bio: form.bio.trim() || undefined,
        dateOfBirth: form.dateOfBirth || undefined,
        gender: form.gender || undefined,
      });
      if (!updatedProfile) {
        toast.error(t("profile.updateFailed"));
        return;
      }
      setProfile(updatedProfile);
      setForm(createFormState(updatedProfile));
      toast.success(t("profile.updateSuccess"));
    } finally {
      setSaving(false);
    }
  };

  const handleResetForm = () => setForm(createFormState(profile));

  const handleAvatarSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      const updatedProfile = await userService.uploadAvatar(file);
      if (!updatedProfile) {
        toast.error(t("profile.avatarFailed"));
        return;
      }
      setProfile(updatedProfile);
      setAvatarBroken(false);
      window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT));
      toast.success(t("profile.avatarUpdated"));
    } finally {
      event.target.value = "";
      setAvatarUploading(false);
    }
  };

  if (!keycloak.authenticated) return null;

  return (
    <div className="profile-page">
      <AccountCategoryNav />
      <div className="container account-layout-container">
        <AccountSidebar />
        <div className="account-main-content">
          <h1 className="profile-page-title">{t("profile.title")}</h1>
          {loading ? (
            <div className="profile-loading">
              <div className="loading-spinner"></div>
              <span>{t("profile.loading")}</span>
            </div>
          ) : (
            <div className="profile-editor-stack">
              <section className="profile-card profile-main-card profile-summary-card">
                <div className="profile-header profile-header--editor">
                  <div className="profile-overview">
                    <div className="profile-avatar-wrap">
                      <div className="profile-avatar">
                        <img src={avatarSrc} alt={displayName} onError={() => setAvatarBroken(true)} />
                      </div>
                      <button
                        type="button"
                        className="profile-avatar-upload-btn"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={avatarUploading}
                        aria-label={t("profile.changeAvatar")}
                        title={t("profile.changeAvatar")}
                      >
                        {avatarUploading ? <LoaderCircle size={16} className="spin" /> : <IoCameraOutline size={20} />}
                      </button>
                      <span className="profile-avatar-status" aria-label={t("profile.active")} title={t("profile.active")} />
                      <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp" className="profile-hidden-file-input" onChange={handleAvatarSelection} />
                    </div>
                    <div className="profile-summary-info">
                      <div className="profile-identity">
                        <h2 className="profile-name">{displayName}</h2>
                      </div>
                      {profile?.roles && profile.roles.length > 0 ? (
                        <div className="profile-roles">
                          {profile.roles.map((role) => <span key={role} className="role-badge">{role}</span>)}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="profile-contact-grid">
                    <div className="profile-info-pill">
                      <MdEmail size={17} />
                      <span className="profile-info-value">{email || t("profile.unavailable")}</span>
                    </div>
                    <div className="profile-info-pill">
                      <FaPhoneAlt size={15} />
                      <span className="profile-info-value">{profile?.phone || t("profile.unavailable")}</span>
                    </div>
                    <div className="profile-info-pill">
                      <FaCalendarAlt size={16} />
                      <span className="profile-info-value">{formatDateDisplay(profile?.dateOfBirth, language, t("profile.unavailable"))}</span>
                    </div>
                    <div className="profile-info-pill">
                      <FaUser size={16} />
                      <span className="profile-info-value">{formatGenderDisplay(profile?.gender)}</span>
                    </div>
                  </div>
                </div>
              </section>

              <form className="profile-card profile-editor-card" onSubmit={handleSaveProfile}>
                <div className="profile-editor-header">
                  <div>
                    <h2 id="profile-editor-title">{t("profile.editTitle")}</h2>
                    <p>{t("profile.editDescription")}</p>
                  </div>
                </div>
                <div className="profile-editor-grid">
                  <label className="profile-field"><span>{t("profile.firstName")}</span><input value={form.firstName} onChange={handleInputChange("firstName")} placeholder={t("profile.firstNamePlaceholder")} /></label>
                  <label className="profile-field"><span>{t("profile.lastName")}</span><input value={form.lastName} onChange={handleInputChange("lastName")} placeholder={t("profile.lastNamePlaceholder")} /></label>
                  <label className="profile-field"><span>{t("profile.displayName")}</span><input value={form.displayName} onChange={handleInputChange("displayName")} placeholder={t("profile.displayNamePlaceholder")} /></label>
                  <label className="profile-field"><span>{t("profile.phone")}</span><input value={form.phone} onChange={handleInputChange("phone")} placeholder="+84901234567" /></label>
                  <label className="profile-field"><span>{t("profile.dateOfBirth")}</span><input type="date" value={form.dateOfBirth} onChange={handleInputChange("dateOfBirth")} /></label>
                  <label className="profile-field"><span>{t("profile.gender")}</span><select value={form.gender} onChange={handleInputChange("gender")}>{genderOptions.map((option) => <option key={option.value || "empty"} value={option.value}>{option.label}</option>)}</select></label>
                  <label className="profile-field profile-field--full"><span>{t("profile.bio")}</span><textarea value={form.bio} onChange={handleInputChange("bio")} placeholder={t("profile.bioPlaceholder")} rows={5} /></label>
                </div>
                <div className="profile-editor-actions">
                  <button type="button" className="btn btn-secondary" onClick={handleResetForm} disabled={!isDirty || saving}>{t("profile.reset")}</button>
                  <button type="submit" className="btn btn-primary" disabled={saving || !isDirty}>
                    {saving ? <LoaderCircle size={16} className="spin" /> : null}
                    {t("profile.save")}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
