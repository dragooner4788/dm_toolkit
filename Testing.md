# DMToolkit v1.6.0 — Testing Checklist

**Date:** February 2026
**Total Modules:** 15
**Setup:** Roll20 game with Beyond20 extension, D&D Beyond characters, 4 PC tokens + assorted NPC tokens on the active page.

---

## Pre-Test Setup

- [ ] Upload `DMToolkit.js` to Roll20 API Scripts (one-click tab)
- [ ] Verify startup message: "🛠️ DMToolkit v1.6.0 Ready!"
- [ ] Ensure at least 4 PC tokens and 2+ NPC tokens are on the player page
- [ ] Tokens should have `bar1` linked to HP (value + max)
- [ ] At least one NPC should match an SRD name (e.g., "Goblin", "Wolf", "Ogre")

---

## Module 1: Combat / Initiative

| # | Test | Command | Expected Result | Pass |
|---|------|---------|-----------------|------|
| 1.1 | Roll all initiative | `!combat --all` | All tokens on page get initiative rolls, turn order populated | [ ] |
| 1.2 | Roll NPCs only | `!combat --npcs` | Only NPC tokens roll, PCs untouched | [ ] |
| 1.3 | Roll PCs only | `!combat --pcs` | Only PC tokens roll | [ ] |
| 1.4 | Group initiative | `!combat --group` | Tokens sharing a character sheet get the same roll | [ ] |
| 1.5 | Remind missing PCs | `!combat --remind` | Whispers players who haven't rolled yet | [ ] |
| 1.6 | Debug token detection | `!combat --debug` | Lists all tokens with NPC/PC classification | [ ] |
| 1.7 | Manual tag NPC | Select token → `!combat --tag npc` | Token tagged as NPC in state | [ ] |
| 1.8 | Manual tag PC | Select token → `!combat --tag pc` | Token tagged as PC in state | [ ] |
| 1.9 | Set init modifier | Select token → `!combat --setinit 3` | Init mod stored, used on next roll | [ ] |
| 1.10 | End combat | `!combat --end` | Turn order cleared, encounter marked inactive | [ ] |
| 1.11 | Auto-sort | Verify turn order sorts highest → lowest after rolling | [ ] |
| 1.12 | Round announcements | Advance turn order through full cycle | "🔄 Round 2" appears publicly | [ ] |
| 1.13 | Turn announcements | Advance to a PC's turn | "⚔️ [Name] — Your turn!" appears publicly | [ ] |
| 1.14 | NPC turn silence | Advance to an NPC's turn | No public announcement (GM only) | [ ] |

---

## Module 2: Conditions + Duration Tracking

| # | Test | Command | Expected Result | Pass |
|---|------|---------|-----------------|------|
| 2.1 | Show condition menu | Select token → `!condition` | Interactive menu with +/− buttons for all 16 conditions | [ ] |
| 2.2 | Apply condition (permanent) | Click + Stunned (or `!condition --add stunned`) | Stunned marker applied, no timer | [ ] |
| 2.3 | Remove condition | Click − Stunned (or `!condition --remove stunned`) | Marker removed | [ ] |
| 2.4 | Apply with duration | `!condition --add stunned 3` | Marker applied, timer created (3 rounds) | [ ] |
| 2.5 | Timer countdown | Advance turn order to affected token | Whisper: "Stunned — 2 rounds remaining" | [ ] |
| 2.6 | Timer expiry | Advance until rounds = 0 | Public: "⏰ [Name] is no longer Stunned!", marker removed | [ ] |
| 2.7 | View active timers | `!condition --timers` | Lists all active timed conditions | [ ] |
| 2.8 | Clear all conditions | Select token → `!condition --clear` | All markers and timers removed for that token | [ ] |
| 2.9 | Multiple conditions | Apply Stunned (3 rounds) + Poisoned (5 rounds) to same token | Both track independently, expire at correct times | [ ] |

---

## Module 3: Loot Generator

| # | Test | Command | Expected Result | Pass |
|---|------|---------|-----------------|------|
| 3.1 | Default loot | `!loot` | Generates a loot drop (random CR, count 1) | [ ] |
| 3.2 | CR-specific loot | `!loot --cr 5 --count 3` | 3 items appropriate for CR 5 | [ ] |
| 3.3 | Quest item | `!loot --quest` | Generates a random quest/flavor item | [ ] |
| 3.4 | Whisper mode | Toggle lootWhisper in config → generate loot | Loot whispered to GM only | [ ] |

---

## Module 4: Encounter Summary

