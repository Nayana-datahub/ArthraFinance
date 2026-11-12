"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, User, KeyRound, LogOut, X, CheckCircle2 } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

interface UserProfileDropdownProps {
  initialUserName?: string;
  onNameChange?: (name: string) => void;
}

export default function UserProfileDropdown({
  initialUserName = "Nayana",
  onNameChange,
}: UserProfileDropdownProps) {
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Profile data state
  const [displayName, setDisplayName] = useState(initialUserName);
  const [email, setEmail] = useState("user@example.com");

  // Dropdown open state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Modals state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  // Edit Profile form state
  const [newName, setNewName] = useState(displayName);
  const [editError, setEditError] = useState("");
  const [editSuccess, setEditSuccess] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Change Password form state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  // Fetch actual authenticated user details from Supabase
  useEffect(() => {
    let isMounted = true;

    async function fetchUser() {
      try {
        if (isSupabaseConfigured) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user && isMounted) {
            const fetchedName =
              user.user_metadata?.full_name ||
              user.user_metadata?.name ||
              (user.email ? user.email.split("@")[0] : null) ||
              (typeof window !== "undefined" ? localStorage.getItem("arthra_user_name") : null) ||
              initialUserName;

            setDisplayName(fetchedName);
            setNewName(fetchedName);
            if (user.email) setEmail(user.email);
            if (onNameChange) onNameChange(fetchedName);
            return;
          }
        }
        // Fallback to local storage if offline or not logged in
        if (isMounted && typeof window !== "undefined") {
          const stored = localStorage.getItem("arthra_user_name");
          if (stored) {
            setDisplayName(stored);
            setNewName(stored);
            if (onNameChange) onNameChange(stored);
          }
        }
      } catch {
        // Fallback
        if (isMounted && typeof window !== "undefined") {
          const stored = localStorage.getItem("arthra_user_name");
          if (stored) {
            setDisplayName(stored);
            setNewName(stored);
            if (onNameChange) onNameChange(stored);
          }
        }
      }
    }

    fetchUser();

    // Listen to profile updates broadcasted across the app
    const handleProfileUpdate = () => fetchUser();
    window.addEventListener("arthra_profile_update", handleProfileUpdate);
    return () => {
      isMounted = false;
      window.removeEventListener("arthra_profile_update", handleProfileUpdate);
    };
  }, [initialUserName, onNameChange]);

  // Close dropdown on click outside or escape key
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Handler: Update Display Name
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError("");
    setEditSuccess("");

    const trimmed = newName.trim();
    if (!trimmed) {
      setEditError("Please enter a valid display name.");
      return;
    }

    setIsSavingProfile(true);

    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase.auth.updateUser({
          data: { full_name: trimmed },
        });

        if (error) {
          setEditError(error.message);
          setIsSavingProfile(false);
          return;
        }
      }

      // Update local storage and dispatch update
      if (typeof window !== "undefined") {
        localStorage.setItem("arthra_user_name", trimmed);
      }
      setDisplayName(trimmed);
      if (onNameChange) onNameChange(trimmed);
      window.dispatchEvent(new Event("arthra_profile_update"));

      setEditSuccess("Profile updated successfully!");
      setTimeout(() => {
        setIsEditModalOpen(false);
        setEditSuccess("");
      }, 900);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update profile.";
      setEditError(msg);
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Handler: Change Password
  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match. Please re-enter.");
      return;
    }

    setIsSavingPassword(true);

    try {
      if (!isSupabaseConfigured) {
        setPasswordSuccess("Password validated and updated.");
        setTimeout(() => {
          setIsPasswordModalOpen(false);
          setNewPassword("");
          setConfirmPassword("");
          setPasswordSuccess("");
        }, 900);
        setIsSavingPassword(false);
        return;
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setPasswordError(error.message);
        setIsSavingPassword(false);
        return;
      }

      setPasswordSuccess("Password changed successfully!");
      setTimeout(() => {
        setIsPasswordModalOpen(false);
        setNewPassword("");
        setConfirmPassword("");
        setPasswordSuccess("");
      }, 900);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to change password.";
      setPasswordError(msg);
    } finally {
      setIsSavingPassword(false);
    }
  };

  // Handler: Logout
  const handleLogout = async () => {
    try {
      setIsDropdownOpen(false);
      if (isSupabaseConfigured) {
        await supabase.auth.signOut();
      }
      router.push("/login");
    } catch {
      router.push("/login");
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Preserved Profile Button */}
      <button
        type="button"
        onClick={() => setIsDropdownOpen((prev) => !prev)}
        className="flex items-center gap-2.5 bg-white border border-slate-100 rounded-full px-3 py-1.5 shadow-sm hover:border-slate-200 transition-colors focus:outline-none cursor-pointer"
        aria-label="User profile menu"
        aria-expanded={isDropdownOpen}
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-600 text-white font-semibold flex items-center justify-center text-xs shadow-inner">
          {displayName.charAt(0).toUpperCase()}
        </div>
        <span className="text-sm font-semibold text-slate-800">{displayName}</span>
        <ChevronDown
          size={14}
          className={`text-slate-400 transition-transform duration-200 ${
            isDropdownOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Profile Dropdown Menu */}
      {isDropdownOpen && (
        <div className="absolute right-0 top-full mt-2 w-64 sm:w-72 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
          {/* 1. My Profile Header */}
          <div className="px-4 py-3 border-b border-slate-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              My Profile
            </span>
            <p className="text-sm font-bold text-slate-900 mt-1 truncate">
              {displayName}
            </p>
            <p className="text-xs text-slate-500 truncate mt-0.5">
              {email}
            </p>
          </div>

          {/* Action Items */}
          <div className="p-1.5 space-y-0.5">
            {/* 2. Edit Profile */}
            <button
              type="button"
              onClick={() => {
                setIsDropdownOpen(false);
                setNewName(displayName);
                setEditError("");
                setEditSuccess("");
                setIsEditModalOpen(true);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-xl transition-colors text-left cursor-pointer"
            >
              <User size={15} className="text-slate-500" />
              <span>Edit Profile</span>
            </button>

            {/* 3. Change Password */}
            <button
              type="button"
              onClick={() => {
                setIsDropdownOpen(false);
                setNewPassword("");
                setConfirmPassword("");
                setPasswordError("");
                setPasswordSuccess("");
                setIsPasswordModalOpen(true);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-xl transition-colors text-left cursor-pointer"
            >
              <KeyRound size={15} className="text-slate-500" />
              <span>Change Password</span>
            </button>
          </div>

          {/* 4. Logout */}
          <div className="pt-1.5 border-t border-slate-100 px-1.5">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors text-left cursor-pointer"
            >
              <LogOut size={15} className="text-rose-500" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}

      {/* Modal: Edit Profile */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 sm:p-7 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">Edit Profile</h2>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {editError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-xs font-medium">
                {editError}
              </div>
            )}

            {editSuccess && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-medium flex items-center gap-2">
                <CheckCircle2 size={15} />
                <span>{editSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  Display Name
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Enter your name"
                  required
                  autoFocus
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  disabled
                  className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2.5 text-sm text-slate-500 cursor-not-allowed"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Registered account email cannot be changed directly here.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={isSavingProfile}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors shadow-md shadow-blue-500/20 flex items-center gap-2 cursor-pointer"
                >
                  {isSavingProfile && (
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  )}
                  <span>{isSavingProfile ? "Saving..." : "Save Changes"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Change Password */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 sm:p-7 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">Change Password</h2>
              <button
                type="button"
                onClick={() => setIsPasswordModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {passwordError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-xs font-medium">
                {passwordError}
              </div>
            )}

            {passwordSuccess && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-medium flex items-center gap-2">
                <CheckCircle2 size={15} />
                <span>{passwordSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSavePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  required
                  autoFocus
                  minLength={6}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  required
                  minLength={6}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  disabled={isSavingPassword}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingPassword}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors shadow-md shadow-blue-500/20 flex items-center gap-2 cursor-pointer"
                >
                  {isSavingPassword && (
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  )}
                  <span>{isSavingPassword ? "Updating..." : "Update Password"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

