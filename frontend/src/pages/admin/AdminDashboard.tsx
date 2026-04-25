import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { formatDistanceToNow } from 'date-fns';
import Card from '../../components/common/Card';
import Spinner from '../../components/common/Spinner';
import ErrorMessage from '../../components/common/ErrorMessage';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
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
    inbound: number;
    outbound: number;
  };
  revenue: {
    total: number;
    thisMonth: number;
    growth: number;
  };
  messagesTrend: Array<{ date: string; count: number }>;
  timestamp?: string;
}

interface SystemHealth {
  database: {
    status: string;
    responseTime: string;
  };
  redis: {
    status: string;
    responseTime: string;
  };
  queue: {
    status: string;
    responseTime: string;
  };
  errorRate: string;
  uptime: number;
  memory: {
    used: number;
    total: number;
  };
}

interface WorkerRow {
  workerId: string;
  hostname: string;
  pid: number;
  connectionCount: number;
  lastHeartbeat: string;
  status: 'active' | 'inactive';
  age: number;
}

interface WorkersPayload {
  workers: WorkerRow[];
  stats: {
    totalWorkers: number;
    activeWorkers: number;
    inactiveWorkers: number;
    totalConnections: number;
  };
  timestamp: string;
}

interface ConnectionRow {
  botId: string;
  status: 'connecting' | 'qr_required' | 'connected' | 'disconnected';
  processId: number | null;
  hostname: string | null;
  updatedAt: string;
}

