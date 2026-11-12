import { useState, type FormEvent } from 'react';
import type { FollowUpInput } from '@finverse/contracts';
import { ApiError, api } from '../../lib/api';
import { Button } from '../ui/button';
import { FieldError, Input, Label, Textarea } from '../ui/input';
import { Select } from '../ui/select';
import { SuccessNote } from '../ui/states';

const ACTION_LABELS: Record<string, string> = {
  'voice-call': 'Voice call',
  whatsapp: 'WhatsApp',
  email: 'Email',
  meeting: 'Meeting',
  'document-check': 'Document check',
  other: 'Other',
};

export function FollowUpForm({
  leadId,
  onSaved,
}: {
  leadId: string;
  onSaved: () => Promise<void> | void;
}) {
  const [action, setAction] = useState('voice-call');
  const [purpose, setPurpose] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [priority, setPriority] = useState('normal');
  const [reminder, setReminder] = useState('15');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setFormError(null);
    setConflict(null);
    const errors: Record<string, string[]> = {};
    if (purpose.trim().length < 3) errors.purpose = ['Purpose must be at least 3 characters.'];
    if (!date) errors.dueAt = ['Choose a date.'];
    if (!time) errors.dueAt = [...(errors.dueAt ?? []), 'Choose a time.'];
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setSaving(false);
      return;
    }
    const dueAt = new Date(`${date}T${time}`);
    if (Number.isNaN(dueAt.getTime()) || dueAt.getTime() <= Date.now()) {
      setFieldErrors({ dueAt: ['Due time must be in the future.'] });
      setSaving(false);
      return;
    }
    setFieldErrors({});
    const input: FollowUpInput = {
      action: action as FollowUpInput['action'],
      purpose: purpose.trim(),
      dueAt: dueAt.toISOString(),
      priority: priority as FollowUpInput['priority'],
      reminderMinutes: Number(reminder) as 5 | 15 | 30 | 60,
    };
    try {
      await api.followUp(leadId, input);
      setSaved(true);
      setPurpose('');
      await onSaved();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'VALIDATION_FAILED') setFieldErrors(err.fieldErrors ?? {});
        else if (err.code === 'DUPLICATE_OPEN_TASK') setConflict(err.message);
        else setFormError('Follow-up could not be saved. Try again.');
      } else {
        setFormError('Follow-up could not be saved. Try again.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3">
      <div>
        <Label htmlFor="fu-action">Action</Label>
        <Select id="fu-action" value={action} onChange={(e) => setAction(e.target.value)}>
          {Object.entries(ACTION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="fu-purpose">Purpose</Label>
        <Textarea
          id="fu-purpose"
          rows={2}
          value={purpose}
          placeholder="Confirm documents"
          aria-invalid={fieldErrors.purpose ? true : undefined}
          onChange={(e) => setPurpose(e.target.value)}
        />
        <FieldError>{fieldErrors.purpose?.[0]}</FieldError>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="fu-date">Due date</Label>
          <Input
            id="fu-date"
            type="date"
            value={date}
            aria-invalid={fieldErrors.dueAt ? true : undefined}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="fu-time">Due time</Label>
          <Input
            id="fu-time"
            type="time"
            value={time}
            aria-invalid={fieldErrors.dueAt ? true : undefined}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>
      </div>
      <FieldError>{fieldErrors.dueAt?.[0]}</FieldError>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="fu-priority">Priority</Label>
          <Select id="fu-priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="fu-reminder">Reminder</Label>
          <Select id="fu-reminder" value={reminder} onChange={(e) => setReminder(e.target.value)}>
            <option value="5">5 minutes before</option>
            <option value="15">15 minutes before</option>
            <option value="30">30 minutes before</option>
            <option value="60">60 minutes before</option>
          </Select>
        </div>
      </div>
      {conflict ? (
        <div role="alert" className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-accent">
          {conflict}
        </div>
      ) : null}
      {formError ? (
        <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {formError}
        </div>
      ) : null}
      {saved ? <SuccessNote>Follow-up saved. Task and timeline updated.</SuccessNote> : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={saving} aria-busy={saving}>
          {saving ? 'Saving…' : 'Save follow-up'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={saving}
          onClick={() => {
            setPurpose('');
            setDate('');
            setTime('');
            setFieldErrors({});
            setFormError(null);
            setConflict(null);
            setSaved(false);
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
