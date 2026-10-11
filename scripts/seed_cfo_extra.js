const { Pool } = require('pg');

async function seed() {
  for (const dbName of ['finverse_test', 'finverse_crm']) {
    const p = new Pool({ connectionString: 'postgresql://finverse:mPXSxTCBd50QMJYgGND2UpHZ98fK13qn@localhost:5433/' + dbName });

    await p.query(`
      INSERT INTO sales_finance_handoffs (id, handoff_code, lead_id, vertical, sales_rep_employee_id, converted_amount, earning_milestone, supporting_evidence_url, review_status)
      VALUES
        ('SFH-001', 'SFH-2026-001', 'FV-1001', 'wealth', 'EMP-001', 500000.00, 'mandate_signed', 'https://vault.internal.finverse/mandates/singhania-mandate.pdf', 'pending_verification'),
        ('SFH-002', 'SFH-2026-002', 'FV-1004', 'banking', 'EMP-002', 1250000.00, 'kyc_cleared', 'https://vault.internal.finverse/mandates/tata-escrow.pdf', 'pending_verification')
      ON CONFLICT (id) DO NOTHING;
    `);

    await p.query(`
      INSERT INTO incentive_disputes (id, dispute_code, calculation_id, employee_id, disputed_amount, employee_claim, supporting_evidence, status)
      VALUES
        ('DISP-001', 'DISP-2026-001', 'INC-001', 'EMP-001', 25000.00, 'Client conversion credit split not credited for March HNI close', 'https://vault.internal.finverse/evidence/credit-split-email.pdf', 'open')
      ON CONFLICT (id) DO NOTHING;
    `);

    await p.query(`
      INSERT INTO forecast_finance_reviews (id, period_label, vertical, sales_projected_revenue, finance_discount_rate_pct, risk_adjusted_revenue, cash_conversion_pace_days, finance_assumptions, concurrence_status, concurred_by_employee_id)
      VALUES
        ('FFR-001', 'FY26-Q1', 'wealth', 75000000.00, 10.00, 67500000.00, 45, 'Baseline Q1 pipeline risk-adjusted concurrence', 'concurred', 'EMP-011')
      ON CONFLICT (id) DO NOTHING;
    `);

    console.log('Seeded ' + dbName);
    await p.end();
  }
}

seed().catch(console.error);
