import React, { useMemo, useState } from 'react';
import { Check, Search, Shield, Trash2, X } from 'lucide-react';
import { UserAccessStatus, UserAccount } from '../types/glucose';

interface MasterAccessViewProps {
  users: UserAccount[];
  currentUserUid: string;
  onUpdateStatus: (targetUid: string, status: UserAccessStatus) => Promise<void>;
  onDeleteUser: (targetUid: string) => Promise<void>;
}

type FilterStatus = 'all' | UserAccessStatus;

export const MasterAccessView: React.FC<MasterAccessViewProps> = ({
  users,
  currentUserUid,
  onUpdateStatus,
  onDeleteUser,
}) => {
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [search, setSearch] = useState('');
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [confirmDeleteUid, setConfirmDeleteUid] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const counts = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let denied = 0;
    for (const u of users) {
      if (u.status === 'pending') pending++;
      else if (u.status === 'approved') approved++;
      else denied++;
    }
    return { total: users.length, pending, approved, denied };
  }, [users]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (filter !== 'all' && u.status !== filter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          u.displayName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [users, filter, search]);

  const handleStatusChange = async (user: UserAccount, nextStatus: UserAccessStatus) => {
    setBusyUid(user.uid);
    try {
      await onUpdateStatus(user.uid, nextStatus);
      const label =
        nextStatus === 'approved'
          ? 'permitido'
          : nextStatus === 'denied'
            ? 'negado'
            : 'colocado em espera';
      setFeedback(`Acesso de ${user.email} atualizado para ${label}.`);
      setTimeout(() => setFeedback(null), 4000);
    } finally {
      setBusyUid(null);
    }
  };

  const handleDelete = async (user: UserAccount) => {
    setBusyUid(user.uid);
    try {
      await onDeleteUser(user.uid);
      setConfirmDeleteUid(null);
      setFeedback(`Registro de ${user.email} removido.`);
      setTimeout(() => setFeedback(null), 4000);
    } finally {
      setBusyUid(null);
    }
  };

  const formatLastLogin = (iso?: string) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
      });
    } catch {
      return '—';
    }
  };

  const statusMeta: Record<UserAccessStatus, { label: string; textClass: string }> = {
    pending: { label: 'Aguardando aprovação', textClass: 'text-amber-700' },
    approved: { label: 'Permitido', textClass: 'text-emerald-700' },
    denied: { label: 'Negado', textClass: 'text-rose-700' },
  };

  return (
    <div className="space-y-6">
      {feedback && (
        <div
          role="status"
          className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-xs font-semibold text-teal-900"
        >
          {feedback}
        </div>
      )}

      {/* Summary Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Total de Usuários</p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-900">
            {counts.total}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Aguardando Liberação</p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-amber-700">
            {counts.pending}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Permitidos</p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-emerald-700">
            {counts.approved}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Negados</p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-rose-700">
            {counts.denied}
          </p>
        </div>
      </section>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="inline-flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1">
          {(
            [
              { id: 'all', label: 'Todos' },
              { id: 'pending', label: `Pendentes (${counts.pending})` },
              { id: 'approved', label: 'Permitidos' },
              { id: 'denied', label: 'Negados' },
            ] as { id: FilterStatus; label: string }[]
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`min-h-[38px] rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                filter === item.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar nome ou e-mail..."
            className="w-full min-h-[42px] rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:bg-white focus:outline-none"
          />
        </div>
      </div>

      {/* User List */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {filteredUsers.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Nenhum usuário encontrado para o filtro selecionado.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredUsers.map((user) => {
              const isSelfMaster = user.uid === currentUserUid || user.role === 'master';
              const isBusy = busyUid === user.uid;
              const isConfirmDelete = confirmDeleteUid === user.uid;
              const st = statusMeta[user.status];

              return (
                <div
                  key={user.uid}
                  className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50/70 transition-colors"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={user.displayName || user.email}
                        referrerPolicy="no-referrer"
                        className="h-11 w-11 rounded-xl border border-slate-200 object-cover shrink-0"
                      />
                    ) : (
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 font-display text-sm font-bold text-slate-700 shrink-0">
                        {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                      </div>
                    )}

                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-display font-bold text-slate-900 truncate">
                          {user.displayName || 'Sem nome'}
                        </span>
                        {user.role === 'master' && (
                          <>
                            <span className="text-slate-300" aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-teal-800">
                              <Shield className="h-3.5 w-3.5" />
                              Usuário Master
                            </span>
                          </>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="font-mono truncate">{user.email}</span>
                        <span aria-hidden="true">·</span>
                        <span className={`font-semibold ${st.textClass}`}>{st.label}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          Último acesso: {formatLastLogin(user.lastLoginAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Access Controls */}
                  <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
                    {isSelfMaster ? (
                      <span className="text-xs font-semibold text-teal-800 px-2">
                        Acesso permanente (Master)
                      </span>
                    ) : isConfirmDelete ? (
                      <div className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1">
                        <span className="text-xs font-semibold text-rose-800 mr-1">
                          Remover?
                        </span>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleDelete(user)}
                          aria-label="Confirmar remoção"
                          className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-700 text-white hover:bg-rose-800"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => setConfirmDeleteUid(null)}
                          aria-label="Cancelar remoção"
                          className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-slate-700 border border-slate-200"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        {user.status !== 'approved' && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleStatusChange(user, 'approved')}
                            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50 transition-colors"
                          >
                            <Check className="h-4 w-4" />
                            <span>Permitir</span>
                          </button>
                        )}
                        {user.status !== 'denied' && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleStatusChange(user, 'denied')}
                            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-50 transition-colors"
                          >
                            <X className="h-4 w-4" />
                            <span>Negar</span>
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => setConfirmDeleteUid(user.uid)}
                          aria-label={`Remover ${user.email}`}
                          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