| # | Test | Command | Expected Result | Pass |
|---|------|---------|-----------------|------|
| 4.1 | Show summary | `!summary` | Lists combatants, loot generated, encounter stats | [ ] |

---

## Module 5: DM Screen

| # | Test | Command | Expected Result | Pass |
|---|------|---------|-----------------|------|
| 5.1 | Show DM screen | `!dm` | Quick reference with DCs, conditions, rules | [ ] |

---

## Module 6: Player Guide

| # | Test | Command | Expected Result | Pass |
|---|------|---------|-----------------|------|
| 6.1 | Show player guide | `!guide` | Public 5E reference card | [ ] |

---

## Module 7: Session Setup (Beyond20 Sync)

| # | Test | Command | Expected Result | Pass |
|---|------|---------|-----------------|------|
| 7.1 | Session setup prompt | `!setup` | Prompts each player to enter Init/AC/HP | [ ] |
| 7.2 | SRD auto-fill | `!setup --srd` | NPC tokens matching SRD names get init mods populated | [ ] |
| 7.3 | Bulk import | `!setup --bulk Goblin:2,Wolf:2,Ogre:5` | Init mods stored for listed creatures | [ ] |

---

## Module 8: Concentration Tracker

**Requires:** Beyond20 extension active, D&D Beyond character sheet open, Roll20 game in same browser.

| # | Test | Command | Expected Result | Pass |
|---|------|---------|-----------------|------|
| 8.1 | Auto-detect concentration spell | Cast a concentration spell from D&D Beyond via Beyond20 | "🔮 [Name] is concentrating on [Spell]", stopwatch marker applied | [ ] |
| 8.2 | View concentration | `!conc` | Lists who is concentrating on what | [ ] |
| 8.3 | Damage triggers CON save prompt | Lower HP on concentrating token's bar1 | Whisper: "⚡ Concentration Check! DC [X]" with Pass/Fail buttons | [ ] |
| 8.4 | DC calculation | Deal 18 damage to concentrating token | DC = max(10, 9) = 10 | [ ] |
| 8.5 | Pass concentration | Click ✅ Passed | Confirmation whisper, concentration maintained | [ ] |
| 8.6 | Fail concentration | Click 💥 Failed | "Concentration Broken!" announcement, marker removed | [ ] |
| 8.7 | Drop at 0 HP | Set concentrating token HP to 0 | Auto-drops concentration (no save) | [ ] |
| 8.8 | Spell replacement | Cast a second concentration spell with same character | First spell dropped, announcement shows swap | [ ] |
| 8.9 | Manual drop | `!conc --drop [CharName]` | Concentration removed | [ ] |
| 8.10 | Clear all | `!conc --clear` | All concentration tracking cleared | [ ] |

**Note:** Tests 8.1, 8.3-8.8 require Beyond20 sending structured chat messages. If Beyond20 is unavailable, these cannot be tested in this pass.

---

## Module 9: HP Monitor / Death Tracker

| # | Test | Command | Expected Result | Pass |
|---|------|---------|-----------------|------|
| 9.1 | NPC drops to 0 HP | Set NPC token bar1 to 0 | 💀 Dead marker applied, token tinted gray, GM whisper "NPC Defeated" | [ ] |
| 9.2 | PC drops to 0 HP | Set PC token bar1 to 0 | Skull marker applied, public "⚠️ [Name] Has Fallen!" | [ ] |
| 9.3 | PC healed from 0 | Set PC token bar1 back to positive | Markers removed, public "💚 [Name] is back on their feet!" | [ ] |
| 9.4 | Bloodied warning (NPC) | Set NPC HP from full to below half | Whisper: "🩸 [Name] is bloodied! (X/Y HP)" | [ ] |
| 9.5 | Bloodied not on PC | Set PC HP from full to below half | No bloodied whisper (NPC only) | [ ] |
| 9.6 | No double dead marker | Set NPC to 0 twice | Only one dead marker, no duplicates in statusmarkers | [ ] |
| 9.7 | Toggle HP Monitor off | `!toolkit --toggle hpMonitor` → set token to 0 | No markers applied, no announcements | [ ] |
| 9.8 | Toggle bloodied off | `!toolkit --toggle bloodiedWarning` → damage NPC below half | No bloodied whisper | [ ] |
| 9.9 | XP auto-log on NPC death | Set SRD-named NPC to 0 HP during active encounter | GM whisper shows XP amount and session total | [ ] |

---

## Module 10: XP Tracker

