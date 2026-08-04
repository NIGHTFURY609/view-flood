import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { toast } from "sonner";

import { useAuth } from "@/features/admin/auth/AuthContext";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

export function AdminLoginRoute() {
  const navigate = useNavigate();
  const { isAuthenticated, loading, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Already signed in (cookie valid, /me succeeded) — skip the form entirely.
  if (!loading && isAuthenticated) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(email, password);
      toast.success("Logged in successfully", {
        description: "Welcome to the admin dashboard.",
      });
      setTimeout(() => void navigate("/admin/dashboard"), 500);
    } catch {
      toast.error("Invalid credentials", {
        description: "Check your email and password and try again.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-foreground">Kerala Camp Check</h1>
          <p className="mt-1 text-sm text-muted-foreground">Admin Panel</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Enter your credentials to access the dashboard.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@local.com"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="md"
                className="mt-2 w-full"
                disabled={submitting}
              >
                {submitting && <Loader2 className="size-4 animate-spin" />}
                {submitting ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
