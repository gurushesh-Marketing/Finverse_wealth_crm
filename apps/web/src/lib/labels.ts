const OVERRIDES: Record<string, string> = {
  'voice-call': 'Voice call',
  'whatsapp-message': 'WhatsApp',
  'manual-activity': 'Manual activity',
  'follow-up': 'Follow-up',
  meeting: 'Meeting',
  'document-request': 'Document request',
  other: 'Task',
  reminder_sent: 'Reminder sent',
  'reminder scheduled': 'Reminder scheduled',
  'inbound whatsapp': 'Inbound WhatsApp',
  'inbound voice': 'Missed call',
  'not-contacted': 'Not contacted',
  'scheduled': 'Scheduled',
  'pending-approval': 'Pending approval',
  'pending-review': 'Pending review',
  'no-answer': 'No answer',
  'wrong-number': 'Wrong number',
  'callback-requested': 'Promised callback',
};

export function label(token?: string | null): string {
  if (!token) return '';
  const hit = OVERRIDES[token];
  if (hit) return hit;
  return token.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
