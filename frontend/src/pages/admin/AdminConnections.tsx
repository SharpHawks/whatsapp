import { useState, useEffect } from 'react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Spinner from '../../components/common/Spinner';
import ErrorMessage from '../../components/common/ErrorMessage';
import { api } from '../../lib/api';
import { formatDistanceToNow } from 'date-fns';

interface Connection {
  botId: string;
  status: 'connecting' | 'qr_required' | 'connected' | 'disconnected';
  processId: number | null;
  hostname: string | null;
  updatedAt: string;
}

interface ConnectionsResponse {
  success: boolean;
  data: {
    connections: Connection[];
    count: number;
    timestamp: string;
  };
}

export default function AdminConnections() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cleaningUp, setCleaningUp] = useState(false);

  const fetchConnections = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<ConnectionsResponse>('/admin/connections');
      setConnections(response.data.data.connections);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to fetch connections');
    } finally {
      setLoading(false);
    }
  };

  const handleCleanup = async () => {
    try {
      setCleaningUp(true);
      await api.post('/admin/connections/cleanup');
      // Refresh connections after cleanup
      await fetchConnections();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to cleanup connections');
    } finally {
      setCleaningUp(false);
    }
  };

  useEffect(() => {
    fetchConnections();
    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchConnections, 10000);
    return () => clearInterval(interval);
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return <Badge variant="success">Connected</Badge>;
      case 'connecting':
        return <Badge variant="warning">Connecting</Badge>;
      case 'qr_required':
        return <Badge variant="info">QR Required</Badge>;
      case 'disconnected':
        return <Badge variant="error">Disconnected</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  if (loading && connections.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="page-header flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Worker Connections</h1>
          <p className="page-description">
            Monitor active bot connections across worker processes
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={fetchConnections} disabled={loading}>
            {loading ? <Spinner size="sm" /> : 'Refresh'}
          </Button>
          <Button variant="primary" onClick={handleCleanup} disabled={cleaningUp}>
            {cleaningUp ? <Spinner size="sm" /> : 'Cleanup Stale'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-6">
          <ErrorMessage message={error} />
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <h3 className="text-sm font-semibold text-slate-500">Total Connections</h3>
          <p className="mt-2 text-3xl font-bold text-slate-950">{connections.length}</p>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-slate-500">Connected</h3>
          <p className="mt-2 text-3xl font-bold text-emerald-600">
            {connections.filter((c) => c.status === 'connected').length}
          </p>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-slate-500">Connecting</h3>
          <p className="mt-2 text-3xl font-bold text-amber-600">
            {connections.filter((c) => c.status === 'connecting').length}
          </p>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-slate-500">Unique Processes</h3>
          <p className="mt-2 text-3xl font-bold text-slate-950">
            {new Set(connections.map((c) => c.processId).filter(Boolean)).size}
          </p>
        </Card>
      </div>

      {/* Connections Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Bot ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Process ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Hostname
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Last Updated
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {connections.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-500">
                    No active connections found
                  </td>
                </tr>
              ) : (
                connections.map((connection) => (
                  <tr key={connection.botId} className="hover:bg-slate-50/80">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-900">
                      {connection.botId.substring(0, 8)}...
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(connection.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {connection.processId || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {connection.hostname || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {formatDistanceToNow(new Date(connection.updatedAt), { addSuffix: true })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Auto-refresh indicator */}
      <div className="mt-4 text-center text-sm text-slate-500">
        Auto-refreshing every 10 seconds
      </div>
    </div>
  );
}
