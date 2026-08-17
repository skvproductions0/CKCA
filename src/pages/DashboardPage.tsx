import { useState, useEffect } from 'react';
import {
  Users, GraduationCap, School, ClipboardCheck, Wallet,
  AlertTriangle, UserPlus, TrendingUp,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell,
} from 'recharts';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { PageHeader, StatCard, LoadingSpinner } from '../components/ui/Common';
import { formatCurrency, formatDate, apiCall } from '../utils/helpers';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function DashboardPage() {
  const { academicYear } = useApp();
  const { error: showError } = useToast();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, [academicYear?.id]);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const stats = await apiCall(() => window.api.dashboard.getStats(academicYear?.id));
      setData(stats as Record<string, unknown>);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading dashboard..." />;
  if (!data) return null;

  const stats = data.stats as Record<string, number>;
  const charts = data.charts as Record<string, unknown[]>;
  const activity = data.recentActivity as Record<string, unknown[]>;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={`Overview for academic year ${academicYear?.name || ''}`}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Students" value={stats.totalStudents?.toLocaleString() || '0'} icon={<Users className="w-6 h-6" />} />
        <StatCard title="Teachers" value={stats.totalTeachers || 0} icon={<GraduationCap className="w-6 h-6" />} color="bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400" />
        <StatCard title="Today's Collection" value={formatCurrency(stats.todayCollectionPaise || 0)} icon={<Wallet className="w-6 h-6" />} color="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" />
        <StatCard title="Pending Fees" value={formatCurrency(stats.pendingFeesPaise || 0)} icon={<AlertTriangle className="w-6 h-6" />} color="bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Classes" value={stats.totalClasses || 0} icon={<School className="w-6 h-6" />} color="bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" />
        <StatCard title="Today's Attendance" value={`${stats.todayAttendancePercent || 0}%`} icon={<ClipboardCheck className="w-6 h-6" />} color="bg-cyan-50 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400" />
        <StatCard title="Monthly Collection" value={formatCurrency(stats.monthlyCollectionPaise || 0)} icon={<TrendingUp className="w-6 h-6" />} color="bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400" />
        <StatCard title="Total Admissions" value={stats.totalAdmissions || 0} icon={<UserPlus className="w-6 h-6" />} color="bg-pink-50 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="card p-5">
          <h3 className="font-semibold mb-4">Monthly Fee Collection</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={charts.monthlyFees as { month: string; amount: number }[]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: number) => [`₹${v.toLocaleString()}`, 'Amount']} />
              <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h3 className="font-semibold mb-4">Attendance Trend</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={charts.attendance as { month: string; present: number }[]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
              <Tooltip formatter={(v: number) => [`${v}%`, 'Attendance']} />
              <Line type="monotone" dataKey="present" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h3 className="font-semibold mb-4">Class-wise Students</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={charts.classDistribution as { name: string; students: number }[]}
                dataKey="students"
                nameKey="name"
                cx="50%" cy="50%"
                outerRadius={80}
                label={({ name, students }) => `${name}: ${students}`}
              >
                {(charts.classDistribution as { name: string; students: number }[]).map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h3 className="font-semibold mb-4">Exam Performance</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={charts.examPerformance as { name: string; average: number }[]} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={100} />
              <Tooltip formatter={(v: number) => [`${v}%`, 'Average']} />
              <Bar dataKey="average" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h3 className="font-semibold mb-4">Recent Fee Payments</h3>
          <div className="space-y-3">
            {(activity.payments as { receiptNumber: string; amountPaise: number; paymentDate: string; student: { name: string } }[]).map((p, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                <div>
                  <p className="text-sm font-medium">{p.student?.name}</p>
                  <p className="text-xs text-gray-500">{p.receiptNumber} • {formatDate(p.paymentDate)}</p>
                </div>
                <span className="text-sm font-semibold text-green-600">{formatCurrency(p.amountPaise)}</span>
              </div>
            ))}
            {(!activity.payments || (activity.payments as unknown[]).length === 0) && (
              <p className="text-sm text-gray-500 text-center py-4">No recent payments</p>
            )}
          </div>
        </div>

        <div className="card p-5">
          <h3 className="font-semibold mb-4">Recent Admissions</h3>
          <div className="space-y-3">
            {(activity.admissions as { name: string; admissionNumber: string; admissionDate: string; status: string }[]).map((a, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                <div>
                  <p className="text-sm font-medium">{a.name}</p>
                  <p className="text-xs text-gray-500">{a.admissionNumber}</p>
                </div>
                <span className="badge-info">{a.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
