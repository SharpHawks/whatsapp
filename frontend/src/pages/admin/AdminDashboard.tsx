import { useState, useEffect } from 'react';
import Card from '../../components/common/Card';
import Spinner from '../../components/common/Spinner';
import ErrorMessage from '../../components/common/ErrorMessage';
import { formatNumber, formatCurrency } from '../../lib/utils';
import { api } from '../../lib/api';

interface AdminStats {
  users: {
    total: number;
    newThisMonth: number;
    growth: number;
  };
  bots: {
    total: number;
    connected: number;
    disconnected: number;
  };
  messages: {
    total: number;
    today: number;
    thisMonth: number;
  };
  revenue: {
    total: number;
    thisMonth: number;
    growth: number;
  };
}

interface SystemHealth {
  database: {
    status: string;
    responseTime: string;
  };
  queue: {
    status: string;
  };
  errorRate: string;
  uptime: number;
  memory: {
    used: number;
    total: number;
  };
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [statsRes, healthRes] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/system-health'),
      ]);

      setStats(statsRes.data.data);
      setHealth(healthRes.data.data);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to fetch admin data');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !stats) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-shell">
        <ErrorMessage message={error} />
      </div>
    );
  }

  if (!stats || !health) {
    return (
      <div className="page-shell">
        <ErrorMessage message="No data available" />
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">Admin Dashboard</h1>
          <p className="page-description">
            Monitor platform growth, revenue, message volume, and system health.
          </p>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <h3 className="text-sm font-semibold text-slate-500">Total Users</h3>
          <p className="mt-2 text-3xl font-bold text-slate-950">
            {formatNumber(stats.users.total)}
          </p>
          {stats.users.growth > 0 && (
            <p className="mt-1 text-sm font-medium text-emerald-600">+{stats.users.growth}% this month</p>
          )}
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-slate-500">Total Bots</h3>
          <p className="mt-2 text-3xl font-bold text-slate-950">
            {formatNumber(stats.bots.total)}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {stats.bots.connected} connected, {stats.bots.disconnected} disconnected
          </p>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-slate-500">Messages Today</h3>
          <p className="mt-2 text-3xl font-bold text-slate-950">
            {formatNumber(stats.messages.today)}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {formatNumber(stats.messages.thisMonth)} this month
          </p>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-slate-500">Revenue (Month)</h3>
          <p className="mt-2 text-3xl font-bold text-slate-950">
            {formatCurrency(stats.revenue.thisMonth)}
          </p>
          {stats.revenue.growth !== 0 && (
            <p
              className={`mt-1 text-sm font-medium ${stats.revenue.growth > 0 ? 'text-emerald-600' : 'text-red-600'}`}
            >
              {stats.revenue.growth > 0 ? '+' : ''}
              {stats.revenue.growth}% vs last month
            </p>
          )}
        </Card>
      </div>

      {/* System Health */}
      <Card>
        <h3 className="mb-4 text-lg font-semibold text-slate-950">System Health</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <p className="text-sm font-medium text-slate-500">Database</p>
            <p
              className={`mt-1 text-lg font-semibold ${health.database.status === 'Healthy' ? 'text-emerald-600' : 'text-amber-600'}`}
            >
              {health.database.status}
            </p>
            <p className="text-xs text-slate-500">{health.database.responseTime}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Queue Status</p>
            <p className="mt-1 text-lg font-semibold text-emerald-600">{health.queue.status}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Error Rate</p>
            <p className="mt-1 text-lg font-semibold text-emerald-600">{health.errorRate}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Memory</p>
            <p className="mt-1 text-lg font-semibold text-slate-950">
              {health.memory.used}MB / {health.memory.total}MB
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Uptime</p>
            <p className="mt-1 text-lg font-semibold text-slate-950">
              {Math.floor(health.uptime / 3600)}h {Math.floor((health.uptime % 3600) / 60)}m
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
