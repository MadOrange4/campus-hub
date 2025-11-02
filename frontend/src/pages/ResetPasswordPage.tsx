import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Eye, EyeOff, CheckCircle } from "lucide-react";

const API_PREFIX = "/api"; 

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const nav = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);
  
  // The 'oobCode' (out-of-band code) is in the URL query parameter
  const oobCode = searchParams.get("oobCode");

  // Check if the code exists when the component loads
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

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      setLoading(false);
      return;
    }

    try {
      // Make the API call to your FastAPI backend endpoint
      const response = await fetch(`${API_PREFIX}/auth/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          oobCode: oobCode, // This matches your Pydantic model
          newPassword: newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle error responses from FastAPI (e.g., auth/invalid-action-code)
        throw new Error(data.detail || "Failed to reset password.");
      }

      setSuccess(data.message || "Your password has been successfully reset!");
      setNewPassword("");
      // Optional: redirect to login page after a few seconds
      setTimeout(() => nav("/login"), 3000);

    } catch (err: any) {
      // This is where you might catch the specific 'auth/invalid-action-code' error
      console.error(err);
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
