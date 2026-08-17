import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { School, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useApp } from "../context/AppContext";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { login } = useAuth();
  const { success, error: showError } = useToast();
  const { schoolSettings } = useApp();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    try {
      await login(data.username, data.password);
      success("Login successful!");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-600 to-primary-900 items-center justify-center p-12">
        <div className="text-white max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center mb-8">
            <School className="w-10 h-10" />
          </div>
          <h1 className="text-4xl font-bold mb-4">
            {(schoolSettings?.schoolName as string) || "CK CAREER ACADEMY"}
          </h1>
          <p className="text-primary-100 text-lg">
            Complete school management solution for administration, fees,
            attendance, and results.
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
        </div>
      </div>

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

          <div className="card p-8">
            <h2 className="text-2xl font-bold mb-2">Welcome back</h2>
            <p className="text-gray-500 mb-6">
              Enter your credentials to access the system
            </p>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Input
                label="Username or Email"
                placeholder="Enter username"
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
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              <Button type="submit" loading={loading} className="w-full">
                Sign In
              </Button>
            </form>

            <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-xs text-gray-500 mb-2">Demo Credentials:</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <span>admin / admin123</span>
                <span>principal / admin123</span>
                <span>accountant / admin123</span>
                <span>teacher1 / admin123</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
