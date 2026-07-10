# Plan: Sprint 9 — DB Persistence for Inventory, Buffs, Titles

**Date:** 2026-07-10 · **Status:** Approved (interview answered with recommended options) · **Executor:** Claude subagent

## Problem

`lib.rs` stubs return errors for core gameplay commands, breaking the Shop and Inventory pages:
- `purchase_item` / `use_item` / `get_inventory` — inventory system stubbed (`lib.rs:704-710`)
- `get_user_titles` / `equip_title` / `unequip_title` — title system stubbed (`lib.rs:772-784`)
- `get_active_buffs` returns `vec![]`, `apply_buff` errors — buff system stubbed

Meanwhile `database.rs` already contains unused, working helpers: `add_inventory_item`, `remove_inventory_item`, `add_buff`, and migration 004 created `inventory_items`, `active_buffs`, `user_titles` tables.

## Interview

**Q1: Where should item catalog data live?**
- (a) **[RECOMMENDED]** Keep the existing hardcoded `get_item_data()` catalog in Rust; persist only ownership/quantity in `inventory_items`. Single-player app, catalog rarely changes, no admin UI needed.
- (b) Move catalog into a new `item_catalog` table + seed migration.
- **Chosen: (a)** — least new surface, catalog changes are code changes anyway for a personal app.

**Q2: Buff persistence model?**
- (a) **[RECOMMENDED]** Persist buffs to `active_buffs` table with `expires_at`; `get_active_buffs` filters expired rows and deletes them lazily. Survives app restart — this was the whole point of Sprint 1.
- (b) Restore the old in-memory `ACTIVE_BUFFS` static.
- **Chosen: (a)**.

**Q3: Title acquisition rules?**
- (a) **[RECOMMENDED]** Titles granted from achievements already earned (derive on read: level/achievement thresholds → available titles), equipped title stored in `users.equipped_title` (column already exists).
- (b) Separate title-grant system with its own events.
- **Chosen: (a)** — `equipped_title` column already exists; derivation keeps it consistent.

**Q4: Stat effects of buffs?**
- (a) **[RECOMMENDED]** `apply_stat_buffs_to_user_stats` reads active stat buffs from DB and adds them on top of skill-tree bonuses (restores pre-refactor behavior, now persistent).
- (b) Leave stats unaffected by buffs.
- **Chosen: (a)**.

## Implementation

1. `get_inventory(user_id)` → SELECT from `inventory_items`, join quantities with `get_item_data()` metadata.
2. `purchase_item` → check gold, deduct via users UPDATE, upsert `inventory_items` (use existing `add_inventory_item` or direct SQL in command), return updated user.
3. `use_item` → decrement/remove row, apply effect (XP/gold/buff via `add_buff`), return updated user.
4. `apply_buff` → INSERT into `active_buffs` with computed `expires_at`; `get_active_buffs` → SELECT unexpired, DELETE expired.
5. `apply_stat_buffs_to_user_stats` → include DB stat buffs.
6. Titles: `get_user_titles` derives from level + unlocked achievements; `equip_title`/`unequip_title` UPDATE `users.equipped_title` (validate ownership).
7. Remove dead `#[allow(unused)]`-style warnings where the helpers become used.

## Out of scope

Shop UI changes, new items, buff icons. Frontend already calls these commands.

## Verification

- `cargo check` clean (no new warnings about the previously-unused helpers).
- `npm run build` passes.
- Manual smoke via sqlite3: purchase inserts row + deducts gold; use_item consumes; buff row expires.
