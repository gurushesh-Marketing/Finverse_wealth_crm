-- Dedicated non-login actor for audited, date-effective caller reassignment.
INSERT INTO employees (id, email, password_hash, display_name, status)
VALUES ('EMP-SYSTEM-ROUTING', 'routing-system@finverse.invalid', 'disabled-system-account',
        'Automatic Lead Routing', 'disabled')
ON CONFLICT (id) DO NOTHING;
