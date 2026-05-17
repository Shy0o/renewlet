import { useSearchParams } from "react-router-dom";
import { ResetPasswordClient } from "./reset-password-client";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  return <ResetPasswordClient token={searchParams.get("token") ?? ""} />;
}
