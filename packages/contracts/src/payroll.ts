import { z } from 'zod';

export const DivisorFormulaPolicySchema = z.enum([
  '30_day_fixed',
  'applicable_working_days',
  'calendar_days',
]);
export type DivisorFormulaPolicy = z.infer<typeof DivisorFormulaPolicySchema>;

export const CreateCompensationPlanInputSchema = z.object({
  employee_id: z.string().min(1, 'Employee ID is required'),
  effective_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'effective_from must be YYYY-MM-DD'),
  effective_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'effective_to must be YYYY-MM-DD').nullable().optional(),
  monthly_ctc: z.number().positive('Monthly CTC must be greater than 0'),
  basic_pay: z.number().positive('Basic pay must be greater than 0'),
  hra: z.number().min(0, 'HRA cannot be negative'),
  special_allowance: z.number().min(0, 'Special allowance cannot be negative'),
  statutory_pf_employee: z.number().min(0).default(1800),
  statutory_pf_employer: z.number().min(0).default(1800),
  professional_tax: z.number().min(0).default(200),
  tds_estimate: z.number().min(0).default(0),
  notes: z.string().optional(),
  reason: z.string().min(5, 'Reason for compensation change is mandatory for audit trail'),
});
export type CreateCompensationPlanInput = z.infer<typeof CreateCompensationPlanInputSchema>;

export const CompensationPlanRecordSchema = z.object({
  id: z.string(),
  employee_id: z.string(),
  employee_name: z.string().optional(),
  role: z.string().optional(),
  vertical: z.string().optional(),
  team_name: z.string().optional(),
  joining_date: z.string().optional(),
  effective_from: z.string(),
  effective_to: z.string().nullable(),
  currency: z.string(),
  monthly_ctc: z.number(),
  basic_pay: z.number(),
  hra: z.number(),
  special_allowance: z.number(),
  statutory_pf_employee: z.number(),
  statutory_pf_employer: z.number(),
  professional_tax: z.number(),
  tds_estimate: z.number(),
  notes: z.string().nullable(),
  created_by_employee_id: z.string(),
  created_at: z.string(),
  record_version: z.number(),
});
export type CompensationPlanRecord = z.infer<typeof CompensationPlanRecordSchema>;

export const CompensationAuditRecordSchema = z.object({
  id: z.string(),
  plan_id: z.string(),
  employee_id: z.string(),
  changed_by_employee_id: z.string(),
  changed_by_name: z.string().optional(),
  action: z.enum(['created', 'revised', 'closed']),
  previous_state: z.record(z.any()).nullable(),
  new_state: z.record(z.any()).nullable(),
  reason: z.string(),
  created_at: z.string(),
});
export type CompensationAuditRecord = z.infer<typeof CompensationAuditRecordSchema>;

export const PayrollCycleRecordSchema = z.object({
  id: z.string(),
  cycle_code: z.string(),
  cycle_label: z.string(),
  period_start_date: z.string(),
  period_end_date: z.string(),
  total_calendar_days: z.number(),
  status: z.enum(['preview', 'policy_blocked', 'locked', 'certified']),
  is_initial_joiner_cycle: z.boolean(),
  unresolved_policy_gates: z.object({
    first_payment_date_confirmed: z.boolean(),
    divisor_formula_confirmed: z.boolean(),
    statutory_rules_confirmed: z.boolean(),
    leave_pay_rules_confirmed: z.boolean(),
  }),
  policy_block_notes: z.string(),
  created_at: z.string(),
});
export type PayrollCycleRecord = z.infer<typeof PayrollCycleRecordSchema>;

export const PayrollPreviewQuerySchema = z.object({
  cycle_code: z.string().default('2026-01-STD'),
  divisor_policy: DivisorFormulaPolicySchema.default('30_day_fixed'),
  vertical: z.enum(['all', 'wealth', 'banking', 'markets', 'real_estate']).default('all'),
  team_id: z.string().optional(),
  employee_id: z.string().optional(),
});
export type PayrollPreviewQuery = z.infer<typeof PayrollPreviewQuerySchema>;

export const PayrollPreviewItemSchema = z.object({
  employee_id: z.string(),
  employee_name: z.string(),
  role: z.string(),
  vertical: z.string(),
  team_name: z.string(),
  work_location: z.string(),
  joining_date: z.string(),
  is_mid_cycle_joiner: z.boolean(),
  active_employment_days_in_cycle: z.number(),
  cycle_calendar_days: z.number(),
  scheduled_working_days: z.number(),
  attended_days: z.number(),
  approved_paid_leave_days: z.number(),
  holiday_days: z.number(),
  weekly_off_days: z.number(),
  covered_payable_days: z.number(),
  unexcused_lop_days: z.number(),
  selected_divisor_policy: DivisorFormulaPolicySchema,
  divisor_used: z.number(),
  pro_rata_factor: z.number(),
  monthly_ctc: z.number(),
  basic_pay_rate: z.number(),
  hra_rate: z.number(),
  special_allowance_rate: z.number(),
  earned_basic: z.number(),
  earned_hra: z.number(),
  earned_special_allowance: z.number(),
  gross_payable: z.number(),
  statutory_deductions: z.object({
    pf_employee: z.number(),
    professional_tax: z.number(),
    tds_estimate: z.number(),
    total_deductions: z.number(),
  }),
  net_payable_preview: z.number(),
  calculation_notes: z.array(z.string()),
  policy_warnings: z.array(z.string()),
});
export type PayrollPreviewItem = z.infer<typeof PayrollPreviewItemSchema>;

export const PayrollPreviewResponseSchema = z.object({
  cycle: PayrollCycleRecordSchema,
  selected_divisor_policy: DivisorFormulaPolicySchema,
  items: z.array(PayrollPreviewItemSchema),
  summary: z.object({
    total_employees: z.number(),
    mid_cycle_joiners_count: z.number(),
    total_gross_payable: z.number(),
    total_statutory_deductions: z.number(),
    total_net_payable: z.number(),
  }),
  policy_gates: z.object({
    finalization_allowed: z.boolean(),
    payment_export_allowed: z.boolean(),
    gate_reasons: z.array(z.string()),
  }),
});
export type PayrollPreviewResponse = z.infer<typeof PayrollPreviewResponseSchema>;

export const FinalizePayrollInputSchema = z.object({
  cycle_code: z.string(),
  confirmed_first_pay_date: z.string().optional(),
  confirmed_divisor_policy: DivisorFormulaPolicySchema.optional(),
  legal_confirmation_token: z.string().optional(),
});
export type FinalizePayrollInput = z.infer<typeof FinalizePayrollInputSchema>;
