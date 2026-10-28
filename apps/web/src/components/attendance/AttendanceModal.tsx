import { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  Briefcase,
  Home,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Send,
  X,
  History,
  ShieldCheck,
  Plus,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import { attendanceApi } from '../../lib/attendance-api';
import type {
  AttendanceRecord,
  AttendanceRegularizationRecord,
  WorkMode,
} from '@finverse/contracts';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input, Textarea } from '../ui/input';

interface AttendanceModalProps {
  open: boolean;
  onClose: () => void;
  onStatusChange?: () => void;
}

export function AttendanceModal({ open, onClose, onStatusChange }: AttendanceModalProps) {
  const [activeTab, setActiveTab] = useState<'today' | 'progress' | 'regularize' | 'history'>('today');
  const [loading, setLoading] = useState(false);
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [pendingRegs, setPendingRegs] = useState<AttendanceRegularizationRecord[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Check-In Form State
  const [checkInMode, setCheckInMode] = useState<WorkMode>('office');
  const [checkInOffline, setCheckInOffline] = useState(false);
  const [checkInActivityCount, setCheckInActivityCount] = useState(0);

  // Check-Out Form State
  const [checkOutSummary, setCheckOutSummary] = useState('');
  const [checkOutEvidenceUrl, setCheckOutEvidenceUrl] = useState('');

  // Progress Log State
  const [progressTitle, setProgressTitle] = useState('');
  const [progressPct, setProgressPct] = useState(50);
  const [progressNotes, setProgressNotes] = useState('');
  const [progressOffline, setProgressOffline] = useState(true);

  // Regularization Form State
  const [regDate, setRegDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [regMode, setRegMode] = useState<WorkMode>('office');
  const [regInTime, setRegInTime] = useState('09:30');
  const [regOutTime, setRegOutTime] = useState('18:30');
  const [regReason, setRegReason] = useState('');
  const [regProgress, setRegProgress] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await attendanceApi.getMyAttendance();
      setTodayRecord(res.todayRecord);
      setHistory(res.history);
      setPendingRegs(res.pendingRegularizations);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to load attendance records.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      void loadData();
    }
  }, [open, loadData]);

  const handleCheckIn = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      setSuccessMsg(null);
      await attendanceApi.checkIn({
        workMode: checkInMode,
        isOfflineWork: checkInOffline,
        crmActivityCount: checkInActivityCount,
      });
      setSuccessMsg(`Successfully checked in for ${checkInMode.toUpperCase()} mode.`);
      void loadData();
      onStatusChange?.();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to check in.');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      setSuccessMsg(null);
      await attendanceApi.checkOut({
        wfhProgressSummary: checkOutSummary || undefined,
        workEvidenceUrl: checkOutEvidenceUrl || undefined,
      });
      setSuccessMsg('Successfully checked out. Total working hours recorded.');
      void loadData();
      onStatusChange?.();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to check out.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddProgressLog = async () => {
    try {
      if (!progressTitle.trim()) {
        setErrorMsg('Please enter a deliverable title.');
        return;
      }
      setLoading(true);
      setErrorMsg(null);
      setSuccessMsg(null);
      await attendanceApi.addProgressLog({
        deliverableTitle: progressTitle.trim(),
        deliverableProgressPct: progressPct,
        notes: progressNotes.trim() || undefined,
        isOfflineDeliverable: progressOffline,
      });
      setProgressTitle('');
      setProgressNotes('');
      setSuccessMsg('Shift progress log recorded.');
      void loadData();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to add progress log.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegularization = async () => {
    try {
      if (!regReason.trim() || regReason.trim().length < 5) {
        setErrorMsg('Please enter an explanatory reason for regularization (at least 5 characters).');
        return;
      }
      setLoading(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      const checkInIso = new Date(`${regDate}T${regInTime}:00`).toISOString();
      const checkOutIso = new Date(`${regDate}T${regOutTime}:00`).toISOString();

      await attendanceApi.requestRegularization({
        workDate: regDate,
        requestedWorkMode: regMode,
        requestedCheckInAt: checkInIso,
        requestedCheckOutAt: checkOutIso,
        reason: regReason.trim(),
        progressSummary: regProgress.trim() || undefined,
      });

      setRegReason('');
      setRegProgress('');
      setSuccessMsg('Regularization request submitted to supervisor for review.');
      void loadData();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to submit regularization request.');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-[#113F3D] px-6 py-4 text-white">
          <div className="flex items-center gap-2.5">
            <Clock className="size-5 text-emerald-300" />
            <div>
              <h2 className="text-base font-bold tracking-tight">Work Mode & Attendance Hub</h2>
              <p className="text-xs text-white/70">
                Record start/end of work, shift updates, and regularization requests
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-border bg-muted/40 px-6 pt-2">
          <button
            onClick={() => { setActiveTab('today'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
              activeTab === 'today'
                ? 'border-[#113F3D] text-[#113F3D]'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Today's Attendance
          </button>
          <button
            onClick={() => { setActiveTab('progress'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
              activeTab === 'progress'
                ? 'border-[#113F3D] text-[#113F3D]'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Progress Updates
          </button>
          <button
            onClick={() => { setActiveTab('regularize'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
              activeTab === 'regularize'
                ? 'border-[#113F3D] text-[#113F3D]'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Regularization & Exceptions ({pendingRegs.length})
          </button>
          <button
            onClick={() => { setActiveTab('history'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
              activeTab === 'history'
                ? 'border-[#113F3D] text-[#113F3D]'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Recent History ({history.length})
          </button>
        </div>

        {/* Notifications */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-center gap-2">
            <AlertTriangle className="size-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="size-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 max-h-[70vh] overflow-y-auto space-y-5">
          {/* TAB 1: TODAY'S ATTENDANCE */}
          {activeTab === 'today' && (
            <div className="space-y-5">
              {!todayRecord ? (
                /* CHECK-IN FORM */
                <Card className="border shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                      <Briefcase className="size-4 text-[#113F3D]" /> Start of Work (Check-In)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-xs text-muted-foreground">
                      Select your operational work mode for today. Note that CRM login alone does not mark you present; recording start of work captures your official shift.
                    </p>

                    <div>
                      <label className="text-xs font-medium text-foreground">Applicable Work Mode</label>
                      <div className="grid grid-cols-3 gap-3 mt-1.5">
                        <button
                          type="button"
                          data-testid="workmode-office"
                          onClick={() => setCheckInMode('office')}
                          className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border text-xs font-medium transition-all ${
                            checkInMode === 'office'
                              ? 'border-[#113F3D] bg-emerald-50/40 text-[#113F3D] ring-2 ring-[#113F3D]/20'
                              : 'border-border bg-card text-muted-foreground hover:border-foreground/30'
                          }`}
                        >
                          <Briefcase className="size-5" />
                          <span>Office</span>
                        </button>
                        <button
                          type="button"
                          data-testid="workmode-wfh"
                          onClick={() => setCheckInMode('wfh')}
                          className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border text-xs font-medium transition-all ${
                            checkInMode === 'wfh'
                              ? 'border-[#113F3D] bg-blue-50/40 text-[#113F3D] ring-2 ring-[#113F3D]/20'
                              : 'border-border bg-card text-muted-foreground hover:border-foreground/30'
                          }`}
                        >
                          <Home className="size-5" />
                          <span>WFH</span>
                        </button>
                        <button
                          type="button"
                          data-testid="workmode-field"
                          onClick={() => setCheckInMode('field')}
                          className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border text-xs font-medium transition-all ${
                            checkInMode === 'field'
                              ? 'border-[#113F3D] bg-amber-50/40 text-[#113F3D] ring-2 ring-[#113F3D]/20'
                              : 'border-border bg-card text-muted-foreground hover:border-foreground/30'
                          }`}
                        >
                          <MapPin className="size-5" />
                          <span>Field / Client Visit</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex items-start gap-2 pt-1">
                      <input
                        type="checkbox"
                        id="chk-offline"
                        checked={checkInOffline}
                        onChange={(e) => setCheckInOffline(e.target.checked)}
                        className="mt-0.5 rounded border-input size-4 text-[#113F3D]"
                      />
                      <label htmlFor="chk-offline" className="text-xs text-foreground cursor-pointer">
                        <span className="font-semibold">Work performed offline or outside CRM</span>
                        <span className="block text-muted-foreground text-[11px]">
                          Protects from absence flags when work involves offline financial reviews, client visits, or non-CRM documents.
                        </span>
                      </label>
                    </div>

                    <Button
                      onClick={handleCheckIn}
                      disabled={loading}
                      className="w-full bg-[#113F3D] hover:bg-[#113F3D]/90 text-white font-medium text-xs h-9"
                    >
                      {loading ? 'Recording...' : `Record Start of Work (${checkInMode.toUpperCase()})`}
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                /* ACTIVE RECORD & CHECK-OUT */
                <div className="space-y-4">
                  <Card className="border border-emerald-200/60 bg-emerald-50/20 shadow-sm p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs uppercase font-bold tracking-wider text-muted-foreground">Today's Shift</span>
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[11px] font-semibold">
                            {todayRecord.workMode.toUpperCase()}
                          </Badge>
                          <Badge className="text-[11px] font-medium border-muted">
                            Status: {todayRecord.status}
                          </Badge>
                        </div>
                        <h3 className="text-base font-bold text-foreground mt-1">
                          Started at {new Date(todayRecord.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Location: {todayRecord.workLocationName || 'Configured Location'} · {todayRecord.workDate}
                        </p>
                      </div>
                      {todayRecord.checkOutAt && (
                        <div className="text-right">
                          <span className="text-xs uppercase font-bold text-muted-foreground">Total Hours</span>
                          <div className="text-lg font-bold text-foreground">{todayRecord.totalHours} hrs</div>
                        </div>
                      )}
                    </div>

                    {todayRecord.isOfflineWork && (
                      <div className="mt-3 p-2 rounded bg-amber-50 border border-amber-200/60 text-[11px] text-amber-900 flex items-center gap-1.5">
                        <Briefcase className="size-3.5 text-amber-700 shrink-0" />
                        <span>Work marked as offline / client-facing. Low CRM activity will not affect attendance.</span>
                      </div>
                    )}
                  </Card>

                  {!todayRecord.checkOutAt ? (
                    <Card className="border shadow-sm">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                          <Clock className="size-4 text-[#113F3D]" /> End of Work (Check-Out)
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {todayRecord.workMode === 'wfh' && (
                          <div>
                            <label className="text-xs font-medium text-foreground">
                              WFH Deliverables & Progress Summary <span className="text-destructive">*</span>
                            </label>
                            <Textarea
                              data-testid="wfh-checkout-summary"
                              value={checkOutSummary}
                              onChange={(e) => setCheckOutSummary(e.target.value)}
                              placeholder="Describe deliverables achieved today (e.g. reviewed 5 investment proposals, updated financial models)..."
                              className="mt-1 text-xs"
                              rows={3}
                            />
                          </div>
                        )}

                        <div>
                          <label className="text-xs font-medium text-foreground">
                            Work Evidence / Artifact Link (Optional)
                          </label>
                          <Input
                            type="url"
                            value={checkOutEvidenceUrl}
                            onChange={(e) => setCheckOutEvidenceUrl(e.target.value)}
                            placeholder="https://drive.finverse.demo/deliverables-today"
                            className="mt-1 text-xs"
                          />
                        </div>

                        <Button
                          data-testid="checkout-submit-btn"
                          onClick={handleCheckOut}
                          disabled={loading || (todayRecord.workMode === 'wfh' && !checkOutSummary.trim())}
                          className="w-full bg-[#113F3D] hover:bg-[#113F3D]/90 text-white font-medium text-xs h-9"
                        >
                          {loading ? 'Submitting...' : 'Record End of Work & Check-Out'}
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="p-3 rounded-lg bg-muted/40 text-center text-xs text-muted-foreground">
                      You have completed your shift and checked out at{' '}
                      {new Date(todayRecord.checkOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PROGRESS UPDATES */}
          {activeTab === 'progress' && (
            <div className="space-y-4">
              <Card className="border shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                    <Plus className="size-4 text-[#113F3D]" /> Log Shift Deliverable / Progress Update
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-foreground">Deliverable Title</label>
                    <Input
                      value={progressTitle}
                      onChange={(e) => setProgressTitle(e.target.value)}
                      placeholder="e.g. HNI Portfolio allocation sheet review"
                      className="mt-1 text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-foreground">Completion ({progressPct}%)</label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={progressPct}
                        onChange={(e) => setProgressPct(Number(e.target.value))}
                        className="w-full mt-2"
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-4">
                      <input
                        type="checkbox"
                        id="prog-offline"
                        checked={progressOffline}
                        onChange={(e) => setProgressOffline(e.target.checked)}
                        className="rounded border-input size-4 text-[#113F3D]"
                      />
                      <label htmlFor="prog-offline" className="text-xs text-foreground cursor-pointer font-medium">
                        Offline deliverable
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-foreground">Notes / Discussion Details</label>
                    <Textarea
                      value={progressNotes}
                      onChange={(e) => setProgressNotes(e.target.value)}
                      placeholder="Any relevant context on client meetings or offline work performed..."
                      className="mt-1 text-xs"
                      rows={2}
                    />
                  </div>
                  <Button
                    onClick={handleAddProgressLog}
                    disabled={loading || !progressTitle.trim()}
                    className="w-full bg-[#113F3D] hover:bg-[#113F3D]/90 text-white font-medium text-xs h-9"
                  >
                    {loading ? 'Saving...' : 'Add Progress Update'}
                  </Button>
                </CardContent>
              </Card>

              {/* Progress Logs list */}
              {todayRecord?.progressLogs && todayRecord.progressLogs.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Today's Logged Updates</h4>
                  {todayRecord.progressLogs.map((log) => (
                    <div key={log.id} className="p-3 rounded-lg border border-border bg-card text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground">{log.deliverableTitle}</span>
                        <Badge className="bg-muted text-muted-foreground text-[10px]">{log.deliverableProgressPct}% done</Badge>
                      </div>
                      {log.notes && <p className="text-muted-foreground text-[11px]">{log.notes}</p>}
                      <div className="text-[10px] text-muted-foreground pt-1">
                        Logged at {new Date(log.loggedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {log.isOfflineDeliverable && ' · Offline Deliverable'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: REGULARIZATION & EXCEPTIONS */}
          {activeTab === 'regularize' && (
            <div className="space-y-4">
              <Card className="border shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                    <ShieldCheck className="size-4 text-[#113F3D]" /> Request Attendance Regularization
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    If you missed checking in/out, were on field visits without network, or have an inconsistent record, submit an auditable correction for your supervisor's review.
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-foreground">Work Date</label>
                      <Input
                        type="date"
                        value={regDate}
                        onChange={(e) => setRegDate(e.target.value)}
                        className="mt-1 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-foreground">Requested Mode</label>
                      <select
                        value={regMode}
                        onChange={(e) => setRegMode(e.target.value as any)}
                        className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm"
                      >
                        <option value="office">Office</option>
                        <option value="wfh">WFH</option>
                        <option value="field">Field / Client Visit</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-foreground">Check-In Time</label>
                      <Input
                        type="time"
                        value={regInTime}
                        onChange={(e) => setRegInTime(e.target.value)}
                        className="mt-1 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-foreground">Check-Out Time</label>
                      <Input
                        type="time"
                        value={regOutTime}
                        onChange={(e) => setRegOutTime(e.target.value)}
                        className="mt-1 text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-foreground">
                      Reason for Missed / Inconsistent Entry <span className="text-destructive">*</span>
                    </label>
                    <Textarea
                      value={regReason}
                      onChange={(e) => setRegReason(e.target.value)}
                      placeholder="Provide specific reason (e.g. client meeting at offshore location, network unavailability)..."
                      className="mt-1 text-xs"
                      rows={2}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-foreground">Progress & Deliverables Summary</label>
                    <Input
                      value={regProgress}
                      onChange={(e) => setRegProgress(e.target.value)}
                      placeholder="Summary of tasks completed during this period..."
                      className="mt-1 text-xs"
                    />
                  </div>

                  <Button
                    onClick={handleRegularization}
                    disabled={loading || !regReason.trim()}
                    className="w-full bg-[#113F3D] hover:bg-[#113F3D]/90 text-white font-medium text-xs h-9"
                  >
                    {loading ? 'Submitting...' : 'Submit to Supervisor'}
                  </Button>
                </CardContent>
              </Card>

              {/* Pending Regularizations */}
              {pendingRegs.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pending Regularization Requests</h4>
                  {pendingRegs.map((r) => (
                    <div key={r.id} className="p-3 rounded-lg border border-amber-200 bg-amber-50/40 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground">Date: {r.workDate} ({r.requestedWorkMode.toUpperCase()})</span>
                        <Badge className="bg-amber-100 text-amber-800 text-[10px] font-semibold">Pending Supervisor</Badge>
                      </div>
                      <p className="text-muted-foreground text-[11px]"><span className="font-medium text-foreground">Reason:</span> {r.reason}</p>
                      <p className="text-[10px] text-muted-foreground">
                        Assigned Approver: {r.supervisorName || r.supervisorEmployeeId}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: RECENT HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              {history.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  No attendance records found for this period.
                </div>
              ) : (
                <div className="divide-y divide-border rounded-lg border border-border bg-card">
                  {history.map((h) => (
                    <div key={h.id} className="p-3 text-xs flex items-center justify-between hover:bg-muted/20">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">{h.workDate}</span>
                          <Badge className="text-[10px] font-medium border-muted">
                            {h.workMode.toUpperCase()}
                          </Badge>
                          {h.isOfflineWork && (
                            <Badge className="text-[10px] bg-muted/60 text-muted-foreground">Offline Work</Badge>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {new Date(h.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {h.checkOutAt && ` - ${new Date(h.checkOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                          {h.totalHours && ` · ${h.totalHours} hrs`}
                        </div>
                      </div>
                      <div>
                        <Badge
                          className={`text-[11px] font-semibold ${
                            h.status === 'confirmed'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              : h.status === 'pending_confirmation'
                              ? 'bg-amber-100 text-amber-800 border-amber-200'
                              : 'bg-rose-100 text-rose-800 border-rose-200'
                          }`}
                        >
                          {h.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border bg-muted/20 px-6 py-3 flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
