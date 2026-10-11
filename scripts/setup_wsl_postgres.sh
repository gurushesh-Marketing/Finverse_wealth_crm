#!/bin/bash
set -e
sed -i "s/port = 5432/port = 5433/" /etc/postgresql/18/main/postgresql.conf
sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" /etc/postgresql/18/main/postgresql.conf
echo "host all all all trust" >> /etc/postgresql/18/main/pg_hba.conf
echo "local all all trust" >> /etc/postgresql/18/main/pg_hba.conf
service postgresql restart
su - postgres -c "psql -p 5433 -c \"CREATE USER finverse WITH SUPERUSER PASSWORD 'mPXSxTCBd50QMJYgGND2UpHZ98fK13qn';\"" || true
su - postgres -c "psql -p 5433 -c \"CREATE DATABASE finverse_crm OWNER finverse;\"" || true
su - postgres -c "psql -p 5433 -c \"CREATE DATABASE finverse_test OWNER finverse;\"" || true
echo "POSTGRES_SETUP_COMPLETE"
