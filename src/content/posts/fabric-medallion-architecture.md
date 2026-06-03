---
title: Designing a Medallion Architecture in Microsoft Fabric for Mid-Market Companies
author: Tiger An
pubDatetime: 2024-06-03T00:00:00.000Z
slug: fabric-medallion-architecture
featured: true
draft: false
tags:
  - Microsoft Fabric
  - Data Architecture
  - Lakehouse
description: A practical guide to designing a five-workspace Medallion architecture in Microsoft Fabric, based on real client implementations.
---

When clients ask me how to structure their Microsoft Fabric environment, the answer almost always starts with one concept: **Medallion architecture**.

This post walks through the approach I use for mid-market companies — typically running Dynamics 365 Business Central or Finance & Operations — who want a clean, scalable data platform without the complexity of an enterprise data warehouse team.

## Why Medallion?

The Medallion pattern organizes data into layers, each with a clear purpose:

- **Bronze** — raw, as-landed data from source systems
- **Silver** — cleaned, conformed, and integrated data
- **Gold** — business-ready tables and aggregations for reporting

In Microsoft Fabric, each layer maps naturally to a **Lakehouse**, and the whole thing sits on **OneLake** — a single storage layer that eliminates data duplication between workspaces.
