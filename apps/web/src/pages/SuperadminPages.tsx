import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  ShieldCheck,
  Lock,
  MoreHorizontal,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  UserPlus,
  ArrowRight,
  ArrowLeft,
  KeyRound,
  FileText,
  Clock,
  Layers,
  Database,
  Users,
  Building,
  Check,
  X,
  Play,
  RotateCcw,
  Copy,
  Plus,
  Edit2,
  UserCheck,
  ArrowRightLeft,
  Eye,
  EyeOff,
  UserMinus,
  ShieldAlert,
} from 'lucide-react';
import type {
  SaTeamItem,
  SaEligibleRelationshipManager,
  SaEligibleCaller,
  SaHrRequestItem,
  PlacementOptions,
} from '@finverse/contracts';
import { superadminApi } from '../lib/superadmin-api';
import { ApiError } from '../lib/api';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input, Textarea } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { EmptyState, SkeletonRows } from '../components/ui/states';
import { useSession } from '../lib/session';

export const CANONICAL_VERTICALS = ['wealth', 'banking', 'markets', 'real_estate'] as const;
export type CanonicalVertical = (typeof CANONICAL_VERTICALS)[number];

export const VERTICAL_LABELS: Record<string, string> = {
  wealth: 'Wealth Management',
  banking: 'Corporate Banking',
  markets: 'Markets & Trading',
  real_estate: 'Real Estate Advisory',
  'real-estate': 'Real Estate Advisory',
};

export const VERTICAL_SHORT_LABELS: Record<string, string> = {
  wealth: 'Wealth',
  banking: 'Banking',
  markets: 'Markets/Trading',
  real_estate: 'Real Estate',
  'real-estate': 'Real Estate',
};

export function getAvailableVerticals(grants?: readonly string[]): CanonicalVertical[] {
  const list = (grants || CANONICAL_VERTICALS) as readonly string[];
  return CANONICAL_VERTICALS.filter(
    (v) =>
      list.includes(v) ||
      list.includes(v.replace('_', '-')) ||
      (v === 'real_estate' && list.includes('real-estate'))
  );
}

interface DeckFrameProps {
  actionCode: string;
  moduleLabel: string;
  title: string;
  subtitle?: string;
  statusText?: string;
  steps: string[];
  whenCheckFails: string;
  permissionEvidence: string;
  children: ReactNode;
  onSubmit?: () => void;
  submitting?: boolean;
  submitLabel?: string;
  submitDisabled?: boolean;
}

