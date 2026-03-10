# Changelog

All notable changes to DMToolkit are documented here.

## [1.6.0] - 2026-02-26

### Added
- **Session Recap** (`!recap`) — Set, preview, and push "last session" recaps to players. Auto-whisper on player join (toggleable).
- **Quest Tracker** (`!quest`) — Persistent quest log with Active/Complete/Failed/Hidden statuses. GM view with action buttons. Public quest board. Auto-generate "Quest Board" handout. Quest notes.
- **Downtime Tracker** (`!downtime`) — Grant downtime days to PCs, 12 activity types with built-in mechanics (carousing d100, gambling 3d6, pit fighting d20, working gold/day). Per-PC activity logs.
- **Session Summary Builder** (`!session`) — Compiles recap, session notes, combat/XP, quests, downtime, and party HP into plain-text summary for Discord or AI input. Auto-saves to "Session Summary" handout.
- `!session --note` for adding notes throughout the game session
- `!downtime --log` now works with selected token (no charId needed)
- Navigation buttons in downtime log (Spend Days / Back to Overview)
- `autoRecap` config toggle

### Changed
- `!guide` now whispers to the requesting player instead of broadcasting publicly
- `!quest` (player view) now whispers quest board to the player instead of broadcasting
- Module numbering updated (now 15 modules)

## [1.5.0] - 2026-02-26

### Added
- **Session Recap** (`!recap`) — initial implementation
- **Quest Tracker** (`!quest`) — initial implementation  
- **Downtime Tracker** (`!downtime`) — initial implementation

## [1.4.0] - 2026-02-25

### Added
- **HP Monitor / Death Tracker** — Auto-applies dead marker + gray tint on NPC death, unconscious marker on PC drop to 0 HP. Recovery detection removes markers and announces.
- **Bloodied Warning** — Whispers GM when NPCs drop below half HP.
- **XP Tracker** (`!xp`) — Auto-tallies XP when NPCs are defeated. CR lookup from sheet → SRD database → token name. Manual XP add. Session award with public announcement and per-PC split.
- **CR-to-XP table** — Full 5E SRD CR 0–30 XP values.
- **SRD CR lookup** — ~100 common monsters mapped to CR for XP tracking.
- `hpMonitor` and `bloodiedWarning` config toggles

## [1.3.0] - 2026-02-25

### Added
- **Condition Duration Tracking** — `!condition --add stunned 3` applies condition for 3 rounds. Auto-decrements at start of affected creature's turn. Announces expiry.
- **Active Timers view** — `!condition --timers` shows all running condition timers.
- Duration prompt integrated into condition menu buttons.

### Fixed
- Removed duplicate Concentration module stub (was at line 1555, full module at 1826).

## [1.2.0] - 2026-02-24

### Added
- **SRD Monster Database** — ~200 monsters with correct DEX modifiers for initiative.
- **Session Setup** (`!setup`) — Whisper prompts to players for Init/AC/HP. SRD auto-fill for NPCs. Bulk import.
- **In-Game Handout** — Auto-creates "DMToolkit Guide" on first install with player reference and DM command tables.
- `!setup --srd` for auto-populating NPC init mods from SRD data.
- `!setup --bulk` for importing multiple init mods at once.

## [1.1.0] - 2026-02-23

### Added
- **Concentration Tracker** (`!conc`) — Auto-detects concentration spells from Beyond20 chat messages. Tracks who is concentrating on what. Prompts CON saves on damage. Auto-drops at 0 HP.
- **Loot Generator** (`!loot`) — Individual/hoard treasure by CR, magic items by rarity, quest items.
- **Encounter Summary** (`!summary`)
- **DM Screen** (`!dm`)
- **Player Guide** (`!guide`)

## [1.0.0] - 2026-02-22

### Initial Release
- **Combat/Initiative Automation** (`!combat`) — Roll initiative for all/NPCs/PCs, group initiative, turn announcements, round tracking.
- **Condition Tracker** (`!condition`) — Apply/remove 5E conditions with Roll20 status markers.
- **Help & Config** (`!toolkit`) — Help menu, toggleable settings.
- NPC detection with 6-method cascading check.
- State persistence via `state.DMToolkit`.