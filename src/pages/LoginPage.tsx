import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { School, Eye, EyeOff, Crown, Sparkles } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useApp } from "../context/AppContext";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { cn } from "../utils/helpers";

const loginSchema = z.object({
  schoolCode: z.string().optional(),
  username: z.string().min(1, "Username or Email is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { login } = useAuth();
  const { success, error: showError } = useToast();
  const { schoolSettings } = useApp();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<"school" | "creator">("school");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      schoolCode: "CKCA01",
      username: "",
      password: "",
    },
  });

  const handleTabSwitch = (tab: "school" | "creator") => {
    setActiveTab(tab);
    if (tab === "creator") {
      setValue("username", "creator");
      setValue("password", "Creator@2026!");
    } else {
      setValue("schoolCode", "CKCA01");
      setValue("username", "admin");
      setValue("password", "admin123");
    }
  };

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    try {
      const schoolCode = activeTab === "school" ? (data.schoolCode || "CKCA01") : undefined;
      const loggedInUser = await login(data.username, data.password, schoolCode);
      success(`Welcome, ${loggedInUser.fullName}!`);

      if (loggedInUser.role === "CREATOR") {
        navigate("/creator/dashboard");
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side brand / hero */}
      <div
        className={cn(
          "hidden lg:flex lg:w-1/2 items-center justify-center p-12 transition-all duration-500",
          activeTab === "creator"
            ? "bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white"
            : "bg-gradient-to-br from-primary-600 to-primary-900 text-white"
        )}
      >
        <div className="max-w-md">
          {activeTab === "creator" ? (
            <>
              <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mb-8 text-amber-400 shadow-xl shadow-amber-500/10">
                <Crown className="w-9 h-9" />
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 mb-4">
                <Sparkles className="w-3.5 h-3.5" /> Developer & Owner Layer
              </div>
              <h1 className="text-4xl font-bold mb-4 tracking-tight">System Creator Portal</h1>
              <p className="text-slate-300 text-lg leading-relaxed">
                Super-administrative control plane sitting above Super Admins. Manage all schools, multi-tenant databases, global features, and system integrity.
              </p>
              <div className="mt-8 space-y-2.5 text-sm text-slate-300">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span>Cross-school view/manage mode with instant exit</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span>Feature toggle registry & plan presets</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span>Global audit trail and disaster recovery</span>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center mb-8">
                <School className="w-10 h-10" />
              </div>
              <h1 className="text-4xl font-bold mb-4">
                {(schoolSettings?.schoolName as string) || "CK CAREER ACADEMY"}
              </h1>
              <p className="text-primary-100 text-lg">
                Complete school management solution for administration, fees, attendance, and results.
              </p>
              <div className="mt-8 grid grid-cols-2 gap-4">
                {[
                  "Student Management",
                  "Fee Collection",
                  "Attendance Tracking",
                  "Result Management",
                ].map((f) => (
                  <div key={f} className="bg-white/10 rounded-lg p-3 text-sm">
                    {f}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right side login form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50 dark:bg-gray-950">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-primary-600 flex items-center justify-center">
              <School className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg">School Management</h1>
              <p className="text-sm text-gray-500">Sign in to continue</p>
            </div>
          </div>

          <div className="card p-8 shadow-xl">
            {/* Tab switch between School Staff & Creator */}
            <div className="flex rounded-xl bg-gray-100 dark:bg-gray-800 p-1 mb-6">
              <button
                type="button"
                onClick={() => handleTabSwitch("school")}
                className={cn(
                  "flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all",
                  activeTab === "school"
                    ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
                )}
              >
                <School className="w-3.5 h-3.5" />
                <span>School Staff</span>
              </button>
              <button
                type="button"
                onClick={() => handleTabSwitch("creator")}
                className={cn(
                  "flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all",
                  activeTab === "creator"
                    ? "bg-amber-500 text-slate-950 font-bold shadow-sm"
                    : "text-gray-500 hover:text-amber-500"
                )}
              >
                <Crown className="w-3.5 h-3.5" />
                <span>Creator Portal</span>
              </button>
            </div>

            <div className="mb-6">
              <h2 className="text-2xl font-bold">
                {activeTab === "creator" ? "Creator Console Sign In" : "Welcome back"}
              </h2>
              <p className="text-gray-500 text-sm mt-1">
                {activeTab === "creator"
                  ? "Logs in directly without school code with root privileges"
                  : "Enter your credentials to access your school"}
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {activeTab === "school" && (
                <Input
                  label="School Code"
                  placeholder="e.g. CKCA01"
                  error={errors.schoolCode?.message}
                  {...register("schoolCode")}
                />
              )}

              <Input
                label="Username or Email"
                placeholder={activeTab === "creator" ? "Enter creator username" : "Enter username"}
                error={errors.username?.message}
                {...register("username")}
              />

              <div className="relative">
                <Input
                  label="Password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter password"
                  error={errors.password?.message}
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-[34px] text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <Button
                type="submit"
                loading={loading}
                className={cn(
                  "w-full mt-2",
                  activeTab === "creator" &&
                    "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold border-none shadow-lg shadow-amber-500/20"
                )}
              >
                {activeTab === "creator" ? "Enter Creator Console" : "Sign In to School"}
              </Button>
            </form>

            {/* Demo Credentials Box */}
            <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800/80 rounded-xl border border-gray-100 dark:border-gray-800">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
                {activeTab === "creator" ? "Creator Credentials:" : "School Staff Credentials:"}
              </p>
              {activeTab === "creator" ? (
                <div className="space-y-1 font-mono text-xs">
                  <div className="flex justify-between text-amber-600 dark:text-amber-400">
                    <span>Username:</span>
                    <span className="font-bold">creator</span>
                  </div>
                  <div className="flex justify-between text-amber-600 dark:text-amber-400">
                    <span>Password:</span>
                    <span className="font-bold">Creator@2026!</span>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <span>admin / admin123</span>
                  <span>principal / admin123</span>
                  <span>accountant / admin123</span>
                  <span>teacher1 / admin123</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