function DeckFrame({
  actionCode,
  moduleLabel,
  title,
  subtitle = 'Company function · assigned permission scope · illustrative records',
  statusText = 'Ready for review',
  steps,
  whenCheckFails,
  permissionEvidence,
  children,
  onSubmit,
  submitting = false,
  submitLabel = 'Continue →',
  submitDisabled = false,
}: DeckFrameProps) {
  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 py-4">
      {/* Top action header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
        <div>
          <div className="text-xs font-semibold tracking-wider text-slate-500 uppercase mb-1">
            {actionCode} / {moduleLabel}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-display">
            {title}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Badge className="gap-1.5 py-1 px-3 text-xs bg-white text-slate-700 border-slate-300 font-medium">
            <Lock className="w-3 h-3 text-slate-500" />
            Scoped action
          </Badge>
          <button
            type="button"
            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
            aria-label="More options"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Grid: Work Area (left) + Right Rail Cards (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Primary Work Area */}
        <div className="lg:col-span-8 space-y-4">
          <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
            {/* Card Status Header */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-slate-100 bg-slate-50/50 text-xs">
              <div className="flex items-center gap-2 font-medium text-slate-700">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                {statusText}
              </div>
              <span className="text-slate-400">Updated 09:42 IST</span>
            </div>

            {/* Inner Content */}
            <CardContent className="p-6">
              <div className="text-xs font-semibold tracking-wider text-slate-400 uppercase mb-4">
                WORK AREA
              </div>
              {children}
            </CardContent>

            {/* Bottom Card Footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-slate-100 bg-slate-50/40">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Current role and scope checked on submit</span>
              </div>
              {onSubmit && (
                <Button
                  onClick={onSubmit}
                  disabled={submitDisabled || submitting}
                  className="w-full sm:w-auto bg-[#113F3D] hover:bg-[#0C2B29] text-white px-6 font-medium shadow-sm transition-all"
                >
                  {submitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  {submitLabel}
                </Button>
              )}
            </div>
          </Card>
        </div>

        {/* Right Rail: Canonical Action Deck Knowledge Panels */}
        <div className="lg:col-span-4 space-y-4">
          {/* Card 1: How this works */}
          <Card className="border-slate-200/90 shadow-sm bg-white p-5 space-y-4">
            <div className="border-b border-slate-100 pb-2">
              <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                HOW THIS WORKS
              </div>
              <div className="text-sm font-semibold text-slate-900 mt-0.5">
                Your next steps
              </div>
            </div>
            <div className="space-y-3">
              {steps.map((step, idx) => (
                <div key={idx} className="flex items-start gap-3 text-xs leading-relaxed text-slate-600">
                  <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-mono font-medium flex items-center justify-center shrink-0 text-[10px] border border-slate-200">
                    {String(idx + 1).padStart(2, '0')}
                  </div>
                  <div>{step}</div>
                </div>
              ))}
            </div>
          </Card>

          {/* Card 2: When a check fails */}
          <Card className="border-slate-200/90 shadow-sm bg-white p-5 space-y-2">
            <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              WHEN A CHECK FAILS
            </div>
            <p className="text-xs leading-relaxed text-slate-600">
              {whenCheckFails}
            </p>
          </Card>

          {/* Card 3: Permission & evidence */}
          <Card className="border-slate-200/90 shadow-sm bg-white p-5 space-y-2">
            <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              PERMISSION & EVIDENCE
            </div>
            <p className="text-xs leading-relaxed text-slate-600">
              {permissionEvidence}
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Superadmin Dynamic Teams & Frontline Capacity Section
// =============================================================================
export function SuperadminTeamsSection({
  standalone = false,
  controlledVertical,
}: {
  standalone?: boolean;
  controlledVertical?: string;
}) {
  const { session } = useSession();
  const [internalVertical, setInternalVertical] = useState<string>('all');
  const effectiveVertical = controlledVertical !== undefined ? controlledVertical : internalVertical;

  const [teams, setTeams] = useState<SaTeamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createVertical, setCreateVertical] = useState<'wealth' | 'banking' | 'markets' | 'real-estate'>('wealth');
  const [createRmId, setCreateRmId] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [eligibleRms, setEligibleRms] = useState<SaEligibleRelationshipManager[]>([]);

  // Edit Team modal
  const [editingTeam, setEditingTeam] = useState<SaTeamItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editStatus, setEditStatus] = useState<'active' | 'inactive'>('active');
  const [editRmId, setEditRmId] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // View Callers modal/drawer
  const [viewingCallersTeam, setViewingCallersTeam] = useState<SaTeamItem | null>(null);

  // Add / Move Caller modal
  const [assigningTeam, setAssigningTeam] = useState<SaTeamItem | null>(null);
  const [eligibleCallers, setEligibleCallers] = useState<SaEligibleCaller[]>([]);
  const [selectedCallerId, setSelectedCallerId] = useState('');
  const [assignReason, setAssignReason] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  const fetchTeams = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await superadminApi.listTeams(effectiveVertical);
      setTeams(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load teams.');
    } finally {
      setLoading(false);
    }
  }, [effectiveVertical]);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  // Synchronize createVertical when effectiveVertical changes
  useEffect(() => {
    if (effectiveVertical && effectiveVertical !== 'all') {
      const canonical = effectiveVertical === 'real_estate' ? 'real-estate' : effectiveVertical;
      setCreateVertical(canonical as any);
    }
  }, [effectiveVertical]);

  // Load eligible managers when create modal opens or vertical changes
  useEffect(() => {
    if (createModalOpen) {
      superadminApi.getEligibleManagers(createVertical)
        .then((list) => {
          setEligibleRms(list);
          if (list.length > 0 && !createRmId) {
            setCreateRmId(list[0].id);
          }
        })
        .catch(() => setEligibleRms([]));
    }
  }, [createModalOpen, createVertical]);

  // Load eligible managers when edit modal opens
  useEffect(() => {
    if (editingTeam) {
      setEditName(editingTeam.name);
      setEditStatus(editingTeam.status);
      setEditRmId(editingTeam.relationshipManagerId || '');
      superadminApi.getEligibleManagers(editingTeam.vertical)
        .then((list) => setEligibleRms(list))
        .catch(() => setEligibleRms([]));
    }
  }, [editingTeam]);

  // Load eligible callers when assigning modal opens
  useEffect(() => {
    if (assigningTeam) {
      setSelectedCallerId('');
      setAssignReason('');
      setAssignError(null);
      superadminApi.getEligibleCallers(assigningTeam.vertical)
        .then((list) => {
          setEligibleCallers(list);
          const available = list.find((c) => c.currentTeamId !== assigningTeam.id);
          if (available) {
            setSelectedCallerId(available.id);
          }
        })
        .catch(() => setEligibleCallers([]));
    }
  }, [assigningTeam]);

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim()) {
      setCreateError('Team name is required.');
      return;
    }
    setCreateLoading(true);
    setCreateError(null);
    try {
      const created = await superadminApi.createTeam({
        name: createName.trim(),
        vertical: createVertical,
        relationshipManagerId: createRmId || undefined,
      });
      setNotice({
        type: 'success',
        message: `Team "${created.name}" created successfully in ${created.vertical} (Supervising RM: ${created.relationshipManagerName || 'None'}). Callers: 0/10 (Staffing in progress).`,
      });
      setCreateModalOpen(false);
      setCreateName('');
      setCreateRmId('');
      await fetchTeams();
    } catch (err: any) {
      setCreateError(err?.message || 'Failed to create team.');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleUpdateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeam) return;
    setEditLoading(true);
    setEditError(null);
    try {
      const updated = await superadminApi.updateTeam(editingTeam.id, {
        name: editName.trim() || undefined,
        status: editStatus,
        relationshipManagerId: editRmId || null,
      });
      setNotice({
        type: 'success',
        message: `Team "${updated.name}" updated successfully (Status: ${updated.status}, RM: ${updated.relationshipManagerName || 'None'}).`,
      });
      setEditingTeam(null);
      await fetchTeams();
    } catch (err: any) {
      setEditError(err?.message || 'Failed to update team.');
    } finally {
      setEditLoading(false);
    }
  };

  const handleAssignCaller = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningTeam) return;
    if (!selectedCallerId) {
      setAssignError('Please select an eligible Sales Caller.');
      return;
    }
    setAssignLoading(true);
    setAssignError(null);
    try {
      const res = await superadminApi.assignCaller(assigningTeam.id, {
        callerEmployeeId: selectedCallerId,
        reason: assignReason.trim() || undefined,
      });
      setNotice({
        type: 'success',
        message: res.message,
      });
      setAssigningTeam(null);
      setSelectedCallerId('');
      setAssignReason('');
      await fetchTeams();
    } catch (err: any) {
      setAssignError(err?.message || 'Failed to assign caller.');
    } finally {
      setAssignLoading(false);
    }
  };

  const selectedCallerObj = eligibleCallers.find((c) => c.id === selectedCallerId);

  return (
    <div className={`space-y-4 ${standalone ? '' : 'mt-8'}`}>
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold tracking-tight text-slate-900">
              Teams & Frontline Capacity
            </h2>
            <Badge className="bg-[#113F3D] text-white text-[10px] uppercase tracking-wider">
              SA Supervised
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Vertical partitioned teams · Frontline Relationship Manager supervision · 5–10 Caller staffing
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={fetchTeams}
            variant="outline"
            className="h-8 text-xs border-slate-200 text-slate-600 hover:bg-slate-50"
            title="Refresh Teams"
          >
            <RefreshCw className="size-3.5 mr-1" />
            Refresh
          </Button>
          <Button
            size="sm"
            id="sa-create-team-btn"
            onClick={() => {
              setCreateName('');
              setCreateRmId('');
              setCreateError(null);
              setCreateModalOpen(true);
            }}
            className="h-8 text-xs bg-[#113F3D] hover:bg-[#0c2e2c] text-white shadow-xs"
          >
            <Plus className="size-3.5 mr-1" />
            Create Team
          </Button>
        </div>
      </div>

      {/* Notice Banner */}
      {notice && (
        <div className={`p-3 rounded-lg text-xs flex items-center justify-between gap-2 ${
          notice.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          <div className="flex items-center gap-2">
            {notice.type === 'success' ? <CheckCircle2 className="size-4 shrink-0 text-emerald-600" /> : <AlertTriangle className="size-4 shrink-0 text-rose-600" />}
            <span>{notice.message}</span>
          </div>
          <button type="button" onClick={() => setNotice(null)} className="text-slate-400 hover:text-slate-600">
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* Vertical Filter Bar */}
      {!controlledVertical && (
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100/80 rounded-lg border border-slate-200/60 w-fit">
          {[
            { key: 'all', label: 'All Verticals' },
            { key: 'wealth', label: 'Wealth' },
            { key: 'banking', label: 'Banking' },
            { key: 'markets', label: 'Markets' },
            { key: 'real-estate', label: 'Real Estate' },
          ].map((v) => {
            const isActive =
              effectiveVertical === v.key ||
              (v.key === 'real-estate' && effectiveVertical === 'real_estate');
            return (
              <button
                key={v.key}
                type="button"
                id={`sa-filter-${v.key}`}
                onClick={() => setInternalVertical(v.key)}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                  isActive
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                {v.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Teams Grid / List */}
      {loading ? (
        <div className="p-4"><SkeletonRows rows={4} /></div>
      ) : error ? (
        <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
          {error}
        </div>
      ) : teams.length === 0 ? (
        <div className="p-8 text-center border rounded-lg bg-slate-50/50">
          <p className="text-xs text-slate-500">No teams found for the selected vertical.</p>
          <Button
            size="sm"
            onClick={() => setCreateModalOpen(true)}
            className="mt-3 text-xs bg-[#113F3D] text-white"
          >
            Create First Team
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="sa-teams-list">
          {teams.map((t) => {
            const callersCount = t.callerCount || 0;
            const isFull = callersCount >= 10;
            const isStaffed = callersCount >= 5;
            const isEmpty = callersCount === 0;

            const vertBadgeColor =
              t.vertical === 'wealth'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : t.vertical === 'banking'
                ? 'bg-blue-50 text-blue-800 border-blue-300'
                : t.vertical === 'markets'
                ? 'bg-purple-50 text-purple-800 border-purple-300'
                : 'bg-amber-50 text-amber-800 border-amber-300';

            return (
              <Card
                key={t.id}
                id={`sa-team-card-${t.id}`}
                className="p-4 border-slate-200 shadow-xs bg-white hover:border-slate-300 transition flex flex-col justify-between space-y-3"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 leading-tight">
                        {t.name}
                      </h3>
                      <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                        {t.id}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge className={`text-[10px] capitalize ${vertBadgeColor}`}>
                        {t.vertical.replace('_', '-')}
                      </Badge>
                      <Badge
                        className={`text-[10px] ${
                          t.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-zinc-100 text-zinc-500 border-zinc-200'
                        }`}
                      >
                        {t.status}
                      </Badge>
                    </div>
                  </div>

                  {/* Relationship Manager Banner */}
                  <div className="p-2 rounded-md bg-slate-50/80 border border-slate-200/60 text-xs">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      Supervising Relationship Manager
                    </div>
                    {t.relationshipManagerName ? (
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <div className="font-semibold text-slate-800 truncate">
                          {t.relationshipManagerName}
                        </div>
                        <span className="font-mono text-[10px] text-slate-400 shrink-0">
                          {t.relationshipManagerId}
                        </span>
                      </div>
                    ) : (
                      <div className="text-amber-700 italic text-[11px] mt-0.5">
                        No Relationship Manager assigned
                      </div>
                    )}
                  </div>

                  {/* Staffing Capacity Banner */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-600">
                        {isEmpty ? (
                          <span className="text-amber-600 font-semibold">0 / 10 Callers (Staffing in progress)</span>
                        ) : isStaffed ? (
                          <span className="text-emerald-700 font-semibold">{callersCount} / 10 Callers (Staffed)</span>
                        ) : (
                          <span className="text-sky-700 font-semibold">{callersCount} / 10 Callers (Under-staffed: target 5–10)</span>
                        )}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">
                        {Math.min(100, Math.round((callersCount / 10) * 100))}%
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          isEmpty
                            ? 'w-0'
                            : isStaffed
                            ? 'bg-emerald-600'
                            : 'bg-sky-500'
                        }`}
                        style={{ width: `${Math.min(100, (callersCount / 10) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Team Card Actions */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    id={`sa-view-callers-${t.id}`}
                    onClick={() => setViewingCallersTeam(t)}
                    className="h-7 text-xs border-slate-200 text-slate-700 hover:bg-slate-50"
                  >
                    <Users className="size-3 mr-1 text-slate-500" />
                    Callers ({callersCount})
                  </Button>
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      id={`sa-edit-team-${t.id}`}
                      onClick={() => setEditingTeam(t)}
                      className="h-7 text-xs border-slate-200 text-slate-600 hover:bg-slate-50"
                      title="Edit team name, RM, or status"
                    >
                      <Edit2 className="size-3 mr-1" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      id={`sa-assign-caller-${t.id}`}
                      disabled={isFull || t.status !== 'active'}
                      onClick={() => setAssigningTeam(t)}
                      className="h-7 text-xs bg-[#113F3D] hover:bg-[#0c2e2c] text-white disabled:opacity-50"
                      title={isFull ? 'Team is at maximum capacity (10)' : 'Add or move a caller to this team'}
                    >
                      <Plus className="size-3 mr-1" />
                      Add Caller
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 1. Create Team Modal */}
      {/* --------------------------------------------------------------------- */}
      {createModalOpen && (
        <div
          id="sa-create-team-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
        >
          <Card className="w-full max-w-md shadow-xl border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b px-5 py-3.5">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Create New Team</h3>
                <p className="text-xs text-slate-500">Configure vertical partition and assign supervising Relationship Manager.</p>
              </div>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600"
              >
                <X className="size-4" />
              </button>
            </div>
            <form onSubmit={handleCreateTeam}>
              <CardContent className="p-5 space-y-3.5">
                {createError && (
                  <div className="p-2.5 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                    {createError}
                  </div>
                )}
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Team Name <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    id="sa-team-name-input"
                    placeholder="e.g. Wealth Delta or Wealth Growth"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    required
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    A vertical can have any number of teams, including Alpha, Beta, Gamma, and newly named teams.
                  </p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Vertical <span className="text-rose-500">*</span>
                  </label>
                  <Select
                    id="sa-team-vertical-select"
                    value={createVertical}
                    onChange={(e) => {
                      setCreateVertical(e.target.value as any);
                      setCreateRmId('');
                    }}
                    className="w-full"
                  >
                    <option value="wealth">Wealth</option>
                    <option value="banking">Banking</option>
                    <option value="markets">Markets</option>
                    <option value="real-estate">Real Estate</option>
                  </Select>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Each team belongs to exactly one vertical.
                  </p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Supervising Relationship Manager
                  </label>
                  <Select
                    id="sa-team-rm-select"
                    value={createRmId}
                    onChange={(e) => setCreateRmId(e.target.value)}
                    className="w-full"
                  >
                    <option value="">-- No Relationship Manager Assigned --</option>
                    {eligibleRms.map((rm) => (
                      <option key={rm.id} value={rm.id}>
                        {rm.name} ({rm.id}) — Supervises {rm.supervisedTeamCount} team{rm.supervisedTeamCount === 1 ? '' : 's'}
                      </option>
                    ))}
                  </Select>
                  <p className="text-[11px] text-slate-400 mt-1">
                    One Relationship Manager may supervise multiple teams in this vertical.
                  </p>
                </div>
              </CardContent>
              <div className="flex items-center justify-end gap-2 border-t px-5 py-3 bg-slate-50/50">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCreateModalOpen(false)}
                  disabled={createLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  id="sa-submit-create-team"
                  disabled={createLoading}
                  className="bg-[#113F3D] hover:bg-[#0c2e2c] text-white"
                >
                  {createLoading ? 'Creating...' : 'Create Team'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 2. Edit Team / Change RM Modal */}
      {/* --------------------------------------------------------------------- */}
      {editingTeam && (
        <div
          id="sa-edit-team-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
        >
          <Card className="w-full max-w-md shadow-xl border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b px-5 py-3.5">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Edit Team Governance</h3>
                <p className="text-xs text-slate-500">Update name, status, or supervising Relationship Manager.</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingTeam(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600"
              >
                <X className="size-4" />
              </button>
            </div>
            <form onSubmit={handleUpdateTeam}>
              <CardContent className="p-5 space-y-3.5">
                {editError && (
                  <div className="p-2.5 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                    {editError}
                  </div>
                )}
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Team Name
                  </label>
                  <Input
                    id="sa-edit-team-name-input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Status
                  </label>
                  <Select
                    id="sa-edit-team-status-select"
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    className="w-full"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </Select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Supervising Relationship Manager
                  </label>
                  <Select
                    id="sa-edit-team-rm-select"
                    value={editRmId}
                    onChange={(e) => setEditRmId(e.target.value)}
                    className="w-full"
                  >
                    <option value="">-- No Relationship Manager Assigned --</option>
                    {eligibleRms.map((rm) => (
                      <option key={rm.id} value={rm.id}>
                        {rm.name} ({rm.id}) — Supervises {rm.supervisedTeamCount} team{rm.supervisedTeamCount === 1 ? '' : 's'}
                      </option>
                    ))}
                  </Select>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Changing the Relationship Manager synchronizes the reporting superior for all active callers on this team.
                  </p>
                </div>
              </CardContent>
              <div className="flex items-center justify-end gap-2 border-t px-5 py-3 bg-slate-50/50">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingTeam(null)}
                  disabled={editLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  id="sa-submit-edit-team"
                  disabled={editLoading}
                  className="bg-[#113F3D] hover:bg-[#0c2e2c] text-white"
                >
                  {editLoading ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 3. View Callers Modal */}
      {/* --------------------------------------------------------------------- */}
      {viewingCallersTeam && (
        <div
          id="sa-callers-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
        >
          <Card className="w-full max-w-2xl shadow-xl border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b px-5 py-3.5">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">
                    {viewingCallersTeam.name} — Assigned Sales Callers
                  </h3>
                  <Badge className="bg-[#113F3D] text-white text-[10px]">
                    {viewingCallersTeam.callerCount} / 10 Callers
                  </Badge>
                </div>
                <p className="text-xs text-slate-500">
                  Vertical: {viewingCallersTeam.vertical} · Supervising RM: {viewingCallersTeam.relationshipManagerName || 'None'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingCallersTeam(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600"
              >
                <X className="size-4" />
              </button>
            </div>
            <CardContent className="p-0 max-h-96 overflow-y-auto">
              {viewingCallersTeam.callers.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  This team currently has no assigned Sales Callers. Staffing is in progress (target: 5–10).
                </div>
              ) : (
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-medium">
                    <tr>
                      <th className="py-2.5 px-4">Sales Caller</th>
                      <th className="py-2.5 px-4">Employee ID</th>
                      <th className="py-2.5 px-4">Email</th>
                      <th className="py-2.5 px-4">Assigned Since</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {viewingCallersTeam.callers.map((c) => (
                      <tr key={c.employeeId} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-4 font-semibold text-slate-800">
                          {c.name}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-slate-500">
                          {c.employeeId}
                        </td>
                        <td className="py-2.5 px-4 text-slate-600">
                          {c.email}
                        </td>
                        <td className="py-2.5 px-4 text-slate-400 font-mono text-[11px]">
                          {c.assignedAt ? new Date(c.assignedAt).toLocaleDateString() : 'Active'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
            <div className="flex items-center justify-between border-t px-5 py-3 bg-slate-50/50">
              <span className="text-[11px] text-slate-400">
                Staffed target: 5–10 callers per active operational team.
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setViewingCallersTeam(null)}
                >
                  Close
                </Button>
                <Button
                  size="sm"
                  disabled={viewingCallersTeam.callerCount >= 10 || viewingCallersTeam.status !== 'active'}
                  onClick={() => {
                    const target = viewingCallersTeam;
                    setViewingCallersTeam(null);
                    setAssigningTeam(target);
                  }}
                  className="bg-[#113F3D] hover:bg-[#0c2e2c] text-white"
                >
                  <Plus className="size-3 mr-1" />
                  Add / Move Caller
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 4. Add / Move Caller Modal */}
      {/* --------------------------------------------------------------------- */}
      {assigningTeam && (
        <div
          id="sa-assign-caller-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
        >
          <Card className="w-full max-w-md shadow-xl border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b px-5 py-3.5">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Add or Move Sales Caller
                </h3>
                <p className="text-xs text-slate-500">
                  Target Team: <span className="font-semibold text-slate-800">{assigningTeam.name}</span> ({assigningTeam.vertical})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAssigningTeam(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600"
              >
                <X className="size-4" />
              </button>
            </div>
            <form onSubmit={handleAssignCaller}>
              <CardContent className="p-5 space-y-3.5">
                {assignError && (
                  <div className="p-2.5 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                    {assignError}
                  </div>
                )}

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Select Eligible Sales Caller <span className="text-rose-500">*</span>
                  </label>
                  <Select
                    id="sa-caller-select"
                    value={selectedCallerId}
                    onChange={(e) => setSelectedCallerId(e.target.value)}
                    className="w-full"
                    required
                  >
                    <option value="">-- Choose Sales Caller --</option>
                    {eligibleCallers.map((c) => {
                      const isCurrent = c.currentTeamId === assigningTeam.id;
                      return (
                        <option key={c.id} value={c.id} disabled={isCurrent}>
                          {c.name} ({c.id}) — {isCurrent ? '(Already on this team)' : c.currentTeamName ? `Currently on ${c.currentTeamName}` : 'Unassigned'}
                        </option>
                      );
                    })}
                  </Select>
                </div>

                {/* Institutional Handoff Notice if Moving */}
                {selectedCallerObj?.currentTeamId && selectedCallerObj.currentTeamId !== assigningTeam.id && (
                  <div className="p-3 rounded-md bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold text-amber-800">
                      <AlertTriangle className="size-3.5 shrink-0 text-amber-600" />
                      <span>Institutional Lead Handoff Rule</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-amber-700">
                      Caller <span className="font-semibold">{selectedCallerObj.name}</span> is currently on{' '}
                      <span className="font-semibold">{selectedCallerObj.currentTeamName}</span>. Moving this caller will terminate their prior team assignment today and automatically redistribute unaccepted open leads to remaining same-team callers or place them in supervised holding.
                    </p>
                  </div>
                )}

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Reason / Rationale (Optional)
                  </label>
                  <Input
                    id="sa-assign-reason-input"
                    placeholder="e.g. Q4 capacity expansion, rebalancing"
                    value={assignReason}
                    onChange={(e) => setAssignReason(e.target.value)}
                  />
                </div>
              </CardContent>
              <div className="flex items-center justify-end gap-2 border-t px-5 py-3 bg-slate-50/50">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAssigningTeam(null)}
                  disabled={assignLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  id="sa-submit-assign-caller"
                  disabled={assignLoading || !selectedCallerId}
                  className="bg-[#113F3D] hover:bg-[#0c2e2c] text-white"
                >
                  {assignLoading ? 'Assigning...' : 'Assign to Team'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// HR Requests & Employee Credential Provisioning Section
// =============================================================================
export function SuperadminHrRequestsSection({
  standalone = false,
  controlledVertical,
}: {
  standalone?: boolean;
  controlledVertical?: string;
}) {
  const [statusTab, setStatusTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [typeFilter, setTypeFilter] = useState<'all' | 'new_account' | 'team_transfer' | 'exit'>('all');
  const [requests, setRequests] = useState<SaHrRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Review & Approve Modal
  const [reviewingReq, setReviewingReq] = useState<SaHrRequestItem | null>(null);
  const [confirmRole, setConfirmRole] = useState<'SC' | 'REL' | 'MG' | 'RM' | 'NM' | 'DE' | 'HR' | 'SA'>('SC');
  const [confirmVertical, setConfirmVertical] = useState<'wealth' | 'banking' | 'markets' | 'real_estate'>('wealth');
  const [confirmTeamId, setConfirmTeamId] = useState('');
  const [confirmSuperiorId, setConfirmSuperiorId] = useState('');
  const [manualUsername, setManualUsername] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [decisionNotes, setDecisionNotes] = useState('');
  const [handoffQueue, setHandoffQueue] = useState(true);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  // Reject Modal
  const [rejectingReq, setRejectingReq] = useState<SaHrRequestItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectSubmitting, setRejectSubmitting] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);

  // Reset open modals when controlledVertical changes so no stale modal data persists
  useEffect(() => {
    setReviewingReq(null);
    setRejectingReq(null);
  }, [controlledVertical]);

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);
      const data = await superadminApi.listHrRequests(undefined, controlledVertical);
      setRequests(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [controlledVertical]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const isPendingStatus = (s: string) =>
    s === 'submitted' || s === 'approved' || s === 'pending_approval' || s === 'approved_by_rm';

  const pendingCount = requests.filter((r) => isPendingStatus(r.status as string)).length;
  const approvedCount = requests.filter((r) => r.status === 'activated_by_admin').length;
  const rejectedCount = requests.filter((r) => r.status === 'rejected' || r.status === 'returned').length;

  const filteredRequests = requests.filter((r) => {
    if (controlledVertical && controlledVertical !== 'all') {
      const normControlled = controlledVertical === 'real-estate' ? 'real_estate' : controlledVertical;
      const reqVert = r.targetVertical
        ? (r.targetVertical === 'real-estate' ? 'real_estate' : r.targetVertical)
        : (r.currentVertical === 'real-estate' ? 'real_estate' : r.currentVertical);
      if (reqVert && reqVert !== normControlled) return false;
    }

    if (statusTab === 'pending') {
      if (!isPendingStatus(r.status as string)) return false;
    } else if (statusTab === 'approved') {
      if (r.status !== 'activated_by_admin') return false;
    } else if (statusTab === 'rejected') {
      if (r.status !== 'rejected' && r.status !== 'returned') return false;
    }

    if (typeFilter !== 'all') {
      if (typeFilter === 'team_transfer') {
        if (r.requestType !== 'team_transfer' && (r as any).requestType !== 'promotion') return false;
      } else if (r.requestType !== typeFilter) {
        return false;
      }
    }
    return true;
  });

  const openReviewModal = (r: SaHrRequestItem) => {
    setReviewingReq(r);
    setReviewError(null);
    setDecisionNotes('');
    setManualUsername('');
    setTempPassword('');
    setShowPassword(false);
    setHandoffQueue(true);

    if (r.requestType === 'new_account') {
      const vert = (r.targetVertical === 'real-estate' ? 'real_estate' : r.targetVertical || 'wealth') as any;
      setConfirmVertical(vert);
      setConfirmRole((r.targetRole as any) || 'SC');
      const teams = TEAMS_BY_VERT[vert] || [];
      setConfirmTeamId(r.targetTeamId || teams[0]?.id || '');
      const mgrs = MANAGERS_BY_VERT[vert] || [];
      setConfirmSuperiorId(r.supervisorEmployeeId || mgrs[0]?.id || '');
    }
  };

  const handleVerticalChange = (vert: any) => {
    setConfirmVertical(vert);
    const teams = TEAMS_BY_VERT[vert] || [];
    setConfirmTeamId(teams[0]?.id || '');
    const mgrs = MANAGERS_BY_VERT[vert] || [];
    setConfirmSuperiorId(mgrs[0]?.id || '');
  };

  const handleApproveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingReq) return;
    setReviewSubmitting(true);
    setReviewError(null);

    try {
      if (reviewingReq.requestType === 'new_account') {
        if (!manualUsername.trim() || manualUsername.trim().length < 3) {
          setReviewError('Login username must be at least 3 characters.');
          setReviewSubmitting(false);
          return;
        }
        if (!tempPassword || tempPassword.length < 8) {
          setReviewError('Temporary password must be at least 8 characters.');
          setReviewSubmitting(false);
          return;
        }

        const res = await superadminApi.approveOnboarding({
          requestId: reviewingReq.id,
          role: confirmRole,
          vertical: confirmVertical,
          teamId: confirmTeamId,
          reportingManagerId: confirmSuperiorId || undefined,
          username: manualUsername.trim(),
          temporaryPassword: tempPassword,
        });

        setMessage({
          type: 'success',
          text: `Account activated for ${res.employeeId}. Username: ${res.username}. Temporary password provisioned.`,
        });
      } else if (reviewingReq.requestType === 'team_transfer' || (reviewingReq as any).requestType === 'promotion') {
        await superadminApi.approveLifecycleChange(reviewingReq.id, decisionNotes.trim() || undefined);
        setMessage({
          type: 'success',
          text: `Role/team change request ${reviewingReq.id} approved and effective assignment activated.`,
        });
      } else if (reviewingReq.requestType === 'exit') {
        await superadminApi.approveExit(reviewingReq.id, decisionNotes.trim() || undefined, handoffQueue);
        setMessage({
          type: 'success',
          text: `Exit request ${reviewingReq.id} approved. Employee disabled and access revoked.`,
        });
      }

      setReviewingReq(null);
      await loadRequests();
    } catch (err: any) {
      setReviewError(err?.message || 'Failed to approve request.');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const openRejectModal = (r: SaHrRequestItem) => {
    setRejectingReq(r);
    setRejectionReason('');
    setRejectError(null);
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingReq) return;
    if (!rejectionReason.trim() || rejectionReason.trim().length < 3) {
      setRejectError('Rejection reason must be at least 3 characters.');
      return;
    }

    setRejectSubmitting(true);
    setRejectError(null);

    try {
      await superadminApi.rejectHrRequest(rejectingReq.id, rejectionReason.trim());
      setMessage({
        type: 'success',
        text: `Request ${rejectingReq.id} (${rejectingReq.requestType}) rejected. Access denied.`,
      });
      setRejectingReq(null);
      await loadRequests();
    } catch (err: any) {
      setRejectError(err?.message || 'Failed to reject request.');
    } finally {
      setRejectSubmitting(false);
    }
  };

  return (
    <section id="sa-hr-requests-section" className="space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-[#113F3D]" />
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              HR Requests & Access Governance
            </h2>
            <Badge className="bg-emerald-50 text-emerald-800 border-emerald-300 text-[11px] font-mono">
              Action Deck P044..P312
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Review joiner, transfer, and offboarding requests submitted by HR. Manually choose unique login usernames and temporary passwords upon activation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadRequests}
            disabled={loading}
            className="text-xs h-8 gap-1.5"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {message && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center justify-between gap-2 ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === 'success' ? (
              <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="size-4 text-rose-600 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setMessage(null)}
            className="text-slate-400 hover:text-slate-600 text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* Tabs & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
          <button
            id="sa-hr-tab-pending"
            type="button"
            onClick={() => setStatusTab('pending')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${
              statusTab === 'pending'
                ? 'bg-[#113F3D] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="size-3.5" />
            <span>Pending Requests</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                statusTab === 'pending'
                  ? 'bg-emerald-500/20 text-emerald-100'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {pendingCount}
            </span>
          </button>

          <button
            id="sa-hr-tab-approved"
            type="button"
            onClick={() => setStatusTab('approved')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${
              statusTab === 'approved'
                ? 'bg-[#113F3D] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CheckCircle2 className="size-3.5" />
            <span>Approved Requests</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                statusTab === 'approved'
                  ? 'bg-emerald-500/20 text-emerald-100'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {approvedCount}
            </span>
          </button>

          <button
            id="sa-hr-tab-rejected"
            type="button"
            onClick={() => setStatusTab('rejected')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${
              statusTab === 'rejected'
                ? 'bg-[#113F3D] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <X className="size-3.5" />
            <span>Rejected Requests</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                statusTab === 'rejected'
                  ? 'bg-rose-500/20 text-rose-100'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {rejectedCount}
            </span>
          </button>
        </div>

        {/* Type Filter */}
        <div className="flex items-center gap-1 text-xs">
          <span className="text-slate-500 text-[11px] font-medium mr-1">Type:</span>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="text-xs bg-white border border-slate-200 rounded-md px-2.5 py-1 text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-600"
          >
            <option value="all">All Request Types</option>
            <option value="new_account">New Employee (Joiner)</option>
            <option value="team_transfer">Role/Team/Vertical Change</option>
            <option value="exit">Employee Exit (Leaver)</option>
          </select>
        </div>
      </div>

      {/* Requests List */}
      <div id="sa-hr-requests-list" className="space-y-3">
        {loading ? (
          <div className="p-6">
            <SkeletonRows rows={4} />
          </div>
        ) : filteredRequests.length === 0 ? (
          <Card className="p-8 text-center border-dashed border-slate-200 bg-slate-50/50">
            <div className="size-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400 mb-2">
              <FileText className="size-5" />
            </div>
            <div className="text-sm font-semibold text-slate-800">No {statusTab} HR requests found</div>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {statusTab === 'pending'
                ? 'When HR submits new employee joiners, role transfers, or employee exits, they will appear here for review and provisioning.'
                : `There are currently no ${statusTab} HR requests under the selected filter.`}
            </p>
          </Card>
        ) : (
          filteredRequests.map((req) => {
            const isJoiner = req.requestType === 'new_account';
            const isMover = req.requestType === 'team_transfer' || (req as any).requestType === 'promotion';
            const isLeaver = req.requestType === 'exit';

            return (
              <Card
                key={req.id}
                id={`sa-hr-request-card-${req.id}`}
                className="p-4 border-slate-200 shadow-xs hover:border-slate-300 transition bg-white"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left Column: Metadata & Identity */}
                  <div className="space-y-2 min-w-[280px]">
                    <div className="flex items-center gap-2">
                      {isJoiner && (
                        <Badge className="bg-emerald-50 text-emerald-800 border-emerald-300 text-[10px] gap-1 font-semibold">
                          <UserPlus className="size-3" /> New Employee
                        </Badge>
                      )}
                      {isMover && (
                        <Badge className="bg-indigo-50 text-indigo-800 border-indigo-300 text-[10px] gap-1 font-semibold">
                          <ArrowRightLeft className="size-3" /> Role/Team Change
                        </Badge>
                      )}
                      {isLeaver && (
                        <Badge className="bg-rose-50 text-rose-800 border-rose-300 text-[10px] gap-1 font-semibold">
                          <UserMinus className="size-3" /> Employee Exit
                        </Badge>
                      )}
                      <span className="text-[11px] font-mono text-slate-400">{req.id}</span>
                    </div>

                    <div>
                      <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <span>{req.employeeName}</span>
                        <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                          {req.employeeId}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">
                        {req.employeeEmail || 'No corporate email assigned yet'}
                        {req.primaryMobile && ` · 📱 ${req.primaryMobile}`}
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-400">
                      Submitted: {new Date(req.createdAt).toLocaleDateString()} by{' '}
                      <span className="font-medium text-slate-600">{req.createdByName || 'HR Manager'}</span>
                    </div>
                  </div>

                  {/* Middle Column: Details Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 flex-1 bg-slate-50/70 p-3 rounded-lg border border-slate-100 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                        {isLeaver ? 'Last Working Date' : 'Target Role & Scope'}
                      </span>
                      <span className="font-semibold text-slate-800">
                        {isLeaver
                          ? `${req.effectiveDate} (${req.effectiveTime || '18:00 IST'})`
                          : `${req.targetRole} · ${req.targetVertical}`}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                        {isLeaver ? 'Exit Approvals' : 'Target Placement'}
                      </span>
                      <span className="font-semibold text-slate-800">
                        {isLeaver
                          ? req.approvalsSummary
                          : `${req.targetTeamName || req.targetTeamId || 'Unassigned'} ${
                              req.supervisorName ? `(RM: ${req.supervisorName})` : ''
                            }`}
                      </span>
                    </div>

                    <div className="sm:col-span-2 md:col-span-1">
                      <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                        {isLeaver ? 'Handoff Plan' : 'HR Justification / Approvals'}
                      </span>
                      <span className="text-slate-600 truncate block max-w-xs" title={req.approvalsSummary || req.handoffPlan || '—'}>
                        {isLeaver
                          ? req.handoffPlan || 'Workload returned to supervised queue'
                          : req.approvalsSummary || req.oldWorkloadTreatment || 'Submitted by HR'}
                      </span>
                    </div>

                    {/* Status Banners inside card */}
                    {req.status === 'activated_by_admin' && (
                      <div className="sm:col-span-2 md:col-span-3 pt-1 border-t border-slate-200/60 flex items-center gap-2 text-emerald-800 font-medium">
                        <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                        <span>
                          Activated by Super Admin · Linked Login Username:{' '}
                          <span className="font-mono font-bold">{req.currentUsername || req.employeeId}</span>
                          {req.adminDecisionNotes && ` · Notes: ${req.adminDecisionNotes}`}
                        </span>
                      </div>
                    )}

                    {(req.status === 'rejected' || req.status === 'returned') && (
                      <div className="sm:col-span-2 md:col-span-3 pt-1 border-t border-slate-200/60 flex items-center gap-2 text-rose-800 font-medium">
                        <X className="size-3.5 text-rose-600 shrink-0" />
                        <span>
                          Rejected by Super Admin: {req.adminDecisionNotes || 'Proposal not approved.'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Actions */}
                  {statusTab === 'pending' && (
                    <div className="flex sm:flex-col items-center justify-end gap-2 shrink-0">
                      <Button
                        id={`sa-review-approve-btn-${req.id}`}
                        size="sm"
                        onClick={() => openReviewModal(req)}
                        className="bg-[#113F3D] hover:bg-[#0c2e2c] text-white text-xs h-8 px-3 font-semibold w-full sm:w-auto"
                      >
                        Review & Approve
                      </Button>
                      <Button
                        id={`sa-reject-btn-${req.id}`}
                        variant="outline"
                        size="sm"
                        onClick={() => openRejectModal(req)}
                        className="text-xs h-8 px-3 text-rose-600 border-rose-200 hover:bg-rose-50 w-full sm:w-auto"
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Review & Approve Modal */}
      {reviewingReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <Card className="w-full max-w-lg shadow-2xl border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {reviewingReq.requestType === 'new_account'
                    ? 'Review & Provision Employee Credentials'
                    : reviewingReq.requestType === 'exit'
                    ? 'Review & Finalize Employee Exit'
                    : 'Review & Activate Role/Team Change'}
                </h3>
                <p className="text-xs text-slate-500">
                  {reviewingReq.requestType === 'new_account'
                    ? 'Set unique login username and temporary password. Employee ID remains immutable.'
                    : 'Verify proposal details and apply approved organizational transition.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReviewingReq(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleApproveSubmit}>
              <CardContent className="p-6 space-y-4">
                {/* Employee Info Header */}
                <div className="rounded-md bg-slate-50 p-3 border border-slate-200 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-sm">{reviewingReq.employeeName}</span>
                    <span className="font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold text-xs">
                      {reviewingReq.employeeId} (Immutable ID)
                    </span>
                  </div>
                  <div className="text-slate-500 font-mono text-[11px]">
                    {reviewingReq.employeeEmail || 'No corporate email assigned yet'}
                    {reviewingReq.primaryMobile && ` · 📱 ${reviewingReq.primaryMobile}`}
                  </div>
                </div>

                {reviewError && (
                  <div className="p-3 text-xs rounded border border-rose-200 bg-rose-50 text-rose-800 font-medium">
                    {reviewError}
                  </div>
                )}

                {/* Specific Fields: New Employee */}
                {reviewingReq.requestType === 'new_account' && (
                  <div className="space-y-3.5">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">Assigned Role</label>
                        <Select
                          value={confirmRole}
                          onChange={(e) => setConfirmRole(e.target.value as any)}
                          className="w-full"
                        >
                          <option value="SC">Sales Caller (SC)</option>
                          <option value="REL">Relationship Manager (REL)</option>
                          <option value="MG">Branch/Wealth Manager (MG)</option>
                          <option value="RM">Regional Manager (RM)</option>
                          <option value="NM">National Manager (NM)</option>
                          <option value="DE">Data Entry (DE)</option>
                          <option value="HR">Human Resources (HR)</option>
                          <option value="SA">Super Admin (SA)</option>
                        </Select>
                      </div>

                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">Target Vertical</label>
                        <Select
                          value={confirmVertical}
                          onChange={(e) => handleVerticalChange(e.target.value)}
                          className="w-full"
                        >
                          <option value="wealth">Wealth Management</option>
                          <option value="banking">Corporate Banking</option>
                          <option value="markets">Trading & Markets</option>
                          <option value="real_estate">Real Estate</option>
                        </Select>
                      </div>

                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">Team Placement</label>
                        <Select
                          value={confirmTeamId}
                          onChange={(e) => setConfirmTeamId(e.target.value)}
                          className="w-full"
                        >
                          {(TEAMS_BY_VERT[confirmVertical] || []).map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </Select>
                      </div>

                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">Reporting Superior</label>
                        <Select
                          value={confirmSuperiorId}
                          onChange={(e) => setConfirmSuperiorId(e.target.value)}
                          className="w-full"
                        >
                          <option value="">None / Not Applicable</option>
                          {(MANAGERS_BY_VERT[confirmVertical] || []).map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </Select>
                      </div>
                    </div>

                    {/* Manual Unique Login Username */}
                    <div className="pt-2 border-t border-slate-100">
                      <label htmlFor="sa-approve-username" className="text-xs font-bold text-slate-900 block mb-1">
                        Unique Login Username <span className="text-emerald-700 font-semibold">(Manually Chosen by SA)</span>
                      </label>
                      <Input
                        id="sa-approve-username"
                        value={manualUsername}
                        onChange={(e) => setManualUsername(e.target.value)}
                        placeholder="e.g. ananya.sharma"
                        className="font-mono text-xs"
                        required
                      />
                      <p className="text-[11px] text-slate-500 mt-1">
                        Permanently linked to {reviewingReq.employeeId}. Used by the employee to sign in.
                      </p>
                    </div>

                    {/* Temporary Password */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label htmlFor="sa-approve-password" className="text-xs font-bold text-slate-900">
                          One-Time Temporary Password
                        </label>
                        <button
                          id="sa-toggle-temp-password"
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1"
                        >
                          {showPassword ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                          <span>{showPassword ? 'Hide' : 'Show'}</span>
                        </button>
                      </div>
                      <Input
                        id="sa-approve-password"
                        type={showPassword ? 'text' : 'password'}
                        value={tempPassword}
                        onChange={(e) => setTempPassword(e.target.value)}
                        placeholder="Minimum 8 characters"
                        className="font-mono text-xs"
                        required
                      />
                      <p className="text-[11px] text-slate-500 mt-1">
                        Stored as a secure hash; never stored or logged in plaintext. Employee will be forced to change this at first login.
                      </p>
                    </div>
                  </div>
                )}

                {/* Specific Fields: Role/Team Change */}
                {(reviewingReq.requestType === 'team_transfer' || (reviewingReq as any).requestType === 'promotion') && (
                  <div className="space-y-3 text-xs">
                    <div className="p-3 rounded bg-indigo-50/70 border border-indigo-200 text-indigo-900">
                      <div className="font-semibold">Proposed Transition Details:</div>
                      <div className="mt-1">
                        New Role: <span className="font-bold">{reviewingReq.targetRole}</span> · Vertical:{' '}
                        <span className="font-bold">{reviewingReq.targetVertical}</span> · Team:{' '}
                        <span className="font-bold">{reviewingReq.targetTeamName || reviewingReq.targetTeamId}</span>
                      </div>
                      <div className="text-[11px] text-indigo-700 mt-1">
                        Effective Date: {reviewingReq.effectiveDate} · Lead handoff: Leads automatically redistributed.
                      </div>
                    </div>

                    <div>
                      <label htmlFor="sa-approve-notes-input" className="font-semibold text-slate-700 block mb-1">
                        Admin Approval & Authorization Notes
                      </label>
                      <Textarea
                        id="sa-approve-notes-input"
                        value={decisionNotes}
                        onChange={(e) => setDecisionNotes(e.target.value)}
                        placeholder="Enter decision rationale or audit reference..."
                        rows={2}
                      />
                    </div>
                  </div>
                )}

                {/* Specific Fields: Employee Exit */}
                {reviewingReq.requestType === 'exit' && (
                  <div className="space-y-3 text-xs">
                    <div className="p-3 rounded bg-rose-50 border border-rose-200 text-rose-900">
                      <div className="font-bold flex items-center gap-1.5">
                        <AlertTriangle className="size-4 text-rose-600" />
                        Account Deactivation & Workload Return
                      </div>
                      <p className="mt-1 text-[11px] text-rose-800">
                        Finalizing this exit disables employee login immediately, closes active assignments, revokes all active sessions, and safely preserves lead-handoff audit history.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        id="sa-handoff-queue-check"
                        checked={handoffQueue}
                        onChange={(e) => setHandoffQueue(e.target.checked)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <label htmlFor="sa-handoff-queue-check" className="text-xs text-slate-700 font-medium">
                        Move open leads and tasks into supervised holding queues
                      </label>
                    </div>

                    <div>
                      <label htmlFor="sa-exit-notes-input" className="font-semibold text-slate-700 block mb-1">
                        Admin Decision Notes
                      </label>
                      <Textarea
                        id="sa-exit-notes-input"
                        value={decisionNotes}
                        onChange={(e) => setDecisionNotes(e.target.value)}
                        placeholder="e.g. Exit clearance completed, equipment returned, access revoked."
                        rows={2}
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-3 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setReviewingReq(null)}
                    disabled={reviewSubmitting}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    id={
                      reviewingReq.requestType === 'new_account'
                        ? 'sa-confirm-approve-btn'
                        : reviewingReq.requestType === 'exit'
                        ? 'sa-confirm-exit-btn'
                        : 'sa-confirm-lifecycle-btn'
                    }
                    type="submit"
                    size="sm"
                    disabled={reviewSubmitting}
                    className={`text-xs ${
                      reviewingReq.requestType === 'exit'
                        ? 'bg-rose-700 hover:bg-rose-800 text-white'
                        : 'bg-[#113F3D] hover:bg-[#0c2e2c] text-white'
                    }`}
                  >
                    {reviewSubmitting
                      ? 'Processing…'
                      : reviewingReq.requestType === 'new_account'
                      ? 'Approve & Activate Account'
                      : reviewingReq.requestType === 'exit'
                      ? 'Approve & Revoke Access'
                      : 'Approve & Apply Transition'}
                  </Button>
                </div>
              </CardContent>
            </form>
          </Card>
        </div>
      )}

      {/* Reject Modal */}
      {rejectingReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <Card className="w-full max-w-md shadow-2xl border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Reject HR Request</h3>
                <p className="text-xs text-slate-500">Provide an auditable reason for rejecting this request.</p>
              </div>
              <button
                type="button"
                onClick={() => setRejectingReq(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleRejectSubmit}>
              <CardContent className="p-6 space-y-4">
                <div className="rounded-md bg-slate-50 p-3 border border-slate-200 text-xs">
                  <div className="font-semibold text-slate-800">
                    {rejectingReq.employeeName} ({rejectingReq.employeeId})
                  </div>
                  <div className="text-slate-500 font-mono text-[11px] mt-0.5">
                    Request ID: {rejectingReq.id} · Type: {rejectingReq.requestType}
                  </div>
                </div>

                {rejectError && (
                  <div className="p-3 text-xs rounded border border-rose-200 bg-rose-50 text-rose-800 font-medium">
                    {rejectError}
                  </div>
                )}

                <div>
                  <label htmlFor="sa-reject-reason-input" className="text-xs font-semibold text-slate-700 block mb-1">
                    Mandatory Rejection Reason
                  </label>
                  <Textarea
                    id="sa-reject-reason-input"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="e.g. Identity check inconclusive, mismatched placement, or cancelled by department head..."
                    rows={3}
                    required
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    This reason will be visible to HR and logged in the immutable audit trail.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setRejectingReq(null)}
                    disabled={rejectSubmitting}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    id="sa-confirm-reject-btn"
                    type="submit"
                    size="sm"
                    disabled={rejectSubmitting}
                    className="bg-rose-700 hover:bg-rose-800 text-white text-xs"
                  >
                    {rejectSubmitting ? 'Rejecting…' : 'Confirm Rejection'}
                  </Button>
                </div>
              </CardContent>
            </form>
          </Card>
        </div>
      )}
    </section>
  );
}

export function SuperadminTeamsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <div className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
          WORKSPACE / SUPER ADMIN
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-display mt-1">
          Teams & Frontline Capacity Governance
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Supervise dynamic operational teams across Wealth, Banking, Markets, and Real Estate. Assign Relationship Managers and allocate Sales Callers with automated lead redistribution.
        </p>
      </div>
      <SuperadminTeamsSection standalone={true} />
    </div>
  );
}

// =============================================================================
// 1. Superadmin Overview Page
// =============================================================================
export function SuperadminOverviewPage() {
  const { session } = useSession();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Derive available verticals dynamically from session.verticalGrants
  const availableVerticals = getAvailableVerticals(session?.verticalGrants);

  const [selectedVertical, setSelectedVertical] = useState<CanonicalVertical>(
    availableVerticals[0] || 'wealth'
  );

  useEffect(() => {
    superadminApi
      .getOverview()
      .then(setData)
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="p-8">
        <SkeletonRows rows={6} />
      </div>
    );

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">
      {/* Overview Banner */}
      <div className="border-b border-slate-200 pb-4">
        <div className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
          WORKSPACE / SUPER ADMIN
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-display mt-1">
          Identity, Scopes & Administrative Governance
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          System provisioning health, cycle-free hierarchy, and cross-vertical access controls.
        </p>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 border-slate-200 shadow-sm bg-white">
          <div className="text-xs text-slate-500 font-medium">Total Employees</div>
          <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">{data?.totalEmployees ?? 0}</div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">Directory active</div>
        </Card>
        <Card className="p-4 border-slate-200 shadow-sm bg-white">
          <div className="text-xs text-slate-500 font-medium">Active Assignments</div>
          <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">{data?.activeAssignments ?? 0}</div>
          <div className="text-[11px] text-slate-500 mt-1">Role/scope partitioned</div>
        </Card>
        <Card className="p-4 border-slate-200 shadow-sm bg-white">
          <div className="text-xs text-slate-500 font-medium">Pending Lifecycle Moves</div>
          <div className="text-2xl font-bold text-amber-600 mt-1 font-mono">{data?.pendingTransfers ?? 0}</div>
          <div className="text-[11px] text-slate-500 mt-1">Awaiting activation</div>
        </Card>
        <Card className="p-4 border-slate-200 shadow-sm bg-white">
          <div className="text-xs text-slate-500 font-medium">Active Audit Incidents</div>
          <div className="text-2xl font-bold text-rose-600 mt-1 font-mono">{data?.activeIncidents ?? 0}</div>
          <div className="text-[11px] text-slate-500 mt-1">Restricted review queue</div>
        </Card>
      </div>

      {/* Quick Modules Directory */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold tracking-wider text-slate-700 uppercase">
          Administrative Modules
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <a
            href="/superadmin/employees"
            className="p-4 rounded-lg border border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm transition block space-y-1"
          >
            <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
              <Users className="w-4 h-4 text-emerald-700" />
              Employees & Users
            </div>
            <div className="text-xs text-slate-500">SA-01 Account Provisioning · SA-07 Account Recovery</div>
          </a>

          <a
            href="/superadmin/scopes"
            className="p-4 rounded-lg border border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm transition block space-y-1"
          >
            <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              Roles & Scopes
            </div>
            <div className="text-xs text-slate-500">SA-02 Organisation Scope · SA-03 Additional Teams · SA-11 Delegations</div>
          </a>

          <a
            href="/superadmin/organisation"
            className="p-4 rounded-lg border border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm transition block space-y-1"
          >
            <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
              <Building className="w-4 h-4 text-emerald-700" />
              Organisation Hierarchy
            </div>
            <div className="text-xs text-slate-500">SA-04 Cycle-free Reporting Hierarchy & Edges</div>
          </a>

          <a
            href="/superadmin/lifecycle"
            className="p-4 rounded-lg border border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm transition block space-y-1"
          >
            <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
              <ArrowRight className="w-4 h-4 text-emerald-700" />
              Lifecycle Changes
            </div>
            <div className="text-xs text-slate-500">SA-05 Transfers & Promotions · SA-06 Offboarding & Holding</div>
          </a>

          <a
            href="/superadmin/configuration"
            className="p-4 rounded-lg border border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm transition block space-y-1"
          >
            <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
              <FileText className="w-4 h-4 text-emerald-700" />
              Business Configuration
            </div>
            <div className="text-xs text-slate-500">SA-08 Versioned Rules, SLAs & Routing Calendars</div>
          </a>

          <a
            href="/superadmin/audit"
            className="p-4 rounded-lg border border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm transition block space-y-1"
          >
            <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
              <Lock className="w-4 h-4 text-emerald-700" />
              Audit & Incidents
            </div>
            <div className="text-xs text-slate-500">SA-09 Restricted Audit Logs & Anomaly Actions</div>
          </a>

          <a
            href="/superadmin/health"
            className="p-4 rounded-lg border border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm transition block space-y-1"
          >
            <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
              <Database className="w-4 h-4 text-emerald-700" />
              System Health
            </div>
            <div className="text-xs text-slate-500">SA-10 Bounded Job Retries & DeadLetter Queues</div>
          </a>

          <a
            href="/superadmin/teams"
            className="p-4 rounded-lg border border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm transition block space-y-1"
          >
            <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
              <Users className="w-4 h-4 text-emerald-700" />
              Teams & Frontline
            </div>
            <div className="text-xs text-slate-500">Dynamic Teams · Relationship Manager Supervision · Caller Staffing</div>
          </a>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* Canonical "Ready and review" / "Ready for review" Primary Work Area   */}
      {/* ===================================================================== */}
      <Card className="border-slate-200 shadow-sm bg-white overflow-hidden" id="sa-review-work-area">
        {/* Card Status Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-100 bg-slate-50/50 text-xs">
          <div className="flex items-center gap-2 font-medium text-slate-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold text-slate-900">Ready and review</span>
            <span className="text-slate-400">·</span>
            <span className="text-slate-600">Ready for review</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-emerald-50 text-emerald-800 border-emerald-300 font-mono text-[10px]">
              Active Scope: {selectedVertical.toUpperCase()}
            </Badge>
            <span className="text-slate-400 text-[11px]">Updated 09:42 IST</span>
          </div>
        </div>

        {/* Inner Card Content */}
        <CardContent className="p-6 space-y-6">
          {/* Header Row & Master Vertical Selector */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <div className="text-xs font-semibold tracking-wider text-slate-400 uppercase mb-1">
                WORK AREA
              </div>
              <h2 className="text-lg font-bold text-slate-900">
                Frontline Teams, Relationship Managers & HR Governance Review
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Switch vertical to review designated teams, supervising Relationship Managers, Sales Callers, and pending HR lifecycle requests.
              </p>
            </div>

            {/* Master Vertical Selector */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2" id="sa-work-area-vertical-selector">
              <span className="text-xs font-semibold text-slate-600 shrink-0">Vertical:</span>

              {/* Visual Pill Buttons for each vertical grant */}
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200/80">
                {availableVerticals.map((v) => {
                  const isActive = selectedVertical === v;
                  return (
                    <button
                      key={v}
                      type="button"
                      id={`sa-vertical-tab-${v}`}
                      onClick={() => setSelectedVertical(v)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                        isActive
                          ? 'bg-[#113F3D] text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                      }`}
                    >
                      {VERTICAL_SHORT_LABELS[v]}
                    </button>
                  );
                })}
              </div>

              {/* Native Select element with accessible id */}
              <select
                id="sa-work-area-vertical-select"
                aria-label="Select Work Area Vertical"
                value={selectedVertical}
                onChange={(e) => setSelectedVertical(e.target.value as CanonicalVertical)}
                className="text-xs font-semibold border border-slate-200 rounded-md px-2.5 py-1.5 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              >
                {availableVerticals.map((v) => (
                  <option key={v} value={v}>
                    {VERTICAL_LABELS[v]} ({VERTICAL_SHORT_LABELS[v]})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Active Vertical Banner */}
          <div className="flex items-center justify-between p-3.5 rounded-lg bg-slate-50 border border-slate-200/80 text-xs">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="size-4 text-[#113F3D] shrink-0" />
              <div>
                <span className="text-slate-500 font-medium">Currently Selected Work Area: </span>
                <span className="font-bold text-slate-900">{VERTICAL_LABELS[selectedVertical]}</span>
                <span className="text-slate-400 font-mono ml-1.5">({selectedVertical})</span>
              </div>
            </div>
            <div className="text-[11px] text-slate-500">
              Zero cross-vertical leakage · Independent partition
            </div>
          </div>

          {/* Keyed Child Container ensuring immediate unmount and zero stale data between vertical switches */}
          <div key={selectedVertical} className="space-y-8" id={`sa-vertical-content-${selectedVertical}`}>
            <SuperadminTeamsSection controlledVertical={selectedVertical} standalone={true} />
            <SuperadminHrRequestsSection controlledVertical={selectedVertical} standalone={true} />
          </div>
        </CardContent>
      </Card>

      {/* Recent System Audit Ledger */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold tracking-wider text-slate-700 uppercase">
          Recent Audit Ledger (Immutable)
        </h2>
        <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50/70 border-b border-slate-200/80 text-slate-500 font-medium">
                <tr>
                  <th className="py-2.5 px-4">Timestamp</th>
                  <th className="py-2.5 px-4">Action</th>
                  <th className="py-2.5 px-4">Actor</th>
                  <th className="py-2.5 px-4">Target Entity</th>
                  <th className="py-2.5 px-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {data?.recentAuditLogs?.length ? (
                  data.recentAuditLogs.map((log: any) => (
                    <tr key={log.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-4 text-slate-500">
                        {new Date(log.occurred_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-2.5 px-4 font-sans font-semibold text-slate-800">{log.action}</td>
                      <td className="py-2.5 px-4 font-sans text-slate-600">{log.actor_name || log.actor_employee_id || 'System'}</td>
                      <td className="py-2.5 px-4 text-slate-500">{log.entity_type}: {log.entity_id}</td>
                      <td className="py-2.5 px-4 text-slate-400 truncate max-w-xs">{JSON.stringify(log.details)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-slate-400 font-sans">
                      No system audit events recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

const TEAMS_BY_VERT: Record<string, { id: string; name: string }[]> = {
  wealth: [
    { id: 'TEAM-WEALTH-ALPHA', name: 'Wealth Alpha' },
    { id: 'TEAM-WEALTH-BETA', name: 'Wealth Beta' },
    { id: 'TEAM-WEALTH-GAMMA', name: 'Wealth Gamma' },
  ],
  banking: [
    { id: 'TEAM-BANKING-ALPHA', name: 'Banking Alpha' },
    { id: 'TEAM-BANKING-BETA', name: 'Banking Beta' },
  ],
  markets: [
    { id: 'TEAM-MARKETS-ALPHA', name: 'Markets Alpha' },
    { id: 'TEAM-MARKETS-BETA', name: 'Markets Beta' },
  ],
  real_estate: [
    { id: 'TEAM-REALESTATE-ALPHA', name: 'Real Estate Alpha (Luxury Residential)' },
    { id: 'TEAM-REALESTATE-BETA', name: 'Real Estate Beta (Commercial Mandates)' },
  ],
};

const MANAGERS_BY_VERT: Record<string, { id: string; name: string; role: string; teamId?: string }[]> = {
  wealth: [
    { id: 'EMP-003', name: 'Tara Iyer (REL · Wealth Alpha/Beta)', role: 'REL', teamId: 'TEAM-WEALTH-ALPHA' },
    { id: 'EMP-007', name: 'Neel Verma (MG · Wealth Manager)', role: 'MG', teamId: 'TEAM-WEALTH-ALPHA' },
    { id: 'EMP-008', name: 'Kavita Rao (RM · Wealth)', role: 'RM' },
  ],
  banking: [
    { id: 'EMP-016', name: 'Rohan Sen (REL · Banking Alpha)', role: 'REL', teamId: 'TEAM-BANKING-ALPHA' },
    { id: 'EMP-017', name: 'Kunal Shah (MG · Branch Manager, Banking Alpha)', role: 'MG', teamId: 'TEAM-BANKING-ALPHA' },
    { id: 'EMP-018', name: 'Priya Sen (REL · Banking Beta)', role: 'REL', teamId: 'TEAM-BANKING-BETA' },
    { id: 'EMP-019', name: 'Arjun Mehta (RM · Banking)', role: 'RM' },
  ],
  markets: [
    { id: 'EMP-005', name: 'Meera Nair (REL · Markets Alpha)', role: 'REL', teamId: 'TEAM-MARKETS-ALPHA' },
    { id: 'EMP-022', name: 'Manish Vyas (MG · Trading Manager, Markets Alpha)', role: 'MG', teamId: 'TEAM-MARKETS-ALPHA' },
    { id: 'EMP-023', name: 'Tarun Sen (REL · Markets Beta)', role: 'REL', teamId: 'TEAM-MARKETS-BETA' },
    { id: 'EMP-024', name: 'Rajesh Bansal (RM · Markets)', role: 'RM' },
  ],
  real_estate: [
    { id: 'EMP-027', name: 'Neha Gupta (REL · Real Estate Alpha)', role: 'REL', teamId: 'TEAM-REALESTATE-ALPHA' },
    { id: 'EMP-028', name: 'Vikramaditya Singhania (MG · Advisory Manager, Real Estate Alpha)', role: 'MG', teamId: 'TEAM-REALESTATE-ALPHA' },
    { id: 'EMP-032', name: 'Pooja Reddy (REL · Real Estate Beta)', role: 'REL', teamId: 'TEAM-REALESTATE-BETA' },
    { id: 'EMP-029', name: 'Siddharth Malhotra (RM · Real Estate)', role: 'RM' },
  ],
};

// =============================================================================
// 2. Employees & Users Page (HR Onboarding, SA-01 & SA-07)
// =============================================================================
export function SuperadminEmployeesPage() {
  const { session } = useSession();
  const availableVerticals = getAvailableVerticals(session?.verticalGrants);

  const [tab, setTab] = useState<'onboarding' | 'create' | 'recovery'>('onboarding');
  const [onboardings, setOnboardings] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [recoveries, setRecoveries] = useState<any[]>([]);
  const [outbox, setOutbox] = useState<any[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Approval modal state
  const [approvingReq, setApprovingReq] = useState<any | null>(null);
  const [approveRole, setApproveRole] = useState<'SC' | 'REL' | 'MG' | 'RM' | 'NM' | 'DE' | 'HR' | 'SA'>('SC');
  const [approveVertical, setApproveVertical] = useState<'wealth' | 'banking' | 'markets' | 'real_estate'>('wealth');
  const [approveTeamId, setApproveTeamId] = useState('TEAM-WEALTH-ALPHA');
  const [approveManagerId, setApproveManagerId] = useState('EMP-003');
  const [approveUsername, setApproveUsername] = useState('');
  const [approveTempPassword, setApproveTempPassword] = useState('');
  const [showApprovePassword, setShowApprovePassword] = useState(false);
  const [approveSubmitting, setApproveSubmitting] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [approveFieldErrors, setApproveFieldErrors] = useState<Record<string, string[]>>({});
  const [approvePlacementOptions, setApprovePlacementOptions] = useState<PlacementOptions | null>(null);

  // Active credentials display modal
  const [provisionedResult, setProvisionedResult] = useState<any | null>(null);
  const [copiedPass, setCopiedPass] = useState(false);

  // Reject modal state
  const [rejectingReq, setRejectingReq] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectSubmitting, setRejectSubmitting] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);

  // SA-01 Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [episode, setEpisode] = useState('Active');
  const [proposedRole, setProposedRole] = useState<'SC' | 'TL' | 'MG' | 'RM' | 'NM'>('SC');
  const [vertical, setVertical] = useState<CanonicalVertical>('wealth');
  const [teamId, setTeamId] = useState('TEAM-WEALTH-ALPHA');

  // SA-07 Form State
  const [recEmpId, setRecEmpId] = useState('EMP-001');
  const [issueType, setIssueType] = useState<'Locked account' | 'MFA recovery' | 'Credential reset'>('Locked account');
  const [procedure, setProcedure] = useState('Verified via video call and corporate badge evidence');

  const loadLists = useCallback(() => {
    Promise.all([
      superadminApi.listOnboardingRequests().catch(() => []),
      superadminApi.listInvitations().catch(() => []),
      superadminApi.listAccountRecoveries().catch(() => []),
      superadminApi.listLocalDeliveryOutbox().catch(() => []),
    ])
      .then(([onb, invs, recs, out]) => {
        setOnboardings(onb);
        setInvitations(invs);
        setRecoveries(recs);
        setOutbox(out);
      })
      .catch((err) => console.error(err));
  }, []);

  useEffect(() => {
    loadLists();
  }, [loadLists]);

  useEffect(() => {
    if (!approvingReq) return;
    let active = true;
    setApprovePlacementOptions(null);
    superadminApi.getPlacementOptions(approveVertical).then((options) => {
      if (!active) return;
      setApprovePlacementOptions(options);
      const proposedTeam = approvingReq.proposed_team_id || approvingReq.target_team_id;
      const team = options.teams.find((item) => item.id === proposedTeam) ?? options.teams[0];
      setApproveTeamId(team?.id ?? '');
      if (approveRole === 'SC') {
        setApproveManagerId(team?.relationshipManagerId ?? '');
      } else {
        const proposedSuperior = approvingReq.proposed_superior_id || approvingReq.supervisor_employee_id;
        setApproveManagerId(options.superiors.some((item) => item.id === proposedSuperior) ? proposedSuperior : '');
      }
    }).catch(() => {
      if (active) setApproveError('Could not load current teams and superiors. Refresh before approving.');
    });
    return () => { active = false; };
  }, [approvingReq, approveVertical]);

  const openApproveModal = (r: any) => {
    setApprovingReq(r);
    const vert = r.proposed_vertical || r.target_vertical || 'wealth';
    const canonicalVert = (vert === 'real-estate' ? 'real_estate' : vert) as any;
    setApproveVertical(canonicalVert);
    setApproveRole(r.proposed_role || r.target_role || 'SC');
    const teams = TEAMS_BY_VERT[canonicalVert] || [];
    setApproveTeamId(r.proposed_team_id || r.target_team_id || teams[0]?.id || '');
    const mgrs = MANAGERS_BY_VERT[canonicalVert] || [];
    setApproveManagerId(r.proposed_superior_id || r.supervisor_employee_id || mgrs[0]?.id || '');
    setApproveUsername('');
    setApproveTempPassword('');
    setShowApprovePassword(false);
    setApproveError(null);
    setApproveFieldErrors({});
  };

  const handleApproveVerticalChange = (v: any) => {
    setApproveVertical(v);
    setApproveTeamId('');
    setApproveManagerId('');
  };

  const handleApproveSubmit = async () => {
    if (!approvingReq) return;
    if (!approvePlacementOptions?.teams.some((team) => team.id === approveTeamId)) {
      setApproveError('Choose a current active team before approving.');
      return;
    }
    if (!approveUsername.trim() || approveUsername.trim().length < 3) {
      setApproveError('Login username must be at least 3 characters.');
      return;
    }
    if (!approveTempPassword || approveTempPassword.length < 8) {
      setApproveError('Temporary password must be at least 8 characters.');
      return;
    }
    setApproveSubmitting(true);
    setApproveError(null);
    setApproveFieldErrors({});
    try {
      const res = await superadminApi.approveOnboarding({
        requestId: approvingReq.request_id || approvingReq.id,
        role: approveRole,
        vertical: approveVertical,
        teamId: approveTeamId,
        reportingManagerId: approveManagerId || undefined,
        username: approveUsername.trim(),
        temporaryPassword: approveTempPassword,
      });
      setApprovingReq(null);
      setProvisionedResult(res);
      loadLists();
    } catch (err: any) {
      if (err instanceof ApiError && err.fieldErrors && Object.keys(err.fieldErrors).length > 0) {
        setApproveFieldErrors(err.fieldErrors);
        setApproveError('Correct the fields marked below, then try again.');
      } else {
        setApproveError(err?.message || 'Failed to approve onboarding.');
      }
    } finally {
      setApproveSubmitting(false);
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectingReq) return;
    if (!rejectReason.trim()) {
      setRejectError('Rejection reason is required.');
      return;
    }
    setRejectSubmitting(true);
    setRejectError(null);
    try {
      const targetReqId = rejectingReq.request_id || rejectingReq.id;
      await superadminApi.rejectOnboarding({
        requestId: targetReqId,
        rejectionReason: rejectReason.trim(),
      });
      setMessage({ type: 'success', text: `Onboarding request ${targetReqId} has been rejected.` });
      setRejectingReq(null);
      setRejectReason('');
      loadLists();
    } catch (err: any) {
      setRejectError(err?.message || 'Failed to reject request.');
    } finally {
      setRejectSubmitting(false);
    }
  };

  const handleCreateAccount = async () => {
    if (!name || !email) {
      setMessage({ type: 'error', text: 'Name and unique work email are required.' });
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await superadminApi.provisionAccount({
        employeeName: name,
        workEmail: email,
        proposedRole,
        vertical,
        teamId,
        employmentEpisode: episode as any,
        invitationExpiryHours: 48,
      });
      setMessage({
        type: 'success',
        text: `Account created for ${res.workEmail} (ID: ${res.employeeId}). Activation link token generated: ${res.rawTokenPreview}`,
      });
      setName('');
      setEmail('');
      loadLists();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Provisioning failed.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetAccess = async () => {
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await superadminApi.requestAccountRecovery({
        employeeId: recEmpId,
        issueType: issueType as any,
        identityCheckProcedure: procedure,
        revokeExistingSessions: true,
        expiryHours: 24,
      });
      setMessage({
        type: 'success',
        text: `Recovery action issued for ${res.email}. Compromised sessions revoked: ${res.sessionsRevoked}. Recovery token: ${res.recoveryTokenPreview}`,
      });
      loadLists();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Recovery issuance failed.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Subtab selection */}
      <div className="max-w-7xl mx-auto px-4 pt-4 flex flex-wrap gap-2">
        <Button
          variant={tab === 'onboarding' ? 'default' : 'outline'}
          size="sm"
          onClick={() => { setTab('onboarding'); setMessage(null); }}
          className={tab === 'onboarding' ? 'bg-[#113F3D] text-white' : ''}
        >
          <Users className="w-3.5 h-3.5 mr-1.5" />
          Pending HR Onboardings ({onboardings.filter((o) => o.status === 'submitted' || o.status === 'pending_approval' || o.status === 'pending_admin' || o.employee_status === 'pending_approval').length})
        </Button>
        <Button
          id="sa-tab-create-retired"
          variant={tab === 'create' ? 'default' : 'outline'}
          size="sm"
          onClick={() => { setTab('create'); setMessage(null); }}
          className={tab === 'create' ? 'bg-slate-800 text-white' : 'text-slate-500'}
        >
          <ShieldAlert className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
          SA-01 Direct Provisioning (Retired)
        </Button>
        <Button
          variant={tab === 'recovery' ? 'default' : 'outline'}
          size="sm"
          onClick={() => { setTab('recovery'); setMessage(null); }}
          className={tab === 'recovery' ? 'bg-[#113F3D] text-white' : ''}
        >
          <KeyRound className="w-3.5 h-3.5 mr-1.5" />
          SA-07 Reset Account Access Safely
        </Button>
      </div>

      {message && (
        <div className="max-w-7xl mx-auto px-4">
          <div className={`p-4 rounded-lg text-sm flex items-start gap-3 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-rose-600" />}
            <div>{message.text}</div>
          </div>
        </div>
      )}

      {tab === 'onboarding' ? (
        <DeckFrame
          actionCode="SA-ONBOARD"
          moduleLabel="EMPLOYEES & USERS"
          title="Review HR Onboarding Submissions & Activate Accounts"
          steps={[
            'Verify candidate personal details, verified email, and contact numbers.',
            'Review HR proposed placement (Role, Vertical, Team, Superior) and make audited corrections if necessary.',
            'Approve and provision one-time temporary password. The permanent login username is the Employee ID (EMP-xxx).',
          ]}
          whenCheckFails="Cross-vertical or unauthorized manager assignments return 422; missing fields return 400."
          permissionEvidence="Super Admin alone can provision credentials and assign scopes. Plaintext temporary password is shown only once and requires initial login change."
          submitDisabled={true}
          submitLabel="Select Action in Table Below"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                  Pending Joiner Proposals from HR
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  HR has registered these candidates and proposed placement. Review placement, apply audited corrections if required, and activate credentials.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={loadLists} className="gap-1.5 text-xs">
                <RefreshCw className="size-3" /> Refresh Queue
              </Button>
            </div>

            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[10px] border-b">
                  <tr>
                    <th className="py-2.5 px-4">Request / Employee ID</th>
                    <th className="py-2.5 px-4">Full Name</th>
                    <th className="py-2.5 px-4">Contact Details</th>
                    <th className="py-2.5 px-4">Proposed Placement</th>
                    <th className="py-2.5 px-4">Submitted</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {onboardings.length > 0 ? (
                    onboardings.map((r: any) => {
                      const isPending =
                        r.status === 'submitted' ||
                        r.status === 'pending_approval' ||
                        r.status === 'pending_admin' ||
                        r.employee_status === 'pending_approval';

                      return (
                        <tr key={r.request_id || r.id} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-4">
                            <div className="font-mono font-bold text-slate-900">{r.employee_id}</div>
                            <div className="font-mono text-[10px] text-slate-400">{r.request_id || r.id}</div>
                          </td>
                          <td className="py-2.5 px-4 font-semibold text-slate-900">{r.employee_name || r.full_name}</td>
                          <td className="py-2.5 px-4 space-y-0.5">
                            <div className="font-mono text-slate-800">{r.email || r.work_email || r.employee_email}</div>
                            <div className="text-[11px] text-slate-500">
                              📱 {r.primary_mobile || '—'} {r.whatsapp_number ? `· 💬 ${r.whatsapp_number}` : ''}
                            </div>
                          </td>
                          <td className="py-2.5 px-4 text-xs font-medium">
                            <span className="font-bold text-slate-900">{r.proposed_role || r.target_role || 'SC'}</span>
                            {' · '}
                            <span className="capitalize text-slate-700">{r.proposed_vertical || r.target_vertical || 'wealth'}</span>
                            <div className="text-[11px] text-slate-500 font-mono">
                              {r.proposed_team_name || r.proposed_team_id || r.target_team_name || r.target_team_id || '—'}
                            </div>
                            {(r.proposed_superior_name || r.supervisor_name) && (
                              <div className="text-[10px] text-slate-400">
                                Superior: {r.proposed_superior_name || r.supervisor_name}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-slate-500">
                            {r.created_at ? new Date(r.created_at).toLocaleDateString() : 'Today'}
                          </td>
                          <td className="py-2.5 px-4">
                            <Badge
                              className={`text-[10px] ${
                                r.status === 'activated_by_admin' || r.status === 'active'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                  : r.status === 'rejected'
                                  ? 'bg-rose-50 text-rose-700 border-rose-300'
                                  : 'bg-amber-50 text-amber-800 border-amber-300'
                              }`}
                            >
                              {isPending ? 'Pending Approval' : r.status?.replace('_', ' ')}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            {isPending ? (
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => openApproveModal(r)}
                                  className="h-7 text-xs bg-[#113F3D] hover:bg-[#0c2e2c] text-white"
                                >
                                  Approve & Activate
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setRejectingReq(r);
                                    setRejectReason('');
                                    setRejectError(null);
                                  }}
                                  className="h-7 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700 border-rose-200"
                                >
                                  Reject
                                </Button>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-xs italic">
                                {r.status === 'activated_by_admin' ? 'Activated' : 'Processed'}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No pending onboarding requests from HR.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </DeckFrame>
      ) : tab === 'create' ? (
        <DeckFrame
          actionCode="SA-01"
          moduleLabel="EMPLOYEES & USERS"
          title="Direct Account Provisioning (Retired Entry Point)"
          steps={[
            'HR submits verified joiner request with proposed placement via /hr/joiners.',
            'Server generates sequential, immutable employee ID (EMP-xxx) and records audit trail.',
            'Super Admin reviews placement and provisions one-time temporary password in Pending HR Onboardings.',
          ]}
          whenCheckFails="Direct account creation outside the HR joiner request pipeline is disabled per two-person segregation of duties."
          permissionEvidence="Dual control: HR proposes placement; Super Admin authorizes credentials. Direct self-activation invitation links and obsolete TL roles are retired."
          submitDisabled={true}
          submitLabel="Action Retired"
        >
          <div className="p-6 rounded-xl border border-amber-200/80 bg-amber-50/50 space-y-4" id="sa-retired-provisioning-card">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-amber-100 text-amber-800 shrink-0">
                <ShieldAlert className="size-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">
                    Direct Provisioning (SA-01) Retired
                  </h3>
                  <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px]">
                    Policy Alignment
                  </Badge>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  In accordance with the approved Finverse Identity & Governance Policy, direct unvetted account creation and standalone self-activation invitation links have been retired. All new employee accounts must be initiated via the HR Joiner Request pipeline and authorized by Super Admin with placement verification and temporary password provisioning.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-amber-200/60 text-xs">
              <div className="p-3 rounded-lg bg-white border border-amber-200/60 shadow-xs space-y-1">
                <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-emerald-600" />
                  Approved Provisioning Standard
                </div>
                <p className="text-[11px] text-slate-500">
                  1. HR registers candidate and proposes initial role, vertical, team, and superior at <span className="font-mono text-emerald-700">/hr/joiners</span>.<br />
                  2. Super Admin verifies placement, assigns unique username and temporary password in the <span className="font-semibold text-slate-700">Pending HR Onboardings</span> queue.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-white border border-amber-200/60 shadow-xs space-y-1">
                <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <AlertTriangle className="size-3.5 text-rose-600" />
                  Retired Incompatibilities
                </div>
                <p className="text-[11px] text-slate-500">
                  • Standalone invitation tokens (unvetted self-registration) retired.<br />
                  • Obsolete Team Leader (<span className="font-mono text-rose-700">TL</span>) role retired in favor of frontline Relationship Managers (<span className="font-mono text-emerald-700">REL</span>).
                </p>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end">
              <Button
                id="sa-switch-to-onboarding-btn"
                type="button"
                onClick={() => { setTab('onboarding'); setMessage(null); }}
                className="bg-[#113F3D] hover:bg-[#0c2e2c] text-white text-xs gap-1.5 shadow-xs"
              >
                <Users className="size-3.5" />
                Go to Pending HR Onboardings Queue
              </Button>
            </div>
          </div>
        </DeckFrame>
      ) : (
        <DeckFrame
          actionCode="SA-07"
          moduleLabel="EMPLOYEES & USERS"
          title="Reset account access safely"
          steps={[
            'Verify the employees identity through the approved recovery process.',
            'Issue a time-limited recovery action and revoke compromised sessions.',
            'Review completion without viewing or setting a shared employee password.',
          ]}
          whenCheckFails="Unverified requests remain blocked and route to the security owner."
          permissionEvidence="Recovery never changes role scope or bypasses inactive employment. Privileged recovery requires stronger verification."
          onSubmit={handleResetAccess}
          submitting={submitting}
          submitLabel="Issue Recovery Key →"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700">Target User</label>
              <Select
                value={recEmpId}
                onChange={(e) => setRecEmpId(e.target.value)}
                className="mt-1 w-full font-mono text-xs"
              >
                <option value="EMP-001">Asha Rao (EMP-001)</option>
                <option value="EMP-002">Ravi Menon (EMP-002)</option>
                <option value="EMP-003">Tara Iyer (EMP-003)</option>
                <option value="EMP-007">Neel Verma (EMP-007)</option>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Issue type</label>
              <Select
                value={issueType}
                onChange={(e) => setIssueType(e.target.value as any)}
                className="mt-1 w-full"
              >
                <option value="Locked account">Locked account</option>
                <option value="MFA recovery">MFA recovery</option>
                <option value="Credential reset">Credential reset</option>
                <option value="Compromised session">Compromised session</option>
              </Select>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-slate-700">Identity check procedure</label>
              <Input
                value={procedure}
                onChange={(e) => setProcedure(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-slate-700">Sessions action</label>
              <Input
                disabled
                value="Revoke all active sessions and refresh tokens immediately on issuance"
                className="mt-1 bg-slate-50 text-slate-500"
              />
            </div>
          </div>
        </DeckFrame>
      )}

      {/* Invitations Table */}
      <div className="max-w-7xl mx-auto px-4 pt-2">
        <h3 className="text-xs font-bold tracking-wider text-slate-700 uppercase mb-2">
          Provisioned Invitations & Recovery Ledger
        </h3>
        <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Email</th>
                  <th className="py-2.5 px-4">Employee</th>
                  <th className="py-2.5 px-4">Role/Scope</th>
                  <th className="py-2.5 px-4">Expiry</th>
                  <th className="py-2.5 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invitations.length > 0 ? (
                  invitations.slice(0, 5).map((inv: any) => (
                    <tr key={inv.id}>
                      <td className="py-2.5 px-4 font-medium text-slate-900">{inv.work_email}</td>
                      <td className="py-2.5 px-4 text-slate-600">{inv.display_name}</td>
                      <td className="py-2.5 px-4 text-slate-600">{inv.proposed_role} · {inv.team_name}</td>
                      <td className="py-2.5 px-4 text-slate-500">{new Date(inv.expires_at).toLocaleDateString()}</td>
                      <td className="py-2.5 px-4">
                        <Badge className={`text-[10px] ${inv.invitation_status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-slate-50 text-slate-600'}`}>
                          {inv.invitation_status}
                        </Badge>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-3 text-center text-slate-400">No invitations created yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Local Delivery Adapter Outbox Card (Demo: No External Email Service) */}
      <div className="max-w-7xl mx-auto px-4 pt-4 pb-8">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-xs font-bold tracking-wider text-slate-700 uppercase">
              Local Delivery Adapter Outbox
            </h3>
            <p className="text-[11px] text-slate-500">
              Demo environment: no external email provider is configured. Activation and recovery links are safely delivered to this local adapter.
            </p>
          </div>
          <Badge className="bg-amber-50 text-amber-800 border-amber-300 text-[10px]">
            Demo Adapter: No External Email Provider
          </Badge>
        </div>
        <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Recipient</th>
                  <th className="py-2.5 px-4">Type</th>
                  <th className="py-2.5 px-4">Subject</th>
                  <th className="py-2.5 px-4">Action Link</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {outbox.length > 0 ? (
                  outbox.map((item: any) => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-4 font-mono font-medium text-slate-900">{item.recipient_email}</td>
                      <td className="py-2.5 px-4 capitalize text-slate-700">{item.delivery_type.replace('_', ' ')}</td>
                      <td className="py-2.5 px-4 text-slate-600">{item.subject}</td>
                      <td className="py-2.5 px-4 font-mono">
                        <a
                          href={item.action_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#113F3D] font-semibold underline hover:text-[#0b2b29] inline-flex items-center gap-1"
                        >
                          <span>{item.action_url}</span>
                          <ArrowRight className="w-3 h-3" />
                        </a>
                      </td>
                      <td className="py-2.5 px-4">
                        <Badge
                          className={`text-[10px] ${
                            item.consumed_at
                              ? 'bg-slate-100 text-slate-600'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-300'
                          }`}
                        >
                          {item.consumed_at ? 'Consumed' : 'Pending consumption'}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-4 text-slate-400 font-mono text-[11px]">
                        {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-slate-400">
                      No local delivery messages emitted yet. Create an account or issue a recovery to see delivered links here.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Onboarding Approval & Placement Modal */}
      {approvingReq && (
        <div role="dialog" aria-modal="true" aria-labelledby="sa-approve-title" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <Card className="w-full max-w-lg shadow-xl border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h3 id="sa-approve-title" className="text-base font-bold text-slate-900">Approve & Activate Employee</h3>
                <p className="text-xs text-slate-500">Configure role placement, team scope, and initial login username.</p>
              </div>
              <button
                type="button"
                onClick={() => setApprovingReq(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600"
              >
                <X className="size-4" />
              </button>
            </div>
            <CardContent className="p-6 space-y-4">
              <div className="rounded-md bg-slate-50 p-3 border border-slate-200 text-xs space-y-1">
                <div className="font-semibold text-slate-800">
                  {approvingReq.employee_name || approvingReq.full_name} · <span className="font-mono text-emerald-700">{approvingReq.employee_id}</span>
                </div>
                <div className="text-slate-500 font-mono text-[11px]">{approvingReq.email || approvingReq.work_email}</div>
                <div className="text-[11px] text-slate-500">📱 {approvingReq.primary_mobile || '—'}</div>
                <div className="text-[11px] text-slate-600">
                  HR proposed: {VERTICAL_LABELS[approvingReq.proposed_vertical || approvingReq.target_vertical] || approvingReq.proposed_vertical || approvingReq.target_vertical || 'No vertical'}
                  {' · '}{approvingReq.proposed_team_name || approvingReq.proposed_team_id || 'No team'}
                  {' · '}{approvingReq.proposed_superior_name || approvingReq.proposed_superior_id || 'No superior'}
                </div>
              </div>

              {approveError && (
                <div className="p-3 text-xs rounded border border-rose-200 bg-rose-50 text-rose-800">
                  {approveError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label htmlFor="sa-approve-role" className="font-semibold text-slate-700">Role</label>
                  <Select
                    id="sa-approve-role"
                    value={approveRole}
                    onChange={(e) => {
                      setApproveRole(e.target.value as any);
                      if (e.target.value === 'SC') {
                        setApproveManagerId(approvePlacementOptions?.teams.find((team) => team.id === approveTeamId)?.relationshipManagerId ?? '');
                      }
                    }}
                    className="mt-1 w-full"
                  >
                    <option value="SC">Sales Caller (SC)</option>
                    <option value="REL">Relationship Manager (REL)</option>
                    <option value="MG">Branch/Wealth Manager (MG)</option>
                    <option value="RM">Regional Manager (RM)</option>
                    <option value="NM">National Manager (NM)</option>
                    <option value="DE">Data Entry (DE)</option>
                    <option value="HR">Human Resources (HR)</option>
                    <option value="SA">Super Admin (SA)</option>
                  </Select>
                </div>

                <div>
                  <label htmlFor="sa-approve-vertical" className="font-semibold text-slate-700">Vertical</label>
                  <Select
                    id="sa-approve-vertical"
                    value={approveVertical}
                    onChange={(e) => handleApproveVerticalChange(e.target.value)}
                    className="mt-1 w-full"
                  >
                    <option value="wealth">Wealth Management</option>
                    <option value="banking">Corporate Banking</option>
                    <option value="markets">Trading & Markets</option>
                    <option value="real_estate">Real Estate</option>
                  </Select>
                </div>

                <div>
                  <label htmlFor="sa-approve-team" className="font-semibold text-slate-700">Assigned Team</label>
                  <Select
                    id="sa-approve-team"
                    value={approveTeamId}
                    onChange={(e) => {
                      setApproveTeamId(e.target.value);
                      if (approveRole === 'SC') {
                        setApproveManagerId(approvePlacementOptions?.teams.find((team) => team.id === e.target.value)?.relationshipManagerId ?? '');
                      }
                    }}
                    className="mt-1 w-full"
                  >
                    {(approvePlacementOptions?.teams || []).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label htmlFor="sa-approve-superior" className="font-semibold text-slate-700">Reporting Superior</label>
                  <Select
                    id="sa-approve-superior"
                    value={approveManagerId}
                    onChange={(e) => setApproveManagerId(e.target.value)}
                    className="mt-1 w-full"
                  >
                    <option value="">None / Not Applicable</option>
                    {(approvePlacementOptions?.superiors.filter((m) => approveRole !== 'SC' || m.id === approvePlacementOptions.teams.find((team) => team.id === approveTeamId)?.relationshipManagerId) || []).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.role})
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="col-span-2">
                  <label htmlFor="sa-approve-username" className="font-semibold text-slate-700 block mb-1">
                    Unique Login Username <span className="text-emerald-700">(Manually chosen by SA)</span>
                  </label>
                  <Input
                    id="sa-approve-username"
                    value={approveUsername}
                    onChange={(e) => setApproveUsername(e.target.value)}
                    placeholder="e.g. ananya.sharma"
                    className="font-mono text-xs"
                    aria-invalid={Boolean(approveFieldErrors.username)}
                    required
                  />
                  {approveFieldErrors.username?.map((message) => (
                    <p key={message} role="alert" className="mt-1 text-xs text-rose-700">{message}</p>
                  ))}
                  <p className="text-[11px] text-slate-500 mt-1">
                    Use at least 3 characters: letters, numbers, dots, underscores, or hyphens. No spaces. Linked to employee ID <span className="font-mono font-bold text-slate-700">{approvingReq.employee_id}</span>.
                  </p>
                </div>

                <div className="col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="sa-approve-password" className="font-semibold text-slate-700">One-Time Temporary Password</label>
                    <button
                      type="button"
                      onClick={() => setShowApprovePassword(!showApprovePassword)}
                      className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1"
                    >
                      {showApprovePassword ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                      <span>{showApprovePassword ? 'Hide' : 'Show'}</span>
                    </button>
                  </div>
                  <Input
                    id="sa-approve-password"
                    type={showApprovePassword ? 'text' : 'password'}
                    value={approveTempPassword}
                    onChange={(e) => setApproveTempPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="font-mono text-xs"
                    aria-invalid={Boolean(approveFieldErrors.temporaryPassword)}
                    required
                  />
                  {approveFieldErrors.temporaryPassword?.map((message) => (
                    <p key={message} role="alert" className="mt-1 text-xs text-rose-700">{message}</p>
                  ))}
                  <p className="text-[11px] text-slate-500 mt-1">
                    Stored as secure hash; employee must change this password at first login.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setApprovingReq(null)}
                  disabled={approveSubmitting}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleApproveSubmit}
                  disabled={approveSubmitting}
                  className="text-xs bg-[#113F3D] hover:bg-[#0c2e2c] text-white"
                >
                  {approveSubmitting ? 'Activating…' : 'Approve & Activate Account'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Provisioned Credentials One-Time Display Modal */}
      {provisionedResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4">
          <Card className="w-full max-w-md shadow-2xl border-emerald-300 bg-white">
            <div className="flex items-center gap-2 border-b border-emerald-100 bg-emerald-50/60 px-6 py-4">
              <CheckCircle2 className="size-5 text-emerald-600" />
              <div>
                <h3 className="text-base font-bold text-emerald-950">Employee Account Activated</h3>
                <p className="text-xs text-emerald-800">One-Time Initial Credential Provisioning</p>
              </div>
            </div>
            <CardContent className="p-6 space-y-4 text-xs">
              <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5 uppercase tracking-wide text-[11px] text-amber-800">
                  <ShieldCheck className="size-4" /> Single-Display Temporary Credential
                </div>
                <p className="text-[11px] leading-relaxed">
                  Plaintext credentials are never stored or logged in Finverse CRM. Transmit this temporary password to the employee securely. A password change is enforced on initial login.
                </p>
              </div>

              <div className="space-y-3 pt-1">
                <div>
                  <span className="text-slate-500 font-medium">Employee ID:</span>{' '}
                  <span className="font-mono font-bold text-slate-900">{provisionedResult.employeeId}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Login Username:</span>{' '}
                  <span className="font-mono font-bold text-slate-900">{provisionedResult.username}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">One-Time Temporary Password:</span>
                  <div className="mt-1 flex items-center justify-between p-2.5 rounded bg-slate-100 border border-slate-300 font-mono text-sm font-bold text-slate-900 select-all">
                    <span>{provisionedResult.temporaryPassword}</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (provisionedResult.temporaryPassword) {
                          navigator.clipboard.writeText(provisionedResult.temporaryPassword);
                          setCopiedPass(true);
                          setTimeout(() => setCopiedPass(false), 2000);
                        }
                      }}
                      className="px-2 py-1 rounded bg-white hover:bg-slate-50 border text-xs text-slate-700 flex items-center gap-1 font-sans"
                    >
                      <Copy className="size-3" />
                      {copiedPass ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t">
                <Button
                  className="w-full bg-[#113F3D] hover:bg-[#0c2e2c] text-white"
                  onClick={() => {
                    setProvisionedResult(null);
                    setCopiedPass(false);
                  }}
                >
                  Acknowledge & Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Reject Onboarding Request Modal */}
      {rejectingReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <Card className="w-full max-w-md shadow-xl border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Reject Onboarding Request</h3>
                <p className="text-xs text-slate-500">Record an audited reason for rejecting this candidate.</p>
              </div>
              <button
                type="button"
                onClick={() => setRejectingReq(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600"
              >
                <X className="size-4" />
              </button>
            </div>
            <CardContent className="p-6 space-y-4">
              <div className="rounded-md bg-slate-50 p-3 border border-slate-200 text-xs">
                Candidate: <span className="font-semibold text-slate-800">{rejectingReq.employee_name || rejectingReq.full_name}</span> ({rejectingReq.employee_id})
              </div>

              {rejectError && (
                <div className="p-3 text-xs rounded border border-rose-200 bg-rose-50 text-rose-800">
                  {rejectError}
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-700">
                  Rejection Reason <span className="text-rose-500">*</span>
                </label>
                <Textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g. Ineligible role qualifications, duplicate identity application, or cancelled placement."
                  rows={3}
                  className="mt-1 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRejectingReq(null)}
                  disabled={rejectSubmitting}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleRejectSubmit}
                  disabled={rejectSubmitting}
                  className="text-xs bg-rose-600 hover:bg-rose-700 text-white"
                >
                  {rejectSubmitting ? 'Rejecting…' : 'Confirm Rejection'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// 3. Roles & Scopes Page (SA-02, SA-03, SA-11)
// =============================================================================
export function SuperadminScopesPage() {
  const { session } = useSession();
  const availableVerticals = getAvailableVerticals(session?.verticalGrants);

  const [tab, setTab] = useState<'sa02' | 'sa03' | 'sa11'>('sa02');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [delegations, setDelegations] = useState<any[]>([]);

  // SA-02
  const [empId, setEmpId] = useState('EMP-001');
  const [role, setRole] = useState<'TL' | 'MG' | 'RM' | 'SC'>('TL');
  const [vertical, setVertical] = useState<CanonicalVertical>('wealth');
  const [allowedTeams, setAllowedTeams] = useState<string[]>(['TEAM-WEALTH-ALPHA', 'TEAM-WEALTH-BETA']);
  const [ref, setRef] = useState('REQ-AUTH-2026-088');

  // SA-03
  const [addEmpId, setAddEmpId] = useState('EMP-005'); // Meera
  const [addVertical, setAddVertical] = useState<CanonicalVertical>('banking');
  const [addTeam, setAddTeam] = useState('TEAM-BANKING-ALPHA');

  useEffect(() => {
    superadminApi.listTemporaryGrants().then(setDelegations).catch(console.error);
  }, []);

  const handleGrantScope = async () => {
    setMessage(null);
    try {
      await superadminApi.grantScope({
        employeeId: empId,
        role: role as any,
        vertical: vertical as any,
        allowedTeamIds: allowedTeams,
        effectiveFrom: new Date().toISOString().split('T')[0],
        approverReference: ref,
      });
      setMessage({ type: 'success', text: `Granted ${role} scope across ${allowedTeams.join(', ')} for ${empId}. Obsolete sessions revoked.` });
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Failed to commit scope grant.' });
    }
  };

  const handleGrantAdditional = async () => {
    setMessage(null);
    try {
      const res = await superadminApi.grantAdditionalScope({
        employeeId: addEmpId,
        additionalVertical: addVertical as any,
        additionalTeamId: addTeam,
        effectiveFrom: new Date().toISOString().split('T')[0],
        approverReference: 'ADD-SCOPE-091',
      });
      setMessage({ type: 'success', text: `Added ${addVertical} scope (${addTeam}) in retained base role ${res.role} for ${addEmpId}.` });
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Failed to add secondary scope.' });
    }
  };

  const handleDecideDelegation = async (grantId: string, decision: 'renew' | 'revoke') => {
    try {
      await superadminApi.decideTemporaryGrant({
        grantId,
        decision,
        renewalDays: 14,
        decisionReason: decision === 'renew' ? 'Approved 14-day delegation renewal' : 'Revoked by administrator review',
      });
      setMessage({ type: 'success', text: `Delegation ${grantId} marked ${decision === 'renew' ? 'renewed' : 'revoked'}.` });
      superadminApi.listTemporaryGrants().then(setDelegations);
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Action failed.' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="max-w-7xl mx-auto px-4 pt-4 flex gap-2">
        <Button
          variant={tab === 'sa02' ? 'default' : 'outline'}
          size="sm"
          onClick={() => { setTab('sa02'); setMessage(null); }}
          className={tab === 'sa02' ? 'bg-[#113F3D] text-white' : ''}
        >
          SA-02 Precise Org Scope
        </Button>
        <Button
          variant={tab === 'sa03' ? 'default' : 'outline'}
          size="sm"
          onClick={() => { setTab('sa03'); setMessage(null); }}
          className={tab === 'sa03' ? 'bg-[#113F3D] text-white' : ''}
        >
          SA-03 Secondary Team/Vertical
        </Button>
        <Button
          variant={tab === 'sa11' ? 'default' : 'outline'}
          size="sm"
          onClick={() => { setTab('sa11'); setMessage(null); }}
          className={tab === 'sa11' ? 'bg-[#113F3D] text-white' : ''}
        >
          SA-11 Expiring Delegations
        </Button>
      </div>

      {message && (
        <div className="max-w-7xl mx-auto px-4">
          <div className={`p-4 rounded-lg text-sm flex items-start gap-3 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-rose-600" />}
            <div>{message.text}</div>
          </div>
        </div>
      )}

      {tab === 'sa02' && (
        <DeckFrame
          actionCode="SA-02"
          moduleLabel="ROLES & SCOPES"
          title="Grant a role with precise organisation scope"
          steps={[
            'Choose the approved role and exact organisation nodes.',
            'Preview menus, record scope, approvals and export permissions.',
            'Commit the effective-dated grant and notify the employee.',
          ]}
          whenCheckFails="Conflicting grants or a reporting cycle block publication. Administrative authority is not a routine sales override."
          permissionEvidence="Role and scope are separate. Additional teams need explicit grants; permission preview must expose unintended unions."
          onSubmit={handleGrantScope}
          submitLabel="Commit Scope Grant →"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700">Employee</label>
                <Select value={empId} onChange={(e) => setEmpId(e.target.value)} className="mt-1 w-full font-mono text-xs">
                  <option value="EMP-001">Asha Rao (EMP-001)</option>
                  <option value="EMP-002">Ravi Menon (EMP-002)</option>
                  <option value="EMP-005">Meera Nair (EMP-005)</option>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Role</label>
                <Select value={role} onChange={(e) => setRole(e.target.value as any)} className="mt-1 w-full">
                  <option value="SC">Sales Associate</option>
                  <option value="TL">Team leader</option>
                  <option value="MG">Wealth Manager</option>
                  <option value="RM">Regional Manager</option>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Approver Reference</label>
                <Input value={ref} onChange={(e) => setRef(e.target.value)} className="mt-1" />
              </div>
            </div>

            {/* Effective permission scope matrix table matching Action Deck P293 */}
            <div className="border border-slate-200 rounded-lg overflow-hidden mt-4">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-800">Effective permission scope</span>
                <Badge className="text-[10px] bg-white">Preview before save</Badge>
              </div>
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50/50 text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="py-2 px-4">SURFACE</th>
                    <th className="py-2 px-4">GRANT</th>
                    <th className="py-2 px-4">RECORD SCOPE</th>
                    <th className="py-2 px-4">RESULT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-2 px-4 font-medium text-slate-800">Role interface</td>
                    <td className="py-2 px-4 text-slate-600">{role} interface</td>
                    <td className="py-2 px-4 text-slate-500">Current role only</td>
                    <td className="py-2 px-4 text-emerald-600 font-semibold">Allowed</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-4 font-medium text-slate-800">Assigned team records</td>
                    <td className="py-2 px-4 text-slate-600">Explicit team grant ({allowedTeams.length} teams)</td>
                    <td className="py-2 px-4 text-slate-500">Current interval</td>
                    <td className="py-2 px-4 text-emerald-600 font-semibold">Allowed</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-4 font-medium text-slate-800">Other role interface</td>
                    <td className="py-2 px-4 text-slate-600">No grant</td>
                    <td className="py-2 px-4 text-slate-500">None</td>
                    <td className="py-2 px-4 text-rose-600 font-semibold">Denied</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-4 font-medium text-slate-800">Other vertical data</td>
                    <td className="py-2 px-4 text-slate-600">No grant</td>
                    <td className="py-2 px-4 text-slate-500">None</td>
                    <td className="py-2 px-4 text-rose-600 font-semibold">Denied</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-4 font-medium text-slate-800">Export and scheduled jobs</td>
                    <td className="py-2 px-4 text-slate-600">Inherited from active grant</td>
                    <td className="py-2 px-4 text-slate-500">Rechecked</td>
                    <td className="py-2 px-4 text-blue-600 font-semibold">Scoped</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </DeckFrame>
      )}

      {tab === 'sa03' && (
        <DeckFrame
          actionCode="SA-03"
          moduleLabel="ROLES & SCOPES"
          title="Grant a second team or vertical in the same role"
          steps={[
            'Inspect the approved additional scope and duration.',
            'Preview union and per-team filters with duplicated membership checks.',
            'Activate only the requested team/vertical scope.',
          ]}
          whenCheckFails="Revoking the added grant removes its data and queued exports immediately while preserving permitted historical reports."
          permissionEvidence="No other role menu appears. Cross-vertical TL summaries label each vertical and deduplicate overlapping facts."
          onSubmit={handleGrantAdditional}
          submitLabel="Activate Secondary Scope →"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700">Employee</label>
              <Select value={addEmpId} onChange={(e) => setAddEmpId(e.target.value)} className="mt-1 w-full font-mono text-xs">
                <option value="EMP-005">Meera Nair (EMP-005, TL)</option>
                <option value="EMP-002">Ravi Menon (EMP-002, TL)</option>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Additional Vertical</label>
              <Select
                value={addVertical}
                onChange={(e) => {
                  const nextV = e.target.value as CanonicalVertical;
                  setAddVertical(nextV);
                  const teams = TEAMS_BY_VERT[nextV] || [];
                  if (teams.length > 0) setAddTeam(teams[0].id);
                }}
                className="mt-1 w-full"
              >
                {availableVerticals.map((v) => (
                  <option key={v} value={v}>
                    {VERTICAL_LABELS[v]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Additional Team</label>
              <Select value={addTeam} onChange={(e) => setAddTeam(e.target.value)} className="mt-1 w-full">
                {(TEAMS_BY_VERT[addVertical] || []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="md:col-span-3 p-3 rounded-lg bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-800">
              ✓ <strong>Role Preservation Guaranteed:</strong> The employee retains their exact interface. Cross-vertical summaries label each vertical and deduplicate overlapping facts without leaking executive or caller menus.
            </div>
          </div>
        </DeckFrame>
      )}

      {tab === 'sa11' && (
        <DeckFrame
          actionCode="SA-11"
          moduleLabel="ROLES & SCOPES"
          title="Review expiring access and temporary delegation"
          steps={[
            'Open upcoming expiries and inspect actual business need.',
            'Request renewal approval or allow scheduled expiry.',
            'Verify removal from menus, records, reports and background jobs.',
          ]}
          whenCheckFails="No response means expiry, never indefinite renewal or automatic transfer of authority."
          permissionEvidence="Delegation is role/action/scope/time limited. It cannot exceed the delegators authority or bypass independent approval."
        >
          <div className="space-y-4">
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">Grant / Owner</th>
                    <th className="py-2.5 px-4">Scope</th>
                    <th className="py-2.5 px-4">Expiry</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4 text-right">Decision</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {delegations.map((g) => (
                    <tr key={g.id}>
                      <td className="py-2.5 px-4 font-medium text-slate-900">
                        {g.employee_name} ({g.employee_id})
                        <div className="text-[11px] text-slate-400 font-normal">{g.grant_type}</div>
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">{g.target_role} · {g.team_name}</td>
                      <td className="py-2.5 px-4 text-slate-500">{new Date(g.expires_at).toLocaleDateString()}</td>
                      <td className="py-2.5 px-4">
                        <Badge className="text-[10px] bg-slate-50 text-slate-700">
                          {g.current_status}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-4 text-right space-x-2">
                        {g.current_status === 'active' && (
                          <>
                            <Button size="sm" variant="outline" className="h-7 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50" onClick={() => handleDecideDelegation(g.id, 'renew')}>
                              Renew 14d
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs text-rose-700 border-rose-300 hover:bg-rose-50" onClick={() => handleDecideDelegation(g.id, 'revoke')}>
                              Revoke
                            </Button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </DeckFrame>
      )}
    </div>
  );
}

// =============================================================================
// 4. Organisation Hierarchy Page (SA-04)
// =============================================================================
export function SuperadminOrganisationPage() {
  const { session } = useSession();
  const availableVerticals = getAvailableVerticals(session?.verticalGrants);

  const [vertical, setVertical] = useState<CanonicalVertical>('wealth');
  const [nodes, setNodes] = useState<any[]>([]);
  const [unitName, setUnitName] = useState('');
  const [unitLevel, setUnitLevel] = useState('Manager');
  const [parentNodeId, setParentNodeId] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadHierarchy = useCallback(() => {
    superadminApi.getHierarchy(vertical).then(setNodes).catch(console.error);
  }, [vertical]);

  useEffect(() => {
    loadHierarchy();
  }, [loadHierarchy]);

  const handleRestructure = async () => {
    if (!unitName) {
      setMessage({ type: 'error', text: 'Unit name is required.' });
      return;
    }
    setMessage(null);
    try {
      await superadminApi.restructureHierarchy({
        unitName,
        vertical,
        unitLevel,
        parentNodeId: parentNodeId || null,
        effectiveDate: new Date().toISOString().split('T')[0],
      });
      setMessage({ type: 'success', text: `Hierarchy unit '${unitName}' published cleanly without cycles in ${vertical}.` });
      setUnitName('');
      loadHierarchy();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Hierarchy restructuring failed.' });
    }
  };

  return (
    <div className="space-y-6">
      {message && (
        <div className="max-w-7xl mx-auto px-4 pt-4">
          <div className={`p-4 rounded-lg text-sm flex items-start gap-3 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-rose-600" />}
            <div>{message.text}</div>
          </div>
        </div>
      )}

      <DeckFrame
        actionCode="SA-04"
        moduleLabel="ORGANISATION"
        title="Create or restructure the reporting hierarchy"
        steps={[
          'Create an approved unit or draft a parent/reporting change.',
          'Preview descendants, supervisor paths and permission impact.',
          'Publish the dated structure after required approval.',
        ]}
        whenCheckFails="Unresolved orphan teams or missing accountable owners block activation."
        permissionEvidence="Block cycles, invalid cross-vertical parents and ambiguous primary performance paths. Executive finance reporting is a separate relationship."
        onSubmit={handleRestructure}
        submitLabel="Publish Dated Structure →"
      >
        <div className="space-y-6">
          {/* Vertical Selector */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <span className="text-xs font-semibold text-slate-700">Hierarchy Vertical Scope:</span>
            <div className="flex items-center gap-1.5">
              {availableVerticals.map((v) => (
                <button
                  key={v}
                  type="button"
                  id={`sa-org-vertical-${v}`}
                  onClick={() => setVertical(v)}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                    vertical === v ? 'bg-[#113F3D] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 bg-slate-100'
                  }`}
                >
                  {VERTICAL_SHORT_LABELS[v]}
                </button>
              ))}
            </div>
          </div>

          {/* Effective Reporting Path Visual Cards matching Action Deck P297 */}
          <div>
            <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase mb-3">
              EFFECTIVE REPORTING PATH ({VERTICAL_SHORT_LABELS[vertical]})
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-1">
                <div className="text-[10px] text-slate-400 font-mono">01</div>
                <div className="text-xs font-semibold text-slate-900">National manager</div>
                <div className="text-[11px] text-slate-500">Vertical owner</div>
              </div>
              <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-1">
                <div className="text-[10px] text-slate-400 font-mono">02</div>
                <div className="text-xs font-semibold text-slate-900">Regional manager</div>
                <div className="text-[11px] text-slate-500">Approved parent</div>
              </div>
              <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-1">
                <div className="text-[10px] text-slate-400 font-mono">03</div>
                <div className="text-xs font-semibold text-slate-900">Manager</div>
                <div className="text-[11px] text-slate-500">Approved parent</div>
              </div>
              <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-1">
                <div className="text-[10px] text-slate-400 font-mono">04</div>
                <div className="text-xs font-semibold text-slate-900">Team leader</div>
                <div className="text-[11px] text-slate-500">Approved parent</div>
              </div>
              <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-1">
                <div className="text-[10px] text-slate-400 font-mono">05</div>
                <div className="text-xs font-semibold text-slate-900">Sales associate</div>
                <div className="text-[11px] text-slate-500">Approved parent</div>
              </div>
            </div>
            <div className="p-2.5 rounded bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600 mt-3">
              Every person has one primary reporting path per effective assignment. Changes preserve historical ownership.
            </div>
          </div>

          {/* Form to add/restructure node */}
          <div className="border-t border-slate-200 pt-4 space-y-3">
            <div className="text-xs font-semibold text-slate-800">Add or Reparent Organizational Node</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-slate-600">Unit Name</label>
                <Input value={unitName} onChange={(e) => setUnitName(e.target.value)} placeholder="e.g. South Branch Cluster" className="mt-1" />
              </div>
              <div>
                <label className="text-xs text-slate-600">Unit Level</label>
                <Select value={unitLevel} onChange={(e) => setUnitLevel(e.target.value)} className="mt-1 w-full">
                  <option value="National manager">National manager</option>
                  <option value="Regional manager">Regional manager</option>
                  <option value="Manager">Manager</option>
                  <option value="Team leader">Team leader</option>
                </Select>
              </div>
              <div>
                <label className="text-xs text-slate-600">Parent Node (Optional)</label>
                <Select value={parentNodeId} onChange={(e) => setParentNodeId(e.target.value)} className="mt-1 w-full font-mono text-xs">
                  <option value="">No parent (Root node)</option>
                  {nodes.map((n) => (
                    <option key={n.id} value={n.id}>{n.unit_name} ({n.unit_level})</option>
                  ))}
                </Select>
              </div>
            </div>
          </div>
        </div>
      </DeckFrame>
    </div>
  );
}

// =============================================================================
// 5. Lifecycle Changes Page (SA-05 & SA-06)
// =============================================================================
export function SuperadminLifecyclePage() {
  const [tab, setTab] = useState<'sa05' | 'sa06'>('sa05');
  const [transfers, setTransfers] = useState<any[]>([]);
  const [selectedReq, setSelectedReq] = useState<any>(null);
  const [decision, setDecision] = useState<'approve' | 'return' | 'reject'>('approve');
  const [note, setNote] = useState('Approved within administrative authority; handoff confirmed.');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // SA-06 State
  const [offboardEmpId, setOffboardEmpId] = useState('EMP-001');
  const [reason, setReason] = useState('Approved exit with handoff verification');
  const [holdingItems, setHoldingItems] = useState<any[]>([]);

  const loadData = useCallback(() => {
    Promise.all([superadminApi.listPendingTransfers(), superadminApi.listHoldingQueues()])
      .then(([xfer, hold]) => {
        setTransfers(xfer);
        if (xfer.length > 0 && !selectedReq) setSelectedReq(xfer[0]);
        setHoldingItems(hold);
      })
      .catch(console.error);
  }, [selectedReq]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleActivateTransfer = async () => {
    if (!selectedReq) return;
    setMessage(null);
    try {
      await superadminApi.activateTransfer({
        requestId: selectedReq.id,
        decision,
        decisionNote: note,
      });
      setMessage({ type: 'success', text: `Transfer request ${selectedReq.id} decision committed: ${decision}. Prior active intervals updated.` });
      loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Transfer activation failed.' });
    }
  };

  const handleOffboard = async () => {
    setMessage(null);
    try {
      const res = await superadminApi.offboardEmployee({
        employeeId: offboardEmpId,
        reason,
        effectiveTime: new Date().toISOString(),
        revokeAllSessions: true,
        handoffSupervisedQueue: true,
      });
      setMessage({
        type: 'success',
        text: `Employee ${offboardEmpId} disabled immediately. Active sessions revoked: ${res.sessionsRevoked}. Work moved to holding: ${res.holdingItemsCount}.`,
      });
      loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Offboarding failed.' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="max-w-7xl mx-auto px-4 pt-4 flex gap-2">
        <Button
          variant={tab === 'sa05' ? 'default' : 'outline'}
          size="sm"
          onClick={() => { setTab('sa05'); setMessage(null); }}
          className={tab === 'sa05' ? 'bg-[#113F3D] text-white' : ''}
        >
          SA-05 Activate Transfer/Promotion
        </Button>
        <Button
          variant={tab === 'sa06' ? 'default' : 'outline'}
          size="sm"
          onClick={() => { setTab('sa06'); setMessage(null); }}
          className={tab === 'sa06' ? 'bg-[#113F3D] text-white' : ''}
        >
          SA-06 Disable Access & Offboarding
        </Button>
      </div>

      {message && (
        <div className="max-w-7xl mx-auto px-4">
          <div className={`p-4 rounded-lg text-sm flex items-start gap-3 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-rose-600" />}
            <div>{message.text}</div>
          </div>
        </div>
      )}

      {tab === 'sa05' ? (
        <DeckFrame
          actionCode="SA-05"
          moduleLabel="LIFECYCLE CHANGES"
          title="Activate a transfer or promotion"
          steps={[
            'Review business approvals and the access/workload impact preview.',
            'Confirm the dated role and handoff plan.',
            'Activate; verify the employee now lands in the new role interface.',
          ]}
          whenCheckFails="Failed activation transaction leaves the prior valid state intact and raises an Admin incident."
          permissionEvidence="No automatic carryover of old live access. Historical personal summaries remain inside current-role reports."
          onSubmit={handleActivateTransfer}
          submitLabel="Commit Decision →"
        >
          {/* Two-Column Dual Control Layout matching Action Deck P299 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Panel: Submitted Evidence */}
            <div className="p-4 rounded-lg border border-slate-200 bg-white space-y-3">
              <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                SUBMITTED EVIDENCE
              </div>
              <div className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">
                Decision request
              </div>

              {transfers.length > 0 && (
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">Select Lifecycle Request from Queue</label>
                  <select
                    value={selectedReq?.id || ''}
                    onChange={(e) => {
                      const match = transfers.find((t) => t.id === e.target.value);
                      if (match) setSelectedReq(match);
                    }}
                    className="w-full text-xs font-mono rounded border border-slate-200 p-1.5 bg-slate-50"
                  >
                    {transfers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.id} — {t.employee_name} ({t.proposed_role} · {t.status})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {selectedReq?.status === 'submitted' && (
                <div className="p-2.5 rounded bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Pending Genuine Approval:</span> Free text does not constitute authorization. Server-side activation is blocked until verified approval is attached.
                  </div>
                </div>
              )}

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">Request</span>
                  <span className="font-mono font-medium text-slate-800">
                    {selectedReq?.id || 'MOVE-081'} <span className="text-slate-400 text-[10px]">(v{selectedReq?.request_version || 1})</span>
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">Employee</span>
                  <span className="font-medium text-slate-800">{selectedReq?.employee_name || 'Asha Rao'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">Proposed role</span>
                  <span className="font-semibold text-emerald-700">{selectedReq?.proposed_role || 'SC'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">Target team</span>
                  <span className="font-medium text-slate-800">{selectedReq?.proposed_team_name || 'Wealth Beta'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">Queue status</span>
                  <span className={`font-semibold capitalize ${selectedReq?.status === 'submitted' ? 'text-amber-600' : 'text-blue-600'}`}>
                    {selectedReq?.status?.replace('_', ' ') || 'Submitted'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">Handoff</span>
                  <span className="font-medium text-emerald-600">Confirmed</span>
                </div>
              </div>
              <div className="p-2.5 rounded bg-slate-50 text-[11px] text-slate-500 flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                Original request and previous decisions remain in the audit trail.
              </div>
            </div>

            {/* Right Panel: Your Authority Independent Decision */}
            <div className="p-4 rounded-lg border border-slate-200 bg-white space-y-3">
              <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                YOUR AUTHORITY
              </div>
              <div className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">
                Independent decision
              </div>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setDecision('approve')}
                  className={`w-full text-left p-2.5 rounded-lg border text-xs font-medium flex items-center justify-between transition ${decision === 'approve' ? 'border-emerald-300 bg-emerald-50/80 text-emerald-900' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                >
                  <span>✓ Approve within authority</span>
                  {decision === 'approve' && <Check className="w-4 h-4 text-emerald-600" />}
                </button>
                <button
                  type="button"
                  onClick={() => setDecision('return')}
                  className={`w-full text-left p-2.5 rounded-lg border text-xs font-medium flex items-center justify-between transition ${decision === 'return' ? 'border-amber-300 bg-amber-50/80 text-amber-900' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                >
                  <span>← Return for correction</span>
                  {decision === 'return' && <RotateCcw className="w-4 h-4 text-amber-600" />}
                </button>
                <button
                  type="button"
                  onClick={() => setDecision('reject')}
                  className={`w-full text-left p-2.5 rounded-lg border text-xs font-medium flex items-center justify-between transition ${decision === 'reject' ? 'border-rose-300 bg-rose-50/80 text-rose-900' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                >
                  <span>Reject with reason</span>
                  {decision === 'reject' && <X className="w-4 h-4 text-rose-600" />}
                </button>
              </div>
              <div className="pt-2">
                <label className="text-[11px] font-semibold text-slate-600">Decision note and evidence reference</label>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="mt-1 text-xs"
                  rows={3}
                />
              </div>
              <div className="text-[10px] text-slate-400">
                Self-approval is blocked. A decision cannot exceed the current scope.
              </div>
            </div>
          </div>
        </DeckFrame>
      ) : (
        <DeckFrame
          actionCode="SA-06"
          moduleLabel="LIFECYCLE CHANGES"
          title="Disable access and complete offboarding"
          steps={[
            'Review the exit or urgent suspension authority.',
            'Disable sign-in and revoke active sessions and integration grants.',
            'Verify report schedules, approvals and work queues have accountable owners.',
          ]}
          whenCheckFails="If reassignment cannot finish immediately, access still ends and work enters a supervised holding queue."
          permissionEvidence="Account disable is immediate at the effective time. Preserve evidence and history under the approved retention policy."
          onSubmit={handleOffboard}
          submitLabel="Revoke Access & Quarantine Work →"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700">Employee to Offboard</label>
              <Select value={offboardEmpId} onChange={(e) => setOffboardEmpId(e.target.value)} className="mt-1 w-full font-mono text-xs">
                <option value="EMP-001">Asha Rao (EMP-001)</option>
                <option value="EMP-003">Tara Iyer (EMP-003)</option>
                <option value="EMP-004">Dev Kapoor (EMP-004)</option>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Reason</label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1" />
            </div>
            <div className="md:col-span-2 p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-xs text-amber-800 space-y-1">
              <div>⚠️ <strong>Immediate Session Revocation:</strong> Sign-in is locked immediately. Active JWT/session tokens are destroyed.</div>
              <div>All open leads and callback tasks enter the accountable holding queue awaiting supervisor handoff.</div>
            </div>
          </div>

          {holdingItems.length > 0 && (
            <div className="mt-6 border-t border-slate-200 pt-4">
              <div className="text-xs font-bold text-slate-700 uppercase mb-2">Accountable Holding Queue</div>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">Item Type</th>
                      <th className="py-2 px-3">Item ID</th>
                      <th className="py-2 px-3">Offboarded Source</th>
                      <th className="py-2 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {holdingItems.map((h) => (
                      <tr key={h.id}>
                        <td className="py-2 px-3 font-sans capitalize">{h.item_type}</td>
                        <td className="py-2 px-3 text-slate-700">{h.item_id}</td>
                        <td className="py-2 px-3 text-slate-500 font-sans">{h.source_employee_name}</td>
                        <td className="py-2 px-3"><Badge className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">Holding</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DeckFrame>
      )}
    </div>
  );
}

// =============================================================================
// 6. Business Configuration Page (SA-08)
// =============================================================================
export function SuperadminConfigurationPage() {
  const [configs, setConfigs] = useState<any[]>([]);
  const [key, setKey] = useState('lead_response_sla');
  const [title, setTitle] = useState('High-Net-Worth Accelerated SLA Tier');
  const [category, setCategory] = useState<'stage' | 'sla' | 'routing' | 'fiscal_calendar'>('sla');
  const [version, setVersion] = useState(3);
  const [payloadText, setPayloadText] = useState('{\n  "tier1_hours": 1,\n  "escalate_tl_hours": 2,\n  "escalate_mg_hours": 4\n}');
  const [approvedBy, setApprovedBy] = useState('Product Head (Approved Next Version)');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadConfigs = useCallback(() => {
    superadminApi.listBusinessConfigurations().then(setConfigs).catch(console.error);
  }, []);

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  const handlePublish = async () => {
    setMessage(null);
    try {
      const parsedJson = JSON.parse(payloadText);
      await superadminApi.publishBusinessConfiguration({
        configKey: key,
        title,
        category,
        version: Number(version),
        effectiveDate: new Date().toISOString().split('T')[0],
        schemaPayload: parsedJson,
        approvedBy,
      });
      setMessage({ type: 'success', text: `Published rule version ${version} for '${key}'. Policy version cached and workers alerted.` });
      loadConfigs();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Failed to publish configuration.' });
    }
  };

  return (
    <div className="space-y-6">
      {message && (
        <div className="max-w-7xl mx-auto px-4 pt-4">
          <div className={`p-4 rounded-lg text-sm flex items-start gap-3 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-rose-600" />}
            <div>{message.text}</div>
          </div>
        </div>
      )}

      <DeckFrame
        actionCode="SA-08"
        moduleLabel="BUSINESS CONFIGURATION"
        title="Publish an approved rule version"
        steps={[
          'Load an approved change and validate the schema.',
          'Preview affected screens, tasks, targets and reports.',
          'Publish on schedule with a rollback plan for future configuration.',
        ]}
        whenCheckFails="Incompatible or untested changes stay in draft. Migration of active opportunities requires separate approval."
        permissionEvidence="Admin executes approved rules; they do not invent accounting policy or approve their own financial benefit."
        onSubmit={handlePublish}
        submitLabel="Publish Version →"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-700">Configuration</label>
            <Input value={key} onChange={(e) => setKey(e.target.value)} className="mt-1 font-mono text-xs" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700">Version</label>
            <Input type="number" value={version} onChange={(e) => setVersion(Number(e.target.value))} className="mt-1" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700">Rule Category</label>
            <Select value={category} onChange={(e) => setCategory(e.target.value as any)} className="mt-1 w-full">
              <option value="sla">SLA & Escalations</option>
              <option value="routing">Routing & Distribution</option>
              <option value="stage">Pipeline Stages</option>
              <option value="fiscal_calendar">Fiscal Calendar</option>
            </Select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700">Approvals Reference</label>
            <Input value={approvedBy} onChange={(e) => setApprovedBy(e.target.value)} className="mt-1" />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-semibold text-slate-700">Schema Payload (JSON)</label>
            <Textarea
              value={payloadText}
              onChange={(e) => setPayloadText(e.target.value)}
              className="mt-1 font-mono text-xs"
              rows={4}
            />
          </div>
        </div>

        {/* Existing Versions History */}
        <div className="mt-6 border-t border-slate-200 pt-4">
          <div className="text-xs font-bold text-slate-700 uppercase mb-2">Version History Ledger</div>
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-2 px-3">Key</th>
                  <th className="py-2 px-3">Title</th>
                  <th className="py-2 px-3">Version</th>
                  <th className="py-2 px-3">Effective Date</th>
                  <th className="py-2 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {configs.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2 px-3 text-slate-900 font-medium">{c.config_key}</td>
                    <td className="py-2 px-3 font-sans text-slate-700">{c.title}</td>
                    <td className="py-2 px-3 text-slate-600">v{c.version}</td>
                    <td className="py-2 px-3 text-slate-500">{c.effective_date}</td>
                    <td className="py-2 px-3">
                      <Badge className={`text-[10px] ${c.status === 'published' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                        {c.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </DeckFrame>
    </div>
  );
}

// =============================================================================
// 7. Audit & Incidents Page (SA-09)
// =============================================================================
export function SuperadminAuditPage() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedInc, setSelectedInc] = useState<any>(null);
  const [actionNote, setActionNote] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadIncidents = useCallback(() => {
    superadminApi.listAuditIncidents(search).then(setIncidents).catch(console.error);
  }, [search]);

  useEffect(() => {
    loadIncidents();
  }, [loadIncidents]);

  const handleIncidentAction = async (actionType: 'acknowledge' | 'revoke_access' | 'close_incident') => {
    if (!selectedInc) return;
    setMessage(null);
    try {
      await superadminApi.actOnIncident({
        incidentId: selectedInc.id,
        actionType,
        actionNote: actionNote || `Admin action committed: ${actionType}`,
        targetEmployeeId: selectedInc.actor_identifier.startsWith('EMP-') ? selectedInc.actor_identifier : undefined,
      });
      setMessage({ type: 'success', text: `Incident ${selectedInc.reference_code} updated cleanly.` });
      setSelectedInc(null);
      setActionNote('');
      loadIncidents();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Incident action failed.' });
    }
  };

  return (
    <div className="space-y-6">
      {message && (
        <div className="max-w-7xl mx-auto px-4 pt-4">
          <div className={`p-4 rounded-lg text-sm flex items-start gap-3 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-rose-600" />}
            <div>{message.text}</div>
          </div>
        </div>
      )}

      <DeckFrame
        actionCode="SA-09"
        moduleLabel="AUDIT & INCIDENTS"
        title="Investigate an access or data-change incident"
        steps={[
          'Filter immutable audit records within incident authority.',
          'Trace account, request, policy version and before/after changes.',
          'Create an incident action or revoke access when authorised.',
        ]}
        whenCheckFails="Exceptional data inspection requires a named, time-limited grant. No silent impersonation of employee dashboards."
        permissionEvidence="Audit access is restricted and itself logged. Logs must not expose passwords, tokens or unnecessary sensitive content."
      >
        <div className="space-y-4">
          {/* Search bar matching Action Deck P307 */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search within your permitted scope..."
                className="pl-9 text-xs"
              />
            </div>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs text-slate-600">
              <Filter className="w-3.5 h-3.5" />
              Filters
            </Button>
          </div>

          {/* Table matching Action Deck P307 */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">REFERENCE</th>
                  <th className="py-2.5 px-4">EVENT TYPE</th>
                  <th className="py-2.5 px-4">ACTOR</th>
                  <th className="py-2.5 px-4">STATE</th>
                  <th className="py-2.5 px-4 text-right">NEXT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {incidents.map((inc) => (
                  <tr key={inc.id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-4 font-mono font-medium text-slate-800">{inc.reference_code}</td>
                    <td className="py-2.5 px-4 text-slate-800 font-medium">{inc.event_type}</td>
                    <td className="py-2.5 px-4 text-slate-600">{inc.actor_identifier}</td>
                    <td className="py-2.5 px-4">
                      <Badge className={`text-[10px] ${inc.state === 'Active' ? 'bg-amber-50 text-amber-700 border-amber-200' : inc.state === 'Review' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-50 text-slate-600'}`}>
                        {inc.state}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedInc(inc)}
                        className="h-7 text-xs text-emerald-800 font-semibold hover:bg-emerald-50"
                      >
                        Open →
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Investigation Panel if an incident is selected */}
          {selectedInc && (
            <div className="p-4 rounded-lg border border-emerald-200 bg-emerald-50/30 space-y-3">
              <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
                <div className="font-semibold text-xs text-slate-900">
                  Incident Investigation: {selectedInc.reference_code} ({selectedInc.event_type})
                </div>
                <Button size="sm" variant="ghost" onClick={() => setSelectedInc(null)} className="h-6 text-xs">
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div className="text-xs text-slate-700">{selectedInc.evidence_summary}</div>
              <div className="bg-white p-2.5 rounded border border-slate-200 font-mono text-[11px] text-slate-600">
                {JSON.stringify(selectedInc.before_after_payload, null, 2)}
              </div>
              <Input
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                placeholder="Resolution directive or incident note..."
                className="text-xs bg-white"
              />
              <div className="flex gap-2 justify-end pt-1">
                <Button size="sm" variant="outline" onClick={() => handleIncidentAction('acknowledge')} className="text-xs">
                  Acknowledge
                </Button>
                <Button size="sm" variant="destructive" onClick={() => handleIncidentAction('revoke_access')} className="text-xs">
                  Revoke Target Session
                </Button>
                <Button size="sm" onClick={() => handleIncidentAction('close_incident')} className="bg-[#113F3D] hover:bg-[#0C2B29] text-white text-xs">
                  Close Incident
                </Button>
              </div>
            </div>
          )}
        </div>
      </DeckFrame>
    </div>
  );
}

// =============================================================================
// 8. System Health Page (SA-10)
// =============================================================================
export function SuperadminHealthPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [queue, setQueue] = useState<string>('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadJobs = useCallback(() => {
    superadminApi.listBackgroundJobs(queue).then(setJobs).catch(console.error);
  }, [queue]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const handleRetry = async (job: any) => {
    setMessage(null);
    try {
      const res = await superadminApi.retryBackgroundJob({
        jobId: job.id,
        idempotencyKey: job.idempotency_key,
      });
      setMessage({ type: 'success', text: `Job ${job.job_name} (${job.reference_code}) moved to Active with attempt ${res.retryCount}. Idempotency key verified.` });
      loadJobs();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Retry failed.' });
    }
  };

  return (
    <div className="space-y-6">
      {message && (
        <div className="max-w-7xl mx-auto px-4 pt-4">
          <div className={`p-4 rounded-lg text-sm flex items-start gap-3 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-rose-600" />}
            <div>{message.text}</div>
          </div>
        </div>
      )}

      <DeckFrame
        actionCode="SA-10"
        moduleLabel="SYSTEM HEALTH"
        title="Recover a failed integration or report job"
        steps={[
          'Inspect permitted job metadata and failure cause.',
          'Retry a safe failed job or route it to the service owner.',
          'Verify success and reconcile duplicate-safe results.',
        ]}
        whenCheckFails="Expired permission or offboarded job owner blocks execution and requires an authorised replacement."
        permissionEvidence="Admin job access does not reveal customer payloads without a separate grant. Recheck user scope before replaying exports."
      >
        <div className="space-y-4">
          {/* Queue Filter Bar */}
          <div className="flex gap-2 items-center">
            <span className="text-xs text-slate-500 font-medium">Filter Queue:</span>
            <Button
              size="sm"
              variant={queue === '' ? 'default' : 'outline'}
              onClick={() => setQueue('')}
              className={`h-7 text-xs ${queue === '' ? 'bg-[#113F3D] text-white' : ''}`}
            >
              All Queues
            </Button>
            <Button
              size="sm"
              variant={queue === 'imports' ? 'default' : 'outline'}
              onClick={() => setQueue('imports')}
              className={`h-7 text-xs ${queue === 'imports' ? 'bg-[#113F3D] text-white' : ''}`}
            >
              Imports
            </Button>
            <Button
              size="sm"
              variant={queue === 'reminders' ? 'default' : 'outline'}
              onClick={() => setQueue('reminders')}
              className={`h-7 text-xs ${queue === 'reminders' ? 'bg-[#113F3D] text-white' : ''}`}
            >
              Reminders
            </Button>
            <Button
              size="sm"
              variant={queue === 'exports' ? 'default' : 'outline'}
              onClick={() => setQueue('exports')}
              className={`h-7 text-xs ${queue === 'exports' ? 'bg-[#113F3D] text-white' : ''}`}
            >
              Exports
            </Button>
          </div>

          {/* Table matching Action Deck P309 */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">REFERENCE</th>
                  <th className="py-2.5 px-4">QUEUE</th>
                  <th className="py-2.5 px-4">JOB</th>
                  <th className="py-2.5 px-4">STATE</th>
                  <th className="py-2.5 px-4 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-4 font-mono font-medium text-slate-800">{job.reference_code}</td>
                    <td className="py-2.5 px-4 text-slate-600 capitalize">{job.queue_name}</td>
                    <td className="py-2.5 px-4 font-medium text-slate-900">
                      {job.job_name}
                      {job.failure_reason && (
                        <div className="text-[11px] text-rose-600 font-normal truncate max-w-sm">
                          {job.failure_reason}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-4">
                      <Badge className={`text-[10px] ${job.state === 'Failed' ? 'bg-rose-50 text-rose-700 border-rose-200' : job.state === 'Retrying' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                        {job.state} ({job.retry_count}/{job.max_retries})
                      </Badge>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRetry(job)}
                        disabled={job.retry_count >= job.max_retries}
                        className="h-7 text-xs text-emerald-800 font-semibold border-emerald-300 hover:bg-emerald-50 gap-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Retry
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </DeckFrame>
    </div>
  );
}
