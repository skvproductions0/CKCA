import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { PageHeader, LoadingSpinner, Badge } from '../../components/ui/Common';
import { formatDateTime, apiCall } from '../../utils/helpers';

export default function NotificationsPage() {
  const { error: showError } = useToast();
  const [notifications, setNotifications] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadNotifications(); }, []);

  const loadNotifications = async () => {
    try {
      const data = await apiCall(() => window.api.notifications.list());
      setNotifications(data as Record<string, unknown>[]);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const markRead = async (id: string) => {
    await apiCall(() => window.api.notifications.markRead(id));
    loadNotifications();
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader title="Notifications" subtitle="Alerts and reminders" />

      <div className="space-y-3">
        {notifications.map(n => (
          <div
            key={n.id as string}
            onClick={() => !n.isRead && markRead(n.id as string)}
            className={`card p-4 flex items-start gap-4 cursor-pointer transition-colors ${!n.isRead ? 'border-primary-200 bg-primary-50/50 dark:bg-primary-900/10' : ''}`}
          >
            <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800"><Bell className="w-5 h-5" /></div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-medium">{n.title as string}</h3>
                <Badge variant={n.type === 'WARNING' ? 'warning' : n.type === 'ERROR' ? 'danger' : 'info'}>{n.type as string}</Badge>
                {!n.isRead && <span className="w-2 h-2 bg-primary-600 rounded-full" />}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{n.message as string}</p>
              <p className="text-xs text-gray-400 mt-2">{formatDateTime(n.createdAt as string)}</p>
            </div>
          </div>
        ))}
        {notifications.length === 0 && <p className="text-center text-gray-500 py-8">No notifications</p>}
      </div>
    </div>
  );
}
