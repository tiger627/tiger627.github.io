---
title: "Power BI Development: Best Practices & Notes from the Field"
author: Tiger An
pubDatetime: 2026-06-03T00:00:00.000Z
slug: power-bi-best-practices
featured: true
draft: false
tags:
  - Power BI
  - Best Practices
  - DAX
  - Data Modeling
description: A practical guide to building reliable, maintainable, and high-quality Power BI solutions — covering data modeling, DAX, report design, and delivery.
---

After years of building Power BI solutions for real clients, I keep coming back to the same lessons. This article is my attempt to consolidate them — not as a list of rigid rules, but as principles that hold up across most projects.

Much of what follows is informed by the excellent writing at [Data Goblins](https://data-goblins.com/articles), combined with my own experience building reports on top of Dynamics 365 Finance & Operations data.

---

## 1. The Right Mindset: Best Practices vs. Optimizations

Before diving in, it's worth distinguishing two things people often conflate:

**Best practices** are recognized standards that apply broadly — naming conventions, hiding unused fields, formatting DAX. These are reasonable defaults you should follow unless you have a specific reason not to.

**Optimization techniques** are situational. Things like disabling referential integrity, switching storage modes, or restructuring relationships may help in one model and hurt in another. These require testing and evidence — not assumption.

> "Optimization techniques must not be considered as default options or standards."  
> — Data Goblins, *"It Depends"*

The practical implication: don't cargo-cult settings you read about in a blog post (including this one). Test in your specific context. Measure before and after. Compare averages, not single runs.

---

## 2. Data Modeling

Good models are the foundation of everything. A well-structured semantic model makes DAX easier to write, reports faster to build, and mistakes harder to make.

### Star Schema First

Always start with a star schema: fact tables connected to dimension tables via single-column relationships. Avoid snowflake schemas where possible — the extra joins add complexity without meaningful benefit in Power BI's columnar engine.

- Keep fact tables narrow (only the columns you actually need)
- Keep dimension tables wide (denormalize where it makes sense for usability)
- One relationship per table pair — avoid role-playing dimensions unless necessary

### Naming Conventions

Inconsistent naming is one of the biggest sources of confusion in inherited models. Establish conventions before you start and stick to them:

- Use `PascalCase` or `Sentence case` consistently for table and column names
- Prefix measures with a category if you have many (e.g., `CM1 Margin`, `CM2 Margin`)
- Never leave default Power Query step names like `Merged Queries` or `Changed Type1`

### Hide What Users Don't Need

Every column that's visible in the field list is a potential source of confusion for report builders. Hide:

- Foreign key columns (e.g., `CustomerID` when `CustomerName` is available)
- Technical columns used only in relationships or calculations
- Any intermediate columns created during transformation

Use **display folders** to organize measures and columns into logical groups. This alone dramatically improves the experience for anyone building reports on top of your model.

### Disable Implicit Measures

Set **Summarize By = None** on all numeric data columns. Implicit measures (where Power BI auto-aggregates a column) produce unpredictable results and bypass your DAX logic. Force users to use your explicit measures.

---

## 3. Power Query & Data Transformation

### Push Transformations Upstream

Every transformation you do in Power Query is work Power BI has to do at refresh time. If your data source supports it (SQL Server, Dataverse, etc.), filter and transform data at the source through views or stored procedures.

Ask yourself before adding a Power Query step: "Could this be done in SQL instead?"

### Verify Query Folding

Query folding means Power Query translates your steps into a native query that runs at the source — instead of pulling all data into memory and filtering locally. It's critical for performance on large tables.

Check folding by right-clicking a step: if "View Native Query" is available, folding is active. The moment you apply a step that breaks folding, all subsequent steps run locally.

Common folding breakers:
- Merging tables from different data sources
- Custom functions
- Some date/time operations

### Keep Queries Clean

- Disable loading on staging/intermediate queries (they exist only to support other queries)
- Parameterize repeated values — connection strings, date thresholds, environment names
- Name every step meaningfully
- Configure error handling on critical steps so refresh failures are clear, not silent

---

## 4. DAX

### Measures Over Calculated Columns

Use measures (calculated at query time) instead of calculated columns (calculated at refresh time) wherever possible. Calculated columns:

- Consume model memory permanently
- Are recalculated on every refresh
- Can't respond to slicer context

The main legitimate use for calculated columns is when you need to slice or filter by a calculated value.

### Format All DAX

Unformatted DAX is a maintenance nightmare. Use [daxformatter.com](https://www.daxformatter.com/) or Tabular Editor's built-in formatter to format every measure before you commit it. This is non-negotiable for team projects.

### Use Variables

DAX variables (`VAR ... RETURN`) improve both readability and performance — the expression is only evaluated once, and the intent of the code becomes clear.

```dax
CM1 Margin % =
VAR Revenue = [Revenue]
VAR CM1 = [CM1 Margin]
RETURN
    DIVIDE(CM1, Revenue)
```

### Comment Complex Logic

You don't need to comment every measure. But when a measure has a non-obvious business rule, a workaround for a data quality issue, or a trick to handle a specific edge case — write it down:

```dax
-- Exclude intercompany transactions (entity 999) per finance team agreement
CM2 Margin =
CALCULATE(
    [CM1 Margin] - [Overhead Allocation],
    FILTER(...)
)
```

### Benchmark Performance

Use [DAX Studio](https://daxstudio.org/) to profile slow measures. Key things to look at:

- **Storage Engine (SE) vs. Formula Engine (FE)** queries — SE is fast and parallel; FE is single-threaded and slower
- **Materialization size** — large intermediate tables are a common culprit
- **Cold vs. warm cache** — test with cold cache to simulate real-world first load

---

## 5. Report Design

### Know Your Audience First

Before opening Power BI Desktop, answer these questions:

- Who are the users, and what decisions do they make?
- What specific questions does this report answer?
- What devices do they use (desktop, mobile, Teams)?
- How data-literate is this audience?

A report built without this clarity will be redesigned. A requirements conversation takes 30 minutes. A redesign takes days.

### The 3/30/300 Rule

Design for three reading distances:

- **3 seconds** — What is this report about? The title, key number, and status should be immediately obvious
- **30 seconds** — What's the key story? Primary charts and trends should be readable at a glance
- **3 minutes** — What are the details? Drilldowns, filters, and supporting tables for deeper investigation

If something isn't visible at the right "distance," it's in the wrong place.

### Visual Choices

- Start axes at zero unless you have a deliberate reason not to — truncated axes mislead
- Set default sort on every visual; don't leave it at alphabetical
- Avoid pie charts for more than 3-4 categories
- Use color purposefully — one accent color for the most important element, grey for context

### Performance

Use the **Performance Analyzer** (View → Performance Analyzer) to identify slow visuals. Common fixes:

- Reduce the number of visuals per page (aim for under 15)
- Use aggregated data where possible — avoid high-cardinality columns in visuals
- Avoid bidirectional relationships unless genuinely necessary
- Consider **Aggregations** for large fact tables

### Document Visual-Level Filters

Visual-level filters are invisible to users and easy to forget. They're one of the most common sources of "why is this number different here?" confusion. Always document:

- What visual-level filters are applied and why
- Any hidden slicers affecting page behavior
- Bookmark logic

---

## 6. Reporting Objects: Keep Them Separate

Measures created specifically for a visual — color logic, SVG sparklines, dynamic titles, field parameters — are "reporting objects." They belong to the report layer, not the core semantic model.

Best practices for managing them:

- **Name them distinctly** — use a prefix or suffix (e.g., `[_Color Sales]`)
- **Group them** in a dedicated display folder or measure table (e.g., `_Report Layer`)
- **Hide them** at minimum; set the table to Private if using Tabular Editor to prevent them showing in intellisense
- **Document their context** — a measure that controls bar chart color makes no sense without knowing which chart it's for

If your dataset is shared (used by multiple report authors), this discipline is essential. Reporting objects used outside their intended visual will produce wrong results or just confuse people.

---

## 7. Quality: The REAPER Framework

The best summary of what "quality" means in a Power BI solution I've encountered is the **REAPER** framework from Data Goblins:

| Letter | Principle | In Practice |
|--------|-----------|-------------|
| **R** | Reliable | Validated results, consistent refresh, no silent failures |
| **E** | Efficient | No redundant transformations, optimized DAX, lean model |
| **A** | Automated | Scheduled refresh, automated testing, no manual data steps |
| **P** | Polished | Consistent formatting, professional layout, display folders |
| **E** | Easy to Use | Users find answers without asking developers |
| **R** | Robust | Handles new data, schema changes, and edge cases gracefully |

Quality isn't just about the data being correct. It's about the full lifecycle — from source to development to delivery to ongoing maintenance.

---

## 8. Designing for Your Future Self

The developer who inherits your model in 12 months might be you. Design accordingly.

**Do these things during development, not after:**

- Format DAX as you write it
- Add display folders when you create a measure, not at the end
- Write comments on complex logic while the context is fresh
- Document every non-obvious decision — why you chose a particular relationship, why a measure has an unusual filter

**Handover checklist essentials:**

- Clear naming across all tables, columns, measures, and queries
- Descriptions on non-obvious fields
- A diagram layout showing the model structure
- Documentation of manual interventions or workarounds
- A list of known limitations and edge cases
- Test cases with expected values

> "It's essential that others can use and understand the things you make with minimal effort and time investment; that's part of what makes a quality solution."

---

## 9. Governance & Environment Management

### Use Separate Workspaces

At minimum: a **Development** workspace and a **Production** workspace. Ideally: Dev → Test → Prod.

This prevents unfinished changes from reaching users, gives you a safe space to experiment, and makes rollbacks possible.

### Version Control

Use **PBIP format** (Power BI Projects) to store your semantic model as source files and track changes in Git. This enables:

- Diffing changes between versions
- Rolling back to a previous state
- Collaborative development without overwriting each other's work
- Code review before publishing

Once you've worked with version control for a semantic model, going back to opaque `.pbix` files feels like developing without saving.

### Best Practice Analyzer

Tabular Editor's Best Practice Analyzer runs a set of configurable rules against your model and flags issues — hidden columns without display folders, measures without format strings, relationships with incorrect cardinality settings, etc.

Run it before every release. Treat warnings as mandatory review items.

---

## 10. The Most Important Thing

None of the above matters if you don't understand the business problem you're solving. The best-modeled, best-coded, best-designed report that answers the wrong question is a failed project.

Talk to users. Watch them use the report. Ask what decisions they make with it. Find out what they don't trust and why.

Technical quality is necessary but not sufficient. The goal is a solution that gets used, gets trusted, and helps people make better decisions.

---

*Most of the practices here are drawn from or inspired by [Data Goblins](https://data-goblins.com/articles) — one of the most practical and honest Power BI resources available. Highly recommended reading.*
