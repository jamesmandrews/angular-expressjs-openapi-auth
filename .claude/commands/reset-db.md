---
description: Clear all users and related data from the database
---

Clear all users and related data from the PostgreSQL database by running:

```bash
docker exec auth-api-postgres psql -U authuser -d authdb -c "TRUNCATE users CASCADE;"
```

This will cascade and also clear:
- password_reset_tokens
- email_verification_tokens
- user_roles
- audit_logs
- backup_codes
- two_factor_settings

After running, confirm the truncation was successful.
