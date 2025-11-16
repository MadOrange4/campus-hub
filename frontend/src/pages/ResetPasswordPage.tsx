import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Eye, EyeOff, CheckCircle } from "lucide-react";
import { isStrongPassword } from "../lib/password-strength.ts";
import { auth } from "../lib/firebase"; 
import { confirmPasswordReset } from "firebase/auth";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const nav = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);

  const oobCode = searchParams.get("oobCode");

  useEffect(() => {
    if (!oobCode) {
      setError("Invalid or missing password reset code.");
    }
  }, [oobCode]);

  async function handlePasswordResetSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading || !oobCode) return;

    setError(null);
    setSuccess(null);
    setLoading(true);

    const strengthCheckResult = isStrongPassword(newPassword);

    if (!strengthCheckResult.strong) {
      // Format the list of issues into a readable message
      const msg =
        "Your password is too weak: \n- " +
        strengthCheckResult.issues.filter(Boolean).join("\n- ");
      
      setError(msg);
      setLoading(false);
      return; // Stop execution if the password is weak
    }

    try {
      // Use the client-side Firebase SDK function
      await confirmPasswordReset(auth, oobCode, newPassword);

      setSuccess("Your password has been successfully reset!");
      setNewPassword("");
      // Redirect to login page after a few seconds
      setTimeout(() => nav("/login"), 1200);

    } catch (err: any) {
      // Handle Firebase client errors (e.g., auth/invalid-action-code, auth/expired-action-code)
      console.error("Password reset error:", err);
      setError(err.message || "An error occurred during password reset.");
    } finally {
      setLoading(false);
    }
  } 
  return (
    <div className="min-h-dvh bg-background text-text grid place-items-center px-4">
      <div className="w-full max-w-md bg-surface border border-border rounded-2xl shadow-soft p-6">
        <h1 className="text-2xl font-semibold mb-4">Reset Your Password</h1>

        {error && (
          <div className="mb-4 rounded-xl border border-danger/40 bg-danger/10 text-danger px-3 py-2 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-xl border border-success/40 bg-success/10 text-success px-3 py-2 text-sm flex items-center">
            <CheckCircle className="size-4 mr-2" />
            {success}
          </div>
        )}
        {!oobCode ? (
             <p className="text-sm text-text-muted">Please check the link in your email.</p>
        ) : (
            <form onSubmit={handlePasswordResetSubmit}>
                <label className="block text-sm font-medium mb-1" htmlFor="newPassword">
                    New Password
                </label>
                <div className="relative">
                    <input
                        id="newPassword"
                        className="w-full rounded-xl border border-border bg-surface px-3 py-2 pr-10 outline-none focus:ring-2 focus:ring-brand"
                        placeholder="••••••••"
                        type={showPw ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => {
                            setNewPassword(e.target.value);
                            setError(null);
                        }}
                        required
                        minLength={6}
                        disabled={loading || success !== null}
                    />
                    <button
                        type="button"
                        onClick={() => setShowPw((s) => !s)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-muted"
                        aria-label={showPw ? "Hide password" : "Show password"}
                        disabled={loading || success !== null}
                    >
                        {showPw ? (
                            <EyeOff className="size-4 text-text-muted" />
                        ) : (
                            <Eye className="size-4 text-text-muted" />
                        )}
                    </button>
                </div>

                <button
                    type="submit"
                    className="w-full mt-4 bg-brand text-white font-semibold py-2 px-4 rounded-xl hover:bg-brand-dark transition-colors disabled:opacity-50"
                    disabled={loading || success !== null || newPassword.length < 6}
                >
                    {loading ? "Resetting..." : "Reset Password"}
                </button>
            </form>
        )}
        <div className="mt-4 text-center">
            <button 
                onClick={() => nav("/login")} 
                className="text-sm text-text-muted hover:text-brand"
            >
                Back to Sign In
            </button>
        </div>
      </div>
    </div>
  );
}
