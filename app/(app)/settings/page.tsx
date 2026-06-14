"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { User, Lock, CheckCircle2, AlertCircle } from "lucide-react";

type AlertState = { type: "success" | "error"; message: string } | null;

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Profile form
  const [name, setName] = useState("");
  const [profileAlert, setProfileAlert] = useState<AlertState>(null);
  const [profileSaving, setProfileSaving] = useState(false);

  // Password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordAlert, setPasswordAlert] = useState<AlertState>(null);
  const [passwordSaving, setPasswordSaving] = useState(false);

  useEffect(() => {
    api.auth
      .me()
      .then((data: any) => {
        setUser(data.user);
        setName(data.user.name);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    setProfileAlert(null);
    setProfileSaving(true);
    try {
      const updated = await api.auth.updateProfile({ name }) as any;
      setUser((prev: any) => ({ ...prev, name: updated.name || name }));
      setProfileAlert({ type: "success", message: "Profile updated successfully!" });
    } catch (err: any) {
      setProfileAlert({ type: "error", message: err.message || "Failed to update profile" });
    } finally {
      setProfileSaving(false);
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPasswordAlert(null);

    if (newPassword !== confirmPassword) {
      setPasswordAlert({ type: "error", message: "New passwords do not match." });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordAlert({ type: "error", message: "New password must be at least 6 characters." });
      return;
    }

    setPasswordSaving(true);
    try {
      await api.auth.updateProfile({ currentPassword, newPassword });
      setPasswordAlert({ type: "success", message: "Password changed successfully!" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPasswordAlert({ type: "error", message: err.message || "Failed to change password" });
    } finally {
      setPasswordSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse max-w-2xl">
        <div className="h-8 w-48 bg-gray-200 rounded" />
        <div className="h-64 bg-gray-100 rounded-xl" />
        <div className="h-64 bg-gray-100 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage your account and preferences</p>
      </div>

      {/* Profile Card */}
      <Card className="shadow-sm border-gray-100">
        <CardHeader className="border-b border-gray-100 bg-gray-50/50 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-lg">
              <User className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <CardTitle className="text-base">Profile</CardTitle>
              <CardDescription className="text-xs mt-0.5">Update your display name</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <Avatar className="w-16 h-16">
              <AvatarImage src={user?.avatarUrl || undefined} />
              <AvatarFallback className="text-xl bg-indigo-100 text-indigo-700">
                {getInitials(user?.name || "?")}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold text-gray-900">{user?.name}</p>
              <p className="text-sm text-gray-500">{user?.email}</p>
            </div>
          </div>

          <form onSubmit={handleProfileSave} className="space-y-4" id="profile-form">
            {profileAlert && (
              <div
                className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${
                  profileAlert.type === "success"
                    ? "bg-green-50 border border-green-100 text-green-700"
                    : "bg-red-50 border border-red-100 text-red-700"
                }`}
                role="alert"
              >
                {profileAlert.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <AlertCircle className="w-4 h-4" />
                )}
                {profileAlert.message}
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="profile-name" className="text-sm font-medium text-gray-700">
                Display Name
              </label>
              <Input
                id="profile-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
                maxLength={100}
                className="max-w-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Email</label>
              <Input
                type="email"
                value={user?.email || ""}
                disabled
                className="max-w-sm bg-gray-50 text-gray-500"
              />
              <p className="text-xs text-gray-400">Email cannot be changed.</p>
            </div>

            <Button
              id="save-profile-btn"
              type="submit"
              disabled={profileSaving || !name.trim()}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {profileSaving ? "Saving…" : "Save changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Password Card */}
      <Card className="shadow-sm border-gray-100">
        <CardHeader className="border-b border-gray-100 bg-gray-50/50 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-50 rounded-lg">
              <Lock className="w-4 h-4 text-orange-600" />
            </div>
            <div>
              <CardTitle className="text-base">Change Password</CardTitle>
              <CardDescription className="text-xs mt-0.5">Choose a strong password</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handlePasswordChange} className="space-y-4" id="password-form">
            {passwordAlert && (
              <div
                className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${
                  passwordAlert.type === "success"
                    ? "bg-green-50 border border-green-100 text-green-700"
                    : "bg-red-50 border border-red-100 text-red-700"
                }`}
                role="alert"
              >
                {passwordAlert.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <AlertCircle className="w-4 h-4" />
                )}
                {passwordAlert.message}
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="current-password" className="text-sm font-medium text-gray-700">
                Current Password
              </label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="max-w-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="new-password" className="text-sm font-medium text-gray-700">
                New Password
              </label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                className="max-w-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="confirm-password" className="text-sm font-medium text-gray-700">
                Confirm New Password
              </label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                className="max-w-sm"
              />
            </div>

            <Button
              id="change-password-btn"
              type="submit"
              disabled={passwordSaving || !currentPassword || !newPassword || !confirmPassword}
              variant="outline"
              className="border-orange-200 text-orange-700 hover:bg-orange-50"
            >
              {passwordSaving ? "Changing…" : "Change password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
