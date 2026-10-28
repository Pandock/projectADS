custom_pg_wal:
  query: |
    SELECT count(*)::bigint AS files,
           coalesce(sum(size), 0)::bigint AS bytes
    FROM pg_ls_waldir()
  master: true
  metrics:
    - files:
        usage: "GAUGE"
        description: "Number of files in pg_wal"
    - bytes:
        usage: "GAUGE"
        description: "Total size of files in pg_wal, bytes"

custom_pg_slot:
  query: |
    SELECT slot_name,
           slot_type,
           active::int AS active,
           coalesce(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn), 0)::bigint AS retained_bytes
    FROM pg_replication_slots
  master: true
  metrics:
    - slot_name:
        usage: "LABEL"
        description: "Slot name"
    - slot_type:
        usage: "LABEL"
        description: "Slot type"
    - active:
        usage: "GAUGE"
        description: "1 if slot is active"
    - retained_bytes:
        usage: "GAUGE"
        description: "WAL retained by slot, bytes"

custom_pg_xid:
  query: |
    SELECT datname,
           age(datfrozenxid)::bigint AS xid_age,
           mxid_age(datminmxid)::bigint AS mxid_age
    FROM pg_database
    WHERE datallowconn
  master: true
  metrics:
    - datname:
        usage: "LABEL"
        description: "Database"
    - xid_age:
        usage: "GAUGE"
        description: "Age of datfrozenxid, transactions"
    - mxid_age:
        usage: "GAUGE"
        description: "Age of datminmxid, multixacts"
