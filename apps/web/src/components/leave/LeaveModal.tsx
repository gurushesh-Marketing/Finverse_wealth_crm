import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Check,
  ChevronDown,
  ChevronUp,
  User,
  Shield,
  FileText,
  RotateCcw,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { leaveApi } from '../../lib/leave-api';
import { useSession } from '../../lib/session';
import type { LeaveRequestRecord, LeaveType } from '@finverse/contracts';

interface LeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'new' | 'my' | 'approvals';
}

export function LeaveModal({ isOpen, onClose, defaultTab = 'new' }: LeaveModalProps) {
  const { session } = useSession();
  const [activeTab, setActiveTab] = useState<'new' | 'my' | 'approvals'>(defaultTab);

  // Form State
  const [leaveType, setLeaveType] = useState<LeaveType>('casual');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [handoverNotes, setHandoverNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  // Lists state
  const [myRequests, setMyRequests] = useState<LeaveRequestRecord[]>([]);
  const [approvalsQueue, setApprovalsQueue] = useState<LeaveRequestRecord[]>([]);
  const [loadingLists, setLoadingLists] = useState(false);
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);

  // Action decision state
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [decisionNotes, setDecisionNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Calculate day difference
  const calculatedDays =
    startDate && endDate && startDate <= endDate
      ? Math.max(1, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1)
      : 0;

  const loadData = useCallback(async () => {
    if (!session) return;
    try {
      setLoadingLists(true);
      const [mine, queue] = await Promise.all([
        leaveApi.getMyRequests(),
        leaveApi.getApprovalsQueue().catch(() => []),
      ]);
      setMyRequests(mine);
      setApprovalsQueue(queue);
    } catch {
      // ignore
    } finally {
      setLoadingLists(false);
    }
  }, [session]);

  useEffect(() => {
    if (isOpen) {
      void loadData();
    }
  }, [isOpen, loadData]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);

    if (!startDate || !endDate) {
      setSubmitError('Start date and end date are required.');
      return;
    }
    if (startDate > endDate) {
      setSubmitError('Start date cannot be after end date.');
      return;
    }
    if (reason.trim().length < 3) {
      setSubmitError('Please provide a substantive reason (at least 3 characters).');
      return;
    }

    try {
      setSubmitting(true);
      const res = await leaveApi.submitRequest({
        leaveType,
        startDate,
        endDate,
        reason,
        handoverNotes: handoverNotes.trim() || undefined,
      });

      setSubmitSuccess(
        `Leave request submitted for ${res.totalDays} day(s). Routed to ${res.approverTitle} for formal sign-off.`
      );
      setReason('');
      setHandoverNotes('');
      setStartDate('');
      setEndDate('');
      void loadData();
      setTimeout(() => {
        setActiveTab('my');
      }, 1500);
    } catch (err: any) {
      if (err.code === 'UNCONFIGURED_APPROVER' || err.message?.includes('UNCONFIGURED_APPROVER')) {
        setSubmitError(`Approver route blocked: ${err.message}`);
      } else if (err.code === 'SELF_APPROVAL_FORBIDDEN' || err.message?.includes('SELF_APPROVAL_FORBIDDEN')) {
        setSubmitError('Self-approval forbidden: Cannot route leave request to yourself.');
      } else {
        setSubmitError(err.message || 'Failed to submit leave request.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdraw = async (id: string) => {
    try {
      setActionLoading(true);
      await leaveApi.withdrawRequest(id, 'Withdrawn by requester');
      setActionMessage('Leave request withdrawn successfully.');
      void loadData();
    } catch (err: any) {
      setActionMessage(`Failed to withdraw: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDecision = async (id: string, decision: 'approved' | 'rejected') => {
    try {
      setActionLoading(true);
      if (decision === 'approved') {
        await leaveApi.approveRequest(id, decisionNotes || 'Approved by superior.');
        setActionMessage('Leave request approved and synchronized to organizational availability.');
      } else {
        if (!decisionNotes.trim()) {
          setActionMessage('Please enter rejection notes explaining why this request cannot be approved.');
          setActionLoading(false);
          return;
        }
        await leaveApi.rejectRequest(id, decisionNotes);
        setActionMessage('Leave request rejected.');
      }
      setDecidingId(null);
      setDecisionNotes('');
      void loadData();
    } catch (err: any) {
      setActionMessage(`Decision failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="leave-modal-title"
    >
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl border border-border bg-background shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-[#113F3D] text-white rounded-t-xl">
          <div className="flex items-center gap-2.5">
            <Calendar className="size-5 text-emerald-300" aria-hidden="true" />
            <div>
              <h2 id="leave-modal-title" className="text-base font-semibold leading-none">
                Leave Request & Approval Engine
              </h2>
              <p className="mt-1 text-xs text-emerald-100/80">
                Shared personnel service across Wealth, Banking, Markets & Real Estate
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-emerald-100 hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-white"
            aria-label="Close modal"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-border bg-muted/30 px-6 pt-2">
          <button
            onClick={() => setActiveTab('new')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-medium transition-colors ${
              activeTab === 'new'
                ? 'border-[#113F3D] text-[#113F3D] font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Calendar className="size-4" />
            Apply for Leave
          </button>
          <button
            onClick={() => setActiveTab('my')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-medium transition-colors ${
              activeTab === 'my'
                ? 'border-[#113F3D] text-[#113F3D] font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Clock className="size-4" />
            My Requests ({myRequests.length})
          </button>
          {approvalsQueue.length > 0 && (
            <button
              onClick={() => setActiveTab('approvals')}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-medium transition-colors ${
                activeTab === 'approvals'
                  ? 'border-[#113F3D] text-[#113F3D] font-semibold'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Shield className="size-4" />
              Approvals Queue
              <span className="ml-1 rounded-full bg-amber-500 px-1.5 py-0.2 text-[10px] text-white">
                {approvalsQueue.length}
              </span>
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {actionMessage && (
            <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900 flex items-center justify-between">
              <span>{actionMessage}</span>
              <button onClick={() => setActionMessage(null)} className="text-emerald-700 hover:text-emerald-900">
                <X className="size-3.5" />
              </button>
            </div>
          )}

          {/* TAB 1: APPLY FOR LEAVE */}
          {activeTab === 'new' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {submitError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 flex items-start gap-2">
                  <AlertCircle className="size-4 text-red-600 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-semibold">Submission Blocked</div>
                    <div>{submitError}</div>
                  </div>
                </div>
              )}

              {submitSuccess && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 flex items-start gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-semibold">Request Registered</div>
                    <div>{submitSuccess}</div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-foreground">Leave Category</label>
                  <select
                    value={leaveType}
                    onChange={(e) => setLeaveType(e.target.value as LeaveType)}
                    className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="casual">Casual Leave</option>
                    <option value="sick">Sick / Medical Leave</option>
                    <option value="annual">Annual Leave</option>
                    <option value="earned">Earned / Privilege Leave</option>
                    <option value="bereavement">Bereavement Leave</option>
                    <option value="paternity">Paternity Leave</option>
                    <option value="maternity">Maternity Leave</option>
                    <option value="unpaid">Leave Without Pay (LWP)</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="text-xs font-semibold text-foreground">Start Date</label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="mt-1"
                      data-testid="leave-start-date"
                      required
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-semibold text-foreground">End Date</label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="mt-1"
                      data-testid="leave-end-date"
                      required
                    />
                  </div>
                </div>
              </div>

              {calculatedDays > 0 && (
                <div className="rounded-md border border-blue-100 bg-blue-50/70 p-2.5 text-xs text-blue-900 flex items-center justify-between">
                  <span>Duration: <strong>{calculatedDays} inclusive calendar day(s)</strong></span>
                  <span className="text-[11px] text-blue-700">Non-overlapping 28th-27th payroll policy applies</span>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-foreground">Reason for Leave</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Provide substantive explanation for leave governance..."
                  rows={3}
                  data-testid="leave-reason"
                  className="mt-1 w-full rounded-md border border-input bg-background p-2.5 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">Workload / Handover Plan (Optional)</label>
                <Input
                  value={handoverNotes}
                  onChange={(e) => setHandoverNotes(e.target.value)}
                  placeholder="e.g. In-flight leads assigned to team colleague..."
                  data-testid="leave-handover"
                  className="mt-1"
                />
              </div>

              <div className="rounded-lg border border-muted bg-muted/20 p-3 text-xs text-muted-foreground space-y-1">
                <div className="font-semibold text-foreground flex items-center gap-1.5">
                  <Shield className="size-3.5 text-[#113F3D]" />
                  Organizational Authority Routing Rule
                </div>
                <div>
                  Requests automatically route upward: <strong>SC → TL → Manager → RM → NM → CEO</strong>.
                  Self-approval is forbidden across all roles. Pending leave does not dampen allocation until approved.
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={submitting || calculatedDays === 0}
                  data-testid="leave-submit-btn"
                  className="bg-[#113F3D] hover:bg-[#113F3D]/90 text-white"
                >
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </Button>
              </div>
            </form>
          )}

          {/* TAB 2: MY REQUESTS */}
          {activeTab === 'my' && (
            <div className="space-y-3">
              {loadingLists ? (
                <div className="py-8 text-center text-xs text-muted-foreground">Loading your leave requests...</div>
              ) : myRequests.length === 0 ? (
                <div className="py-12 text-center">
                  <Calendar className="mx-auto size-8 text-muted-foreground/40 mb-2" />
                  <div className="text-sm font-medium text-foreground">No leave requests found</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    You have not submitted any leave requests yet.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab('new')}
                    className="mt-4"
                  >
                    Apply for Leave
                  </Button>
                </div>
              ) : (
                myRequests.map((req) => {
                  const isExpanded = expandedRequestId === req.id;
                  const canWithdraw = req.status === 'submitted';

                  return (
                    <div key={req.id} className="rounded-lg border border-border bg-card p-4 transition-all hover:border-border/80">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-foreground">{req.id}</span>
                            <Badge
                              className={
                                req.status === 'approved'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : req.status === 'rejected'
                                  ? 'bg-red-50 text-red-700 border-red-200'
                                  : req.status === 'withdrawn'
                                  ? 'bg-gray-100 text-gray-700 border-gray-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                              }
                            >
                              {req.status === 'submitted' ? 'Pending Approval' : req.status}
                            </Badge>
                            <span className="text-xs text-muted-foreground capitalize">
                              • {req.leaveType} leave ({req.totalDays} day{req.totalDays > 1 ? 's' : ''})
                            </span>
                          </div>
                          <div className="text-xs font-medium text-foreground">
                            {new Date(req.startDate).toLocaleDateString()} – {new Date(req.endDate).toLocaleDateString()}
                          </div>
                          <div className="text-xs text-muted-foreground line-clamp-1">{req.reason}</div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          {canWithdraw && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                              disabled={actionLoading}
                              onClick={() => handleWithdraw(req.id)}
                            >
                              <RotateCcw className="size-3 mr-1" /> Withdraw
                            </Button>
                          )}
                          <button
                            onClick={() => setExpandedRequestId(isExpanded ? null : req.id)}
                            className="p-1 text-muted-foreground hover:text-foreground"
                            aria-label="Toggle history"
                          >
                            {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Expanded Details and Audit Timeline */}
                      {isExpanded && (
                        <div className="mt-4 pt-3 border-t border-border/60 text-xs space-y-2">
                          <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                            <div>
                              <span className="font-semibold text-foreground">Approver: </span>
                              {req.currentApproverName || req.currentApproverId || 'Configured Superior'}
                            </div>
                            {req.decidedByName && (
                              <div>
                                <span className="font-semibold text-foreground">Decided By: </span>
                                {req.decidedByName} ({req.decidedAt ? new Date(req.decidedAt).toLocaleString() : ''})
                              </div>
                            )}
                          </div>
                          {req.decisionNotes && (
                            <div className="p-2 rounded bg-muted/40 text-foreground">
                              <span className="font-semibold">Decision Note: </span>
                              {req.decisionNotes}
                            </div>
                          )}

                          {/* Audit Action Log */}
                          {req.actions && req.actions.length > 0 && (
                            <div className="mt-3">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                                Audit History Trail
                              </div>
                              <div className="space-y-1.5 pl-2 border-l-2 border-muted">
                                {req.actions.map((act) => (
                                  <div key={act.id} className="text-[11px] text-muted-foreground">
                                    <span className="font-semibold text-foreground capitalize">{act.action}</span> by{' '}
                                    <span className="text-foreground">{act.actorName || act.actorRole}</span> at{' '}
                                    {new Date(act.createdAt).toLocaleString()}
                                    {act.notes && <div className="text-xs text-foreground/80 pl-2">"{act.notes}"</div>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 3: APPROVALS QUEUE */}
          {activeTab === 'approvals' && (
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground">
                Showing pending requests submitted by subordinates within your authorized supervisory span.
              </div>

              {approvalsQueue.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No pending subordinate leave requests requiring your decision.
                </div>
              ) : (
                approvalsQueue.map((req) => (
                  <div key={req.id} className="rounded-lg border border-border bg-card p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground text-sm">{req.employeeName}</span>
                          <Badge variant="outline" className="text-[10px] uppercase">
                            {req.employeeRole} • {req.vertical}
                          </Badge>
                          <span className="font-mono text-xs text-muted-foreground">{req.id}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {req.teamName || req.teamId} • {req.employeeEmail}
                        </div>
                        <div className="mt-2 text-xs font-medium text-foreground">
                          {new Date(req.startDate).toLocaleDateString()} – {new Date(req.endDate).toLocaleDateString()} ({req.totalDays} day{req.totalDays > 1 ? 's' : ''})
                        </div>
                        <div className="mt-1 text-xs text-foreground/90 p-2 bg-muted/30 rounded border border-border/50">
                          <strong>Reason: </strong> {req.reason}
                          {req.handoverNotes && (
                            <div className="mt-1 text-muted-foreground">
                              <strong>Handover: </strong> {req.handoverNotes}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Decision Interface */}
                    {decidingId === req.id ? (
                      <div className="pt-2 border-t space-y-2">
                        <Input
                          value={decisionNotes}
                          onChange={(e) => setDecisionNotes(e.target.value)}
                          placeholder="Decision explanation or handover verification notes..."
                          className="h-8 text-xs"
                          autoFocus
                        />
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setDecidingId(null);
                              setDecisionNotes('');
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={actionLoading}
                            onClick={() => handleDecision(req.id, 'rejected')}
                          >
                            Reject Request
                          </Button>
                          <Button
                            size="sm"
                            className="bg-emerald-700 hover:bg-emerald-800 text-white"
                            disabled={actionLoading}
                            onClick={() => handleDecision(req.id, 'approved')}
                          >
                            <Check className="size-3.5 mr-1" /> Approve Request
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-2 pt-1 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs text-red-600 hover:bg-red-50"
                          onClick={() => {
                            setDecidingId(req.id);
                            setDecisionNotes('');
                          }}
                        >
                          <XCircle className="size-3.5 mr-1" /> Reject...
                        </Button>
                        <Button
                          size="sm"
                          className="bg-[#113F3D] hover:bg-[#113F3D]/90 text-white text-xs"
                          onClick={() => {
                            setDecidingId(req.id);
                            setDecisionNotes('Approved. Workload verified.');
                          }}
                        >
                          <CheckCircle2 className="size-3.5 mr-1" /> Approve...
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
