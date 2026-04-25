import { useState } from 'react'
import Card from '../../components/common/Card'
import Badge from '../../components/common/Badge'
import Button from '../../components/common/Button'
import Spinner from '../../components/common/Spinner'
import ErrorMessage from '../../components/common/ErrorMessage'
import { formatDateTime, formatCurrency } from '../../lib/utils'
import { useAdminUsers, useUpdateAdminUserRole, type AdminRole } from '../../hooks/useAdmin'

export default function AdminUsers() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [role, setRole] = useState<AdminRole | 'all'>('all')
  const limit = 20

  const { data, isLoading, error } = useAdminUsers({ page, limit, search, role })
  const updateRole = useUpdateAdminUserRole()
  const users = data?.users || []
  const totalPages = data ? Math.max(Math.ceil(data.total / data.limit), 1) : 1

  const handleRoleChange = (userId: string, nextRole: 'user' | 'admin') => {
    updateRole.mutate({ userId, role: nextRole })
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">User Management</h1>
          <p className="page-description">
            Manage platform customers, admins, balances, and bot ownership.
          </p>
        </div>
      </div>

      <Card className="mb-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_180px]">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Search</label>
            <input
              className="input"
              placeholder="Search by email"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Role</label>
            <select
              className="input"
              value={role}
              onChange={(event) => {
                setRole(event.target.value as AdminRole | 'all')
                setPage(1)
              }}
            >
              <option value="all">All roles</option>
              <option value="user">Users</option>
              <option value="admin">Admins</option>
              <option value="owner">Owner</option>
            </select>
          </div>
        </div>
      </Card>

      {error && (
        <div className="mb-6">
          <ErrorMessage message="Failed to load users" />
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Email</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Role</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Registered</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Balance</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Bots</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Spinner size="lg" />
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-500">
                    No users found.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/80">
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex items-center">
                        <div>
                          <div className="text-sm font-semibold text-slate-950">{user.email}</div>
                          <div className="mt-1">
                            <Badge variant={user.emailVerified ? 'success' : 'warning'} size="sm">
                              {user.emailVerified ? 'Verified' : 'Unverified'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <Badge variant={user.role === 'owner' ? 'info' : user.role === 'admin' ? 'success' : 'default'}>
                        {user.role}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">
                      {formatDateTime(user.createdAt)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-slate-900">
                      {formatCurrency(user.balance)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700">
                      {user.activeBots} active / {user.totalBots} total
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm">
                      {user.role === 'owner' ? (
                        <span className="text-sm text-slate-400">Protected</span>
                      ) : (
                        <select
                          className="input h-9 min-w-32"
                          value={user.role}
                          disabled={updateRole.isPending}
                          onChange={(event) =>
                            handleRoleChange(user.id, event.target.value as 'user' | 'admin')
                          }
                        >
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                        </select>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {data && (
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            Showing {users.length} of {data.total} users
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((current) => Math.max(current - 1, 1))}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