| # | Test | Command | Expected Result | Pass |
|---|------|---------|-----------------|------|
| 10.1 | View empty XP | `!xp` | "No XP earned this session" | [ ] |
| 10.2 | Auto XP from combat | Kill an SRD-named NPC (e.g., Goblin) | XP whisper: "Goblin — CR 1/4 — 50 XP (Session: 50 XP)" | [ ] |
| 10.3 | CR from sheet | Kill NPC with `npc_challenge` attribute set | Uses sheet CR, not SRD fallback | [ ] |
| 10.4 | CR from token name fallback | Kill NPC named "Wolf 2" (numbered) | Strips number, looks up "Wolf" → CR 1 → 200 XP | [ ] |
| 10.5 | No double-count | Kill same token twice (set HP to 0, heal, set to 0 again) | XP only counted once | [ ] |
| 10.6 | Manual XP add | `!xp --add 200 Puzzle solved` | "Puzzle solved — 200 XP", session total updated | [ ] |
| 10.7 | Session summary | `!xp` | Lists all kills + manual XP, total, per-PC split | [ ] |
| 10.8 | Award XP | `!xp --end` | Public announcement with total, per-PC split, kill list. Session XP resets. | [ ] |
| 10.9 | Reset XP | `!xp --reset` | Session XP cleared to zero | [ ] |
| 10.10 | PC count accuracy | With 4 PCs on page, earn 400 XP → award | "100 XP each" (400 ÷ 4) | [ ] |

---

## Module 11: Session Recap / MOTD

| # | Test | Command | Expected Result | Pass |
|---|------|---------|-----------------|------|
| 11.1 | View empty recap | `!recap` | "No recap set" message | [ ] |
| 11.2 | Set recap | `!recap --set The party arrived at the asteroid port of Bral after a harrowing journey through the phlogiston.` | Recap saved, preview shown with Push/Clear buttons | [ ] |
| 11.3 | View saved recap | `!recap` | Shows saved text with date, Edit/Push/Clear buttons | [ ] |
| 11.4 | Push to all | `!recap --push` | Public message: "📜 Last Session..." with recap text | [ ] |
| 11.5 | HTML support | `!recap --set The party fought <b>three</b> dragons and <i>barely</i> survived.` | Bold and italic render in the pushed message | [ ] |
| 11.6 | Clear recap | `!recap --clear` | Recap removed from state | [ ] |
| 11.7 | Auto-push toggle | `!recap --auto` | Toggles autoRecap config on/off | [ ] |
| 11.8 | Auto-push on join | Set recap + enable autoRecap → have a player reconnect | Player receives whispered recap on connect | [ ] |
| 11.9 | No re-push | Same player reconnects again | No second whisper (already in pushed list) | [ ] |

---

## Module 12: Quest Tracker

| # | Test | Command | Expected Result | Pass |
|---|------|---------|-----------------|------|
| 12.1 | View empty quests | `!quest` | "No quests" with Add button | [ ] |
| 12.2 | Add quest (title only) | `!quest --add Find the Helm` | Quest added as Active, confirmation shown | [ ] |
| 12.3 | Add quest (title + desc) | `!quest --add Rescue the Crew \| They were captured by neogi` | Quest added with description | [ ] |
| 12.4 | GM view | `!quest` | Full list grouped by status, with action buttons per quest | [ ] |
| 12.5 | Public quest board | `!quest --board` | Public message showing Active + Completed quests (no Hidden/Failed details) | [ ] |
| 12.6 | Complete a quest | Click ✅ button on a quest | Status → Complete, public "✅ Quest Complete!" announcement | [ ] |
| 12.7 | Fail a quest | Click ❌ button on a quest | Status → Failed, public "❌ Quest Failed" announcement | [ ] |
| 12.8 | Hide a quest | Click 👁️ button | Status → Hidden, not shown on public board | [ ] |
| 12.9 | Reactivate a quest | Click 🟢 on a completed/failed quest | Status → Active again | [ ] |
| 12.10 | Add note to quest | Click 📝 → enter note text | Note appended, visible in GM view with date | [ ] |
| 12.11 | Multiple notes | Add 2-3 notes to same quest | All notes visible in order under the quest | [ ] |
| 12.12 | Remove quest | Click 🗑️ | Quest deleted from state | [ ] |
| 12.13 | Update handout | `!quest --handout` | "Quest Board" handout created/updated, visible in journal | [ ] |
| 12.14 | Handout player access | Check "Quest Board" handout permissions | Should be visible to all players | [ ] |
| 12.15 | Player runs !quest | Non-GM types `!quest` | Shows public board (not GM view) | [ ] |