function healthTone(status: string): string {
  if (status === 'Healthy' || status === 'Reachable') return 'text-emerald-600';
  if (status === 'Slow') return 'text-amber-600';
  return 'text-red-600';
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [workers, setWorkers] = useState<WorkersPayload | null>(null);
  const [connections, setConnections] = useState<ConnectionRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const isFirstLoadRef = useRef(true);

  const chartData = useMemo(() => {
    if (!stats?.messagesTrend?.length) return [];
    return [...stats.messagesTrend].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [stats?.messagesTrend]);

  const fetchData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    } else if (isFirstLoadRef.current) {
      setLoading(true);
    }

    const nextErrors: string[] = [];

    const [statsResult, healthResult, workersResult, connectionsResult] = await Promise.allSettled([
      api.get<{ success: boolean; data: AdminStats }>('/admin/stats'),
      api.get<{ success: boolean; data: SystemHealth }>('/admin/system-health'),
      api.get<{ success: boolean; data: WorkersPayload }>('/admin/workers'),
      api.get<{ success: boolean; data: { connections: ConnectionRow[] } }>('/admin/connections'),
    ]);

    if (statsResult.status === 'fulfilled') {
      setStats(statsResult.value.data.data);
    } else {
      setStats(null);
      const msg =
        statsResult.reason?.response?.data?.error?.message || 'Failed to load platform statistics';
      nextErrors.push(msg);
    }

    if (healthResult.status === 'fulfilled') {
      setHealth(healthResult.value.data.data);
    } else {
      setHealth(null);
      const msg =
        healthResult.reason?.response?.data?.error?.message || 'Failed to load system health';
      nextErrors.push(msg);
    }

    if (workersResult.status === 'fulfilled') {
      setWorkers(workersResult.value.data.data);
    } else {
      setWorkers(null);
      const msg = workersResult.reason?.response?.data?.error?.message || 'Failed to load workers';
      nextErrors.push(msg);
    }

    if (connectionsResult.status === 'fulfilled') {
      setConnections(connectionsResult.value.data.data.connections);
    } else {
      setConnections(null);
      const msg =
        connectionsResult.reason?.response?.data?.error?.message || 'Failed to load connections';
      nextErrors.push(msg);
    }

    setErrors(nextErrors);
    setLastUpdated(new Date());
    isFirstLoadRef.current = false;

    if (isManualRefresh) {
      setRefreshing(false);
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData(false);
    const interval = setInterval(() => {
      void fetchData(false);
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const connectedLive = useMemo(
    () => (connections || []).filter((c) => c.status === 'connected').length,
    [connections]
  );

  if (loading && !stats && !health && !workers && !connections) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (errors.length === 4) {
    return (
      <div className="page-shell">
        <ErrorMessage message={errors[0] || 'Failed to fetch admin data'} />
        <div className="mt-4">
          <Button variant="secondary" onClick={() => void fetchData(true)} isLoading={refreshing}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="page-header flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="page-title">Admin Dashboard</h1>
          <p className="page-description">
            Monitor platform growth, revenue, message volume, workers, connections, and system
            health.
          </p>
          {lastUpdated && (
            <p className="mt-2 text-xs text-slate-500">
              Updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <Link to="/admin/users">
            <Button variant="secondary" type="button">
              Users
            </Button>
          </Link>
          <Link to="/admin/connections">
            <Button variant="secondary" type="button">
              Connections
            </Button>
          </Link>
          <Button
            variant="primary"
            type="button"
            onClick={() => void fetchData(true)}
            isLoading={refreshing}
          >
            Refresh
          </Button>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="mb-6 space-y-3">
          {errors.map((message, index) => (
            <ErrorMessage key={`${index}-${message}`} message={message} />
          ))}
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 mb-6">
          <Card>
            <h3 className="text-sm font-semibold text-slate-500">Total Users</h3>
            <p className="mt-2 text-3xl font-bold text-slate-950">{formatNumber(stats.users.total)}</p>
            {stats.users.growth > 0 && (
              <p className="mt-1 text-sm font-medium text-emerald-600">
                +{stats.users.growth}% new (30d / total)
              </p>
            )}
          </Card>

          <Card>
            <h3 className="text-sm font-semibold text-slate-500">Total Bots</h3>
            <p className="mt-2 text-3xl font-bold text-slate-950">{formatNumber(stats.bots.total)}</p>
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
            <h3 className="text-sm font-semibold text-slate-500">All Messages</h3>
            <p className="mt-2 text-3xl font-bold text-slate-950">
              {formatNumber(stats.messages.total)}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              In {formatNumber(stats.messages.inbound)} · Out {formatNumber(stats.messages.outbound)}
            </p>
          </Card>

          <Card>
            <h3 className="text-sm font-semibold text-slate-500">Revenue (Month)</h3>
            <p className="mt-2 text-3xl font-bold text-slate-950">
              {formatCurrency(stats.revenue.thisMonth)}
            </p>
            {stats.revenue.growth !== 0 && (
              <p
                className={`mt-1 text-sm font-medium ${
                  stats.revenue.growth > 0 ? 'text-emerald-600' : 'text-red-600'
                }`}
              >
                {stats.revenue.growth > 0 ? '+' : ''}
                {stats.revenue.growth}% vs last month
              </p>
            )}
          </Card>

          <Card>
            <h3 className="text-sm font-semibold text-slate-500">Revenue (All time)</h3>
            <p className="mt-2 text-3xl font-bold text-slate-950">
              {formatCurrency(stats.revenue.total)}
            </p>
            <p className="mt-1 text-sm text-slate-500">Completed top-ups</p>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3 mb-6">
        <Card className="xl:col-span-2">
          <h3 className="mb-1 text-lg font-semibold text-slate-950">Message volume (14 days)</h3>
          <p className="mb-6 text-sm text-slate-500">Daily messages across the platform (UTC dates).</p>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(date) =>
                    new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  }
                />
                <YAxis />
                <Tooltip
                  labelFormatter={(date) => new Date(date).toLocaleDateString()}
                  formatter={(value: number) => [value, 'Messages']}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#059669"
                  strokeWidth={3}
                  dot={{ fill: '#059669' }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-12 text-slate-500">No trend data available</div>
          )}
        </Card>

        <div className="space-y-6">
          {workers && (
            <Card>
              <h3 className="mb-4 text-lg font-semibold text-slate-950">Workers</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-slate-500">Active</p>
                  <p className="text-2xl font-bold text-slate-950">{workers.stats.activeWorkers}</p>
                </div>
                <div>
                  <p className="text-slate-500">Inactive</p>
                  <p className="text-2xl font-bold text-slate-950">{workers.stats.inactiveWorkers}</p>
                </div>
                <div>
                  <p className="text-slate-500">Total</p>
                  <p className="text-2xl font-bold text-slate-950">{workers.stats.totalWorkers}</p>
                </div>
                <div>
                  <p className="text-slate-500">Conn. (workers)</p>
                  <p className="text-2xl font-bold text-slate-950">
                    {workers.stats.totalConnections}
                  </p>
                </div>
              </div>
              <div className="mt-4 max-h-56 overflow-y-auto divide-y divide-slate-100 rounded-xl border border-slate-100">
                {workers.workers.length === 0 ? (
                  <p className="p-3 text-sm text-slate-500">No worker heartbeats yet</p>
                ) : (
                  workers.workers.slice(0, 8).map((w) => (
                    <div key={w.workerId} className="flex items-center justify-between gap-2 p-3 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">{w.workerId}</p>
                        <p className="truncate text-xs text-slate-500">
                          {w.hostname} · pid {w.pid} · {w.connectionCount} conns
                        </p>
                      </div>
                      <Badge variant={w.status === 'active' ? 'success' : 'warning'}>
                        {w.status}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </Card>
          )}

          {connections && (
            <Card>
              <h3 className="mb-4 text-lg font-semibold text-slate-950">Live connections</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-slate-500">Tracked</p>
                  <p className="text-2xl font-bold text-slate-950">{connections.length}</p>
                </div>
                <div>
                  <p className="text-slate-500">Connected</p>
                  <p className="text-2xl font-bold text-slate-950">{connectedLive}</p>
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Open the connections page for the full table and cleanup tools.
              </p>
            </Card>
          )}
        </div>
      </div>

      {health && (
        <Card>
          <h3 className="mb-4 text-lg font-semibold text-slate-950">System health</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <div>
              <p className="text-sm font-medium text-slate-500">Database</p>
              <p className={`mt-1 text-lg font-semibold ${healthTone(health.database.status)}`}>
                {health.database.status}
              </p>
              <p className="text-xs text-slate-500">{health.database.responseTime}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Redis</p>
              <p className={`mt-1 text-lg font-semibold ${healthTone(health.redis.status)}`}>
                {health.redis.status}
              </p>
              <p className="text-xs text-slate-500">{health.redis.responseTime}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Queue (RabbitMQ)</p>
              <p className={`mt-1 text-lg font-semibold ${healthTone(health.queue.status)}`}>
                {health.queue.status}
              </p>
              <p className="text-xs text-slate-500">{health.queue.responseTime}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Error rate (1h)</p>
              <p className="mt-1 text-lg font-semibold text-slate-950">{health.errorRate}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Memory (heap)</p>
              <p className="mt-1 text-lg font-semibold text-slate-950">
                {health.memory.used}MB / {health.memory.total}MB
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">API uptime</p>
              <p className="mt-1 text-lg font-semibold text-slate-950">
                {Math.floor(health.uptime / 3600)}h {Math.floor((health.uptime % 3600) / 60)}m
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
