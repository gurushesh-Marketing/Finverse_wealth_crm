-- Migration 0035: Reconcile CEO Enterprise Targets across all 4 operational verticals
-- Aligns company_targets with Wealth (EMP-009), Banking (EMP-020), Markets (EMP-025), and Real Estate (EMP-030)

UPDATE company_targets
SET
  total_revenue_target = 170000000,
  total_wins_target = 1500,
  unallocated_revenue_buffer = 5000000,
  unallocated_wins_buffer = 100,
  vertical_allocations = jsonb_build_array(
    jsonb_build_object(
      'vertical', 'wealth',
      'nmEmployeeId', 'EMP-009',
      'nmName', 'Vikram Malhotra',
      'revenueTarget', 75000000,
      'winsTarget', 500
    ),
    jsonb_build_object(
      'vertical', 'banking',
      'nmEmployeeId', 'EMP-020',
      'nmName', 'Suresh Nair',
      'revenueTarget', 45000000,
      'winsTarget', 300
    ),
    jsonb_build_object(
      'vertical', 'markets',
      'nmEmployeeId', 'EMP-025',
      'nmName', 'Sanjay Singhania',
      'revenueTarget', 25000000,
      'winsTarget', 400
    ),
    jsonb_build_object(
      'vertical', 'real_estate',
      'nmEmployeeId', 'EMP-030',
      'nmName', 'Aditya Singhania',
      'revenueTarget', 20000000,
      'winsTarget', 200
    )
  ),
  status = 'approved_by_ceo'
WHERE period_label = 'October' AND fiscal_year = 'FY2026-27';