---

## Module 13: Downtime Tracker

| # | Test | Command | Expected Result | Pass |
|---|------|---------|-----------------|------|
| 13.1 | View empty downtime | `!downtime` | "No downtime tracked" with Grant/Spend buttons | [ ] |
| 13.2 | Grant days to all PCs | `!downtime --grant 14` | Public: "Each PC receives 14 days", all PCs on page updated | [ ] |
| 13.3 | Overview after grant | `!downtime` | Lists all PCs with 14 days each | [ ] |
| 13.4 | Spend menu (no token) | `!downtime --spend` (nothing selected) | "Select a PC token first" message | [ ] |
| 13.5 | Spend menu (NPC token) | Select NPC → `!downtime --spend` | "Select a PC token" message | [ ] |
| 13.6 | Spend menu (PC token) | Select PC → `!downtime --spend` | Activity menu with all 12 options and remaining days | [ ] |
| 13.7 | Training | Click ⚔️ Training → enter days | Days deducted, log entry created | [ ] |
| 13.8 | Working (gold calc) | Click 💰 Working → 5 days | "Earned 10 gp (comfortable lifestyle)" | [ ] |
| 13.9 | Carousing (d100 roll) | Click 🍺 Carousing → 1 day | d100 result with contacts/trouble outcome | [ ] |
| 13.10 | Gambling (3d6 roll) | Click 🎲 Gambling → 1 day | 3d6 result with win/lose/break even | [ ] |
| 13.11 | Pit Fighting (d20) | Click 💪 Pit Fighting → 1 day | d20 result with victory/defeat outcome | [ ] |
| 13.12 | Insufficient days | Try to spend more days than available | "[Name] only has X days available" | [ ] |
| 13.13 | View log (selected token) | Select PC → `!downtime --log` | Full activity history for that PC with back button | [ ] |
| 13.14 | View log (from overview) | Click 📜 button next to a PC in overview | Same log view | [ ] |
| 13.15 | Log navigation | Click "⬅ Overview" from log | Returns to overview | [ ] |
| 13.16 | Log navigation | Click "⏳ Spend Days" from log | Opens spend menu | [ ] |
| 13.17 | Custom activity | Click 📋 Other → enter days | Generic log entry created | [ ] |
| 13.18 | Multiple PCs | Spend downtime for 2+ different PCs | Each PC has independent day counts and logs | [ ] |
| 13.19 | Reset downtime | `!downtime --reset` | All downtime data cleared | [ ] |
| 13.20 | Grant additional days | Already have days → `!downtime --grant 7` | Days ADD to existing (not replace) | [ ] |

---

## Module 14: Session Summary Builder

| # | Test | Command | Expected Result | Pass |
|---|------|---------|-----------------|------|
| 14.1 | Empty summary | `!session` (fresh state) | Summary with headers but minimal content, Party section with current PCs | [ ] |
| 14.2 | Add session note | `!session --note The party discovered the hidden temple beneath the docks` | "📝 Session note added" confirmation | [ ] |
| 14.3 | Multiple notes | Add 3-4 notes throughout testing | All appear in KEY EVENTS section | [ ] |
| 14.4 | Summary with data | Set recap → complete a quest → kill NPCs for XP → spend downtime → `!session` | All sections populated: Previously, Key Events, Combat, Quests, Downtime, Party | [ ] |
| 14.5 | Plain text format | Check summary output | Monospaced, pre-formatted, no HTML tags in text body | [ ] |
| 14.6 | Handout creation | After `!session` | "Session Summary" handout created/updated in journal | [ ] |
| 14.7 | Handout is GM-only | Check "Session Summary" handout permissions | Not visible to players | [ ] |
| 14.8 | Copy-paste friendly | Copy text from handout into a text editor | Clean plain text, suitable for Discord or AI input | [ ] |
| 14.9 | XP section accuracy | Kill Goblin (CR 1/4, 50 XP) + add 100 manual XP → `!session` | Combat section shows both entries, total = 150, per-PC split | [ ] |
| 14.10 | Quest section grouping | Have 1 active, 1 completed, 1 failed quest → `!session` | Quests grouped by status with correct labels | [ ] |
| 14.11 | Clear notes | `!session --clear` | Session notes cleared, confirmation shown | [ ] |
| 14.12 | Add Note button | Click "📝 Add Note" button in summary output | Prompts for note text, adds successfully | [ ] |

---

## Module 15: Help & Config

