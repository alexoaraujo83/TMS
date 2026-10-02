# TMS — Restore Verification #27

**Data:** 2026-10-02  
**Workflow run:** `36998353645`  
**Job:** `Restore verification against isolated target`  
**Job ID:** `110810127852`  
**Branch:** `main`  
**Commit:** `704ee14e0edb30e2703407ba67d12f9c517cbcfe`  
**Resultado:** **PASS / VERIFIED**

## Evidência

O workflow fez checkout explícito do SHA `704ee14e0edb30e2703407ba67d12f9c517cbcfe` e executou a verificação contra um target isolado.

| Controle | Resultado |
|---|---|
| PostgreSQL client | 17.11 |
| Backup namespace | validado e controlado |
| Target production/local protection | PASS |
| Backup manifest | VERIFIED |
| SHA-256 | VERIFIED — `d1e1f7f5daa16a1163a719b3bf14e4fedee438246389bc51ad89a9551df81a37` |
| Backup bytes | VERIFIED — 163248 |
| Decrypt | VERIFIED |
| `pg_restore` | VERIFIED |
| PostgreSQL source | 17.11 (`8a81ecb`) |
| PostgreSQL target | 17.11 (`8a81ecb`) |
| Public tables | 22 |
| Expected migrations | 39 |
| Actual migrations | 39 |
| Final restore status | **VERIFIED** |

## Fluxo executado

```text
main @ 704ee14e
  -> checkout exact SHA
  -> PostgreSQL 17 client
  -> validate RESTORE_DATABASE_URL
  -> validate BACKUP_OBJECT namespace
  -> reject production/local-looking target
  -> download/verify manifest
  -> verify SHA-256 and byte count
  -> decrypt backup
  -> pg_restore into isolated target
  -> verify PostgreSQL source/target version
  -> verify 22 public tables
  -> verify 39 migrations
  -> restore_status=verified
```

## Conclusão

Este run comprova a cadeia de recuperação em target isolado: **manifesto + integridade + descriptografia + restauração + validação estrutural + validação do migration head**.

O resultado deve ser classificado como **OPS-03 — Isolated Restore Verification: PASS**.

Esta evidência não substitui os gates de RPO/RTO, retention/ownership ou restore drill recorrente. Também não valida alterações ainda não mergeadas do PR #121.

## Segurança da evidência

Os logs mascaram secrets e não devem ser copiados para documentação. Esta evidência registra somente metadados técnicos não secretos necessários para auditoria.
