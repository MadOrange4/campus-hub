// src/pages/HandleAuthActionPage.tsx
import { useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";

export default function HandleAuthActionPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const mode = searchParams.get("mode");
    const oobCode = searchParams.get("oobCode");
    // Other parameters like 'continueUrl' might also be present

    if (oobCode) {
      switch (mode) {
        case "resetPassword":
          // Redirect to your specific ResetPasswordPage, keeping the code
          navigate(`/reset-password?oobCode=${oobCode}`);
          break;
        case "verifyEmail":
          // Redirect to your specific VerifyEmailPage, keeping the code
          navigate(`/verify?oobCode=${oobCode}`);
          break;
        // Handle other modes like 'recoverEmail' or 'verifyAndChangeEmail' if needed
        default:
          navigate("/login?error=invalid_action_mode");
          break;
      }
    } else {
      navigate("/login?error=missing_action_code");
    }
  }, [searchParams, navigate]);

  // A simple loading screen while the redirect happens
  return (
    <div className="flex items-center justify-center h-screen">
      <p>Processing request, please wait...</p>
    </div>
  );
}