| # | Test | Command | Expected Result | Pass |
|---|------|---------|-----------------|------|
| 15.1 | Show help | `!toolkit` | Full command reference with all modules listed | [ ] |
| 15.2 | Show config | `!toolkit --config` | All toggles with current status (✅/❌) | [ ] |
| 15.3 | Toggle setting | `!toolkit --toggle autoSort` | Setting flipped, config panel refreshes | [ ] |
| 15.4 | Create/update handout | `!toolkit --handout` | Player guide handout created with DM command reference | [ ] |
| 15.5 | All toggles present | Check config panel | Should include: autoSort, announceRounds, announceTurns, whisperNPCInit, lootWhisper, hpMonitor, bloodiedWarning, autoRecap | [ ] |

---

## Integration / End-to-End Tests

These tests verify features work together correctly.

| # | Test | Steps | Expected Result | Pass |
|---|------|-------|-----------------|------|
| E2E-1 | Full combat flow | `!setup --srd` → `!combat --all` → advance turns → apply conditions with timers → kill NPC → `!xp` → `!combat --end` | Init rolls use SRD mods, conditions tick down, dead NPC gets marker + XP logged, summary shows encounter data | [ ] |
| E2E-2 | Death + Concentration | Cast concentration spell → take damage → fail save → drop to 0 HP | Concentration check prompted, if failed: marker removed. At 0 HP: unconscious marker applied, concentration auto-dropped (separate from save) | [ ] |
| E2E-3 | Session lifecycle | `!recap --set [text]` → `!recap --push` → run combat → `!session --note [events]` → `!quest --add` → `!quest --status complete` → `!downtime --grant` → `!downtime --spend` → `!xp --end` → `!session` | Full session summary captures all activity | [ ] |
| E2E-4 | Multiple combats | Run combat 1 (kill goblins) → end → run combat 2 (kill ogre) → `!xp` | XP from both encounters accumulated in session total | [ ] |
| E2E-5 | PC death + recovery | PC drops to 0 → unconscious marker → heal PC → marker removed → continue combat | Markers toggle correctly, no leftover state | [ ] |

---

## Edge Cases

| # | Test | Expected Result | Pass |
|---|------|-----------------|------|
| EC-1 | No tokens selected for condition commands | Helpful error message, no crash | [ ] |
| EC-2 | Apply condition to token with no character sheet | Marker still applied, no crash | [ ] |
| EC-3 | Kill NPC with no SRD match and no sheet CR | XP logged as 0 with CR "?" | [ ] |
| EC-4 | Run `!xp --end` with no XP earned | "No XP to Award" message | [ ] |
| EC-5 | `!downtime --spend` with 0 days remaining | Activity menu shows "No downtime days available" | [ ] |
| EC-6 | Very long recap text | Text stored and displayed without breaking chat | [ ] |
| EC-7 | Special characters in quest titles | `!quest --add Bob's "Special" Quest & More` | Stored and displayed correctly | [ ] |
| EC-8 | Remove last quest | Delete only quest → `!quest` | Shows empty state with Add button | [ ] |
| EC-9 | Grant days with no PCs on page | `!downtime --grant 7` | Grants to 0 PCs, no crash | [ ] |
| EC-10 | Session summary with no data | `!session` on fresh state | Minimal summary with just Party section (if PCs exist) | [ ] |

---

## Known Limitations (Not Bugs)

- **Concentration detection** requires Beyond20 to be active and sending structured roll templates to Roll20 chat. Manual rolls or non-Beyond20 workflows won't trigger auto-detection — use `!conc` commands manually instead.
- **SRD CR lookup** covers ~100 common monsters. Custom or module-specific creatures need either the `npc_challenge` sheet attribute or manual `!xp --add`.
- **Downtime mechanics** are simplified versions of XGtE rules. DM should adjudicate edge cases narratively.
- **Quest handout** overwrites on each update. Don't manually edit the "Quest Board" handout — changes will be lost on next `!quest --handout`.
- **Session Summary handout** is GM-only by default. Share with players manually if desired.
- **Auto-recap on player join** uses `change:player:_online` event which may not fire reliably in all Roll20 configurations.

---

## Post-Test Cleanup

- [ ] `!xp --reset` — Clear XP
- [ ] `!session --clear` — Clear session notes
- [ ] `!downtime --reset` — Clear downtime
- [ ] Reset any test quests via `!quest --remove`
- [ ] `!recap --clear` — Clear recap
- [ ] Remove test tokens if needed
- [ ] Verify `!toolkit --config` shows desired defaults for actual play