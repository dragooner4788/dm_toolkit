# 🛠️ DMToolkit v1.6.0

A comprehensive DM automation suite for D&D 5E on Roll20, purpose-built for the **D&D Beyond → Beyond20 → Roll20** workflow. 15 modules, 3,600+ lines, zero dependencies.

> **Built with [Claude](https://claude.ai)** — This project was developed collaboratively with Anthropic's Claude as a learning exercise in JavaScript development, Roll20 API scripting, and AI-assisted programming.

---

## The Problem

When using D&D Beyond with Beyond20, character data never syncs to Roll20 sheet attributes. Beyond20 intercepts rolls from D&D Beyond and sends them directly to Roll20 chat, bypassing the character sheet entirely. This means initiative modifiers, AC, HP, ability scores — all read as `undefined` in the Roll20 API.

Beyond that, Roll20's built-in tools are minimal. There's no condition duration tracking, no concentration management, no automated death/HP monitoring, no XP tracking, no session management — the DM has to remember everything manually.

## The Solution

DMToolkit automates the tedious parts of running a 5E game on Roll20 so the DM can focus on storytelling.

**For the Beyond20 gap**, it uses a cascading fallback system:
1. Sheet attributes (if they exist)
2. Stored overrides from `!setup` or `!combat --setinit`
3. SRD Monster Database (~200 monsters with correct DEX mods)
4. Default: +0

**For everything else**, it provides event-driven automation that listens to token changes, turn order events, and Beyond20 chat messages to handle conditions, concentration, death tracking, and XP — all without the DM lifting a finger.

---

## Modules

| # | Module | Command | Description |
|---|--------|---------|-------------|
| 1 | Combat | `!combat` | Initiative automation — roll all, NPCs, PCs, group, debug |
| 2 | Conditions | `!condition` | Apply/remove 5E conditions with status markers + duration tracking |
| 3 | Loot | `!loot` | Individual/hoard treasure by CR, magic items, quest items |
| 4 | Summary | `!summary` | Encounter recap with combatant stats |
| 5 | DM Screen | `!dm` | Quick reference for actions, DCs, conditions |
| 6 | Player Guide | `!guide` | Player-facing 5E quick reference (whispered to requester) |
| 7 | Session Setup | `!setup` | Sync stats from D&D Beyond, SRD auto-fill, bulk import |
| 8 | Concentration | `!conc` | Auto-detect from Beyond20, prompt CON saves on damage |
| 9 | HP Monitor | *auto* | Dead markers + gray tint on NPCs, unconscious on PCs, bloodied warnings |
| 10 | XP Tracker | `!xp` | Auto-tally XP from kills (CR→XP lookup), manual XP, session awards |
| 11 | Session Recap | `!recap` | Set/push "last session" recaps, auto-whisper on player join |
| 12 | Quest Tracker | `!quest` | Persistent quest log with statuses, public board, handout generation |
| 13 | Downtime | `!downtime` | Track downtime days per PC, 12 activity types with built-in mechanics |
| 14 | Session Summary | `!session` | Compile all session data into a Discord/AI-ready plain text summary |
| 15 | Help & Config | `!toolkit` | Help menu, 8 toggleable settings, in-game handout generation |

---

## Quick Start

1. Copy the contents of `DMToolkit.js`
2. In your Roll20 game, go to **Settings → API Scripts** (requires Pro subscription)
3. Click **New Script**, paste the code, and name it `DMToolkit`
4. Click **Save Script** — the sandbox will restart
5. You should see: `🛠️ DMToolkit v1.6.0 Ready!`
6. Run `!setup` at session start to sync player stats and auto-fill NPC data

A **"DMToolkit Guide"** handout auto-creates in your Journal on first install.

---

## Command Reference

### ⚔️ Combat (`!combat`)
| Command | Description |
|---------|-------------|
| `!combat --all` | Roll initiative for all tokens on the page |
| `!combat --npcs` | Roll for NPCs only |
| `!combat --pcs` | Roll for PCs only |
| `!combat --group` | Group initiative (shared character sheets get one roll) |
| `!combat --remind` | Remind players who haven't rolled |
| `!combat --debug` | Inspect token NPC/PC detection and attribute lookups |
| `!combat --tag npc/pc` | Manually tag selected tokens |
| `!combat --setinit N` | Set initiative modifier for selected tokens |
| `!combat --end` | End combat, clear turn order |

### 📌 Conditions (`!condition`)
| Command | Description |
|---------|-------------|
| `!condition` | Interactive condition menu with +/− buttons |
| `!condition --add [name] [rounds]` | Apply condition with optional duration timer |
| `!condition --remove [name]` | Remove condition |
| `!condition --timers` | View all active timed conditions |
| `!condition --clear` | Remove all conditions from selected tokens |

Timed conditions auto-decrement at the start of the affected creature's turn and announce when they expire.

### 🔮 Concentration (`!conc`)
| Command | Description |
|---------|-------------|
| `!conc` | View who is concentrating on what |
| `!conc --drop [name]` | Manually drop concentration |
| `!conc --clear` | Clear all concentration tracking |

Auto-detects concentration spells from Beyond20 chat messages. Prompts CON saves when a concentrating token takes damage (DC = max(10, damage/2)). Auto-drops at 0 HP.

### ⭐ XP Tracker (`!xp`)
| Command | Description |
|---------|-------------|
| `!xp` | View session XP summary with per-PC split |
| `!xp --add [amount] [reason]` | Add manual XP (puzzles, RP, milestones) |
| `!xp --end` | Award XP to players (public announcement) |
| `!xp --reset` | Clear session XP tally |

XP auto-tallies when NPCs drop to 0 HP. CR lookup tries: sheet attribute → SRD database → token name matching.

### 📜 Session Recap (`!recap`)
| Command | Description |
|---------|-------------|
| `!recap` | View current recap |
| `!recap --set [text]` | Set recap text (supports HTML) |
| `!recap --push` | Broadcast recap to all players |
| `!recap --auto` | Toggle auto-whisper on player join |
| `!recap --clear` | Clear recap |

### 📋 Quest Tracker (`!quest`)
| Command | Description |
|---------|-------------|
| `!quest` | GM: full quest manager / Player: whispered quest board |
| `!quest --add Title \| Description` | Add a new quest |
| `!quest --status [id] [status]` | Set: active, complete, failed, hidden |
| `!quest --note [id] [text]` | Add a GM note to a quest |
| `!quest --board` | Show public quest board to all players |
| `!quest --handout` | Generate/update "Quest Board" handout |

### ⏳ Downtime (`!downtime`)
| Command | Description |
|---------|-------------|
| `!downtime` | Overview of all PCs' downtime days |
| `!downtime --grant [days]` | Grant days to all PCs on page |
| `!downtime --spend` | Activity menu (select a PC token first) |
| `!downtime --log` | View activity log (select a token or from overview) |
| `!downtime --reset` | Clear all downtime data |

12 activities with built-in mechanics: Crafting, Training, Research, Carousing (d100), Working (gold/day), Gambling (3d6), Pit Fighting (d20), and more.

### 📋 Session Summary (`!session`)
| Command | Description |
|---------|-------------|
| `!session` | Build full summary from all tracked data |
| `!session --note [text]` | Add a session note |
| `!session --clear` | Clear session notes |

### 💰 Loot (`!loot`)
| Command | Description |
|---------|-------------|
| `!loot --cr N --count X` | Individual treasure by CR |
| `!loot --hoard --cr N` | Hoard treasure with magic items |
| `!loot --magic [rarity]` | Random magic item |
| `!loot --quest` | Random quest/flavor item |

### 🛠️ Utilities
| Command | Description |
|---------|-------------|
| `!summary` | Encounter summary |
| `!dm` | DM quick reference screen |
| `!guide` | Player guide (whispered to requester) |
| `!setup` | Session setup |
| `!setup --srd` | Auto-fill NPC init from SRD |
| `!toolkit --config` | Settings panel |
| `!toolkit --handout` | Update in-game handout |

---

## Auto-Features (Event-Driven)

These require no commands — they trigger automatically:

| Feature | Trigger | Effect |
|---------|---------|--------|
| HP Monitor | Token HP → 0 | NPCs: dead marker + gray tint. PCs: unconscious + announcement |
| PC Recovery | Token HP restored from 0 | Markers removed, recovery announced |
| Bloodied Warning | NPC below half HP | GM whisper |
| XP Auto-Tally | NPC killed in encounter | XP logged from CR |
| Concentration Detection | Beyond20 spell with concentration | Tracked, marker applied |
| Concentration Save | Concentrating token damaged | CON save prompt with Pass/Fail buttons |
| Condition Timer | Turn advances | Timers decrement, expired conditions removed |
| Auto-Recap | Player connects | Session recap whispered |

---

## Technical Details

- **Language:** JavaScript (Roll20 Mod/API sandbox)
- **Size:** ~3,650 lines, 15 modules, zero external dependencies
- **State:** All persistent data in `state.DMToolkit` (survives sandbox restarts)
- **NPC Detection:** 6-method cascading check
- **Events:** `chat:message` (×2), `change:campaign:turnorder`, `change:graphic:bar1_value` (×2), `change:player:_online`
- **Beyond20 Parsing:** Listens for 5E OGL roll templates with concentration flags

## Compatibility

- **Character Sheet:** 5E OGL by Roll20
- **VTT Integration:** D&D Beyond + Beyond20
- **Roll20 Subscription:** Pro (API/Mod access required)

---

## Project Structure

```
dm_toolkit/
├── DMToolkit.js        # Main script (paste into Roll20 API Scripts)
├── script.json         # Roll20 API repository metadata
├── TESTING.md          # Comprehensive test plan (97 test cases)
├── CHANGELOG.md        # Version history
├── LICENSE             # MIT License
└── README.md
```

## Development

This project was built collaboratively with [Claude](https://claude.ai) as an exercise in:
- JavaScript development and Roll20 API scripting
- Event-driven architecture and state management
- AI-assisted software development workflow
- Iterative testing and feature development

---

## License

MIT — see [LICENSE](LICENSE) for details.

## Author

Created by **Guy** with **Claude** (Anthropic) | 2025–2026
