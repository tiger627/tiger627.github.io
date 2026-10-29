---
title: "The Data Was There. The Reports Were Empty: A Fabric Ownership Incident"
author: Tiger An
pubDatetime: 2026-10-29T08:00:00.000Z
slug: fabric-sql-endpoint-ownership-empty-reports
featured: false
draft: false
tags:
  - Microsoft Fabric
  - Lakehouse
  - SQL Analytics Endpoint
  - Entra ID
  - ETL
  - Dynamics 365 F&O
description: An MWC token error taught me that the Lakehouse reading the data doesn't mean the SQL analytics endpoint can — and that TRUNCATE before a source read turns an auth glitch into a production incident.
---

Today one of our production Fabric pipelines suddenly started failing with this:

**"Retrieval of MWC token used for accessing storage failed… There is a problem with the Microsoft Entra ID token. Have the warehouse owner log in again. If they're unavailable, use the takeover feature."**

At first glance it looked like a pipeline or Warehouse connection issue. It wasn't — and the way it failed taught me two lessons.

## Testing layer by layer

Our setup is simple: Dynamics 365 F&O data lands in a Fabric Lakehouse, and a Warehouse-based ETL reads it through the Lakehouse's SQL analytics endpoint to rebuild the reporting tables.

Instead of treating "the pipeline failed" as one problem, I tested each layer on its own:

| Layer                  | Test                                          | Result                        |
| ---------------------- | --------------------------------------------- | ----------------------------- |
| Source → Lakehouse     | Is the D365 F&O data landed?                  | ✅ Available                  |
| Lakehouse              | Open it and browse the tables                 | ✅ Accessible                 |
| Warehouse              | Query the Warehouse itself                    | ✅ Working normally           |
| SQL analytics endpoint | Query the **same** Lakehouse tables via T-SQL | ❌ MWC / Entra ID token error |

So the data was there. The Lakehouse was accessible. But the SQL analytics endpoint could not reach the Lakehouse storage.

## The clue: ownership

The error message itself was the hint — _"have the owner log in again … use the takeover feature."_

The Lakehouse was owned by another user. In delegated identity mode, the SQL analytics endpoint connects to OneLake **using the identity of the item owner**, not the person running the query ([Microsoft Learn](https://learn.microsoft.com/fabric/onelake/security/sql-analytics-endpoint-onelake-security), as of 2026-10). When that owner's Entra ID token can no longer be obtained, the endpoint can't get the storage (MWC) token it needs — even though anyone else can still open the Lakehouse in the browser without a problem.

Microsoft documents the typical trigger: if an owner leaves the organization or **doesn't sign in for more than 90 days**, items they own may stop working correctly ([Take ownership of Fabric items](https://learn.microsoft.com/fabric/fundamentals/item-ownership-take-over)).

That's why the failure showed up on exactly one query path.

## The fix

Take over ownership of the Lakehouse:

1. Open the **Lakehouse** settings (the parent item — child items like the SQL analytics endpoint can't be taken over directly; they follow the parent).
2. In the **About** tab, select **Take over**.
3. Re-run a simple `SELECT` through the SQL analytics endpoint to confirm storage access is back.
4. Re-run the pipeline and check the reporting tables.

Note that the portal's Take over always assigns ownership to _you_, the signed-in user. It doesn't fix the underlying design problem — it just moves the dependency to another person.

## The bigger lesson: TRUNCATE first, read second

Our ETL did this:

1. `TRUNCATE` the target tables — ✅ succeeded
2. Read the source through the SQL analytics endpoint — ❌ failed
3. Insert into the targets — never ran

The result: **the production reporting tables were left empty.** A temporary authentication issue had become a production data incident.

A safer pattern is to prove the source is readable first, load into staging, and only replace the target once the new data is in hand:

```sql
-- 1. Fail fast: confirm the source is readable and not empty
DECLARE @src_rows BIGINT;

SELECT @src_rows = COUNT_BIG(*)
FROM   [MyLakehouse].[dbo].[SourceTable];

IF @src_rows = 0
    THROW 50001, 'Source is empty or unreadable - aborting load.', 1;

-- 2. Load into staging first
TRUNCATE TABLE dbo.Stg_Target;

INSERT INTO dbo.Stg_Target
SELECT *
FROM   [MyLakehouse].[dbo].[SourceTable];

-- 3. Replace the target only after staging is populated
BEGIN TRANSACTION;

    DELETE FROM dbo.Target;

    INSERT INTO dbo.Target
    SELECT * FROM dbo.Stg_Target;

COMMIT TRANSACTION;
```

If the read in step 1 or 2 fails, the reporting tables keep yesterday's data instead of going blank. Stale beats empty.

## Takeaways

👉 **Troubleshoot Fabric layer by layer.**
Pipeline → Warehouse → SQL analytics endpoint → Lakehouse → OneLake. The Lakehouse reading the data doesn't mean the SQL analytics endpoint can.

👉 **Treat item ownership as a production dependency.**
Production items owned by a personal account will break when that person goes quiet for 90 days or leaves. It's the same reason I argued for keyless, non-personal identities in my article on [Workspace Identity](https://tiger627.github.io/posts/fabric-workspace-identity-three-doors/).

👉 **Validate the source before any destructive step.**
`TRUNCATE` followed by a failed read is how a transient auth error empties your reports.

In modern data platforms, _data availability_ and _data access through a specific query path_ are not the same thing.

Who owns the Lakehouses behind your production reports right now? Worth a two-minute check.
