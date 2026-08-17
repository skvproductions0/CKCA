import { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function LoadingSpinner({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      <p className="mt-3 text-sm text-gray-500">{message}</p>
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}

export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      {icon && <div className="mb-4 text-gray-400">{icon}</div>}
      <h3 className="text-lg font-medium text-gray-900 dark:text-white">{title}</h3>
      {description && <p className="text-sm text-gray-500 mt-1 text-center max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend?: string;
  color?: string;
}

export function StatCard({ title, value, icon, trend, color = 'bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400' }: StatCardProps) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {trend && <p className="text-xs text-gray-400 mt-1">{trend}</p>}
        </div>
        <div className={`p-3 rounded-xl ${color}`}>{icon}</div>
      </div>
    </div>
  );
}

interface BadgeProps {
  children: ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'gray';
}

export function Badge({ children, variant = 'gray' }: BadgeProps) {
  const variants = {
    success: 'badge-success',
    warning: 'badge-warning',
    danger: 'badge-danger',
    info: 'badge-info',
    gray: 'badge-gray',
  };
  return <span className={variants[variant]}>{children}</span>;
}

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
      <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
      <div className="flex gap-2">
        <button className="btn-secondary btn-sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Previous</button>
        <button className="btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>Next</button>
      </div>
    </div>
  );
}
