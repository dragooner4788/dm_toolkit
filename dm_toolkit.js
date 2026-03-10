// ============================================================================
// DMToolkit - DM Automation Suite for D&D 5E (OGL by Roll20)
// Version: 1.2.0
// Author: Guy (with Claude)
// Compatible with: D&D Beyond via Beyond20, 5E OGL by Roll20
//
// Modules:
//   1. !combat    - Initiative automation (PCs + NPCs, auto-roll, sort)
//   2. !condition - Condition/status effect management
//   3. !loot      - Random loot generator by CR
//   4. !summary   - Encounter/battle summary generator
//   5. !dm        - DM Screen (quick reference, rules lookup)
//   6. !guide     - Player-facing reference (actions, race/class info)
//   7. !setup     - Session setup (Beyond20 stat sync, SRD lookup, bulk import)
//   8. !toolkit   - Help, config, & in-game handout generation
//
// Changelog v1.2.0:
//   - SRD Monster Database: ~200 monsters with DEX mods for auto-lookup
//   - Session Setup (!setup): prompts players to sync stats from D&D Beyond
//   - SRD Auto-Fill (!setup --srd): one-click NPC init population
//   - Bulk Import (!setup --bulk): paste name:mod pairs
//   - In-game Handout: auto-created on install, full player & DM reference
//   - !toolkit --handout to create/update the Journal handout
//
// Changelog v1.1.0:
//   - Fixed NPC detection (multi-method: npc attr, controlledby, npc attrs)
//   - Fixed: each token now gets individual initiative entry
//   - Added !combat --debug to inspect token/character data
//   - Added !combat --tag to manually mark tokens as NPC/PC
//   - Added group initiative option (--group flag)
//   - Added !guide for player-facing 5E reference
//   - Uses getAttrByName() for reliable attribute lookups
// ============================================================================

var DMToolkit = DMToolkit || (function () {
    'use strict';

    const VERSION = '1.6.0';
    const SCRIPT_NAME = 'DMToolkit';

    // ========================================================================
    // STYLING
    // ========================================================================
    const STYLE = {
        box: 'background-color:#1a1a2e;border:2px solid #e94560;border-radius:10px;padding:10px;margin-bottom:5px;color:#eaeaea;font-family:Trebuchet MS,sans-serif;',
        title: 'font-size:16px;font-weight:bold;color:#e94560;text-align:center;border-bottom:1px solid #e94560;padding-bottom:5px;margin-bottom:8px;',
        subtitle: 'font-size:13px;font-weight:bold;color:#0f3460;background-color:#e94560;padding:3px 6px;border-radius:4px;margin:5px 0;',
        row: 'padding:2px 0;border-bottom:1px solid #333;',
        rowAlt: 'padding:2px 0;border-bottom:1px solid #333;background-color:#16213e;',
        btn: 'background-color:#e94560;color:white;padding:3px 8px;border:none;border-radius:4px;cursor:pointer;font-size:11px;text-decoration:none;',
        btnSecondary: 'background-color:#0f3460;color:white;padding:3px 8px;border:none;border-radius:4px;cursor:pointer;font-size:11px;text-decoration:none;',
        btnSuccess: 'background-color:#2d6a4f;color:white;padding:3px 8px;border:none;border-radius:4px;cursor:pointer;font-size:11px;text-decoration:none;',
        loot: 'background-color:#1a1a2e;border:2px solid #f5a623;border-radius:10px;padding:10px;color:#eaeaea;font-family:Trebuchet MS,sans-serif;',
        lootTitle: 'font-size:16px;font-weight:bold;color:#f5a623;text-align:center;border-bottom:1px solid #f5a623;padding-bottom:5px;margin-bottom:8px;',
        gold: 'color:#f5a623;font-weight:bold;',
        hp: 'color:#ff6b6b;',
        ac: 'color:#4ecdc4;',
        init: 'color:#95e1d3;',
        dmScreen: 'background-color:#0d1b2a;border:2px solid #48cae4;border-radius:10px;padding:10px;color:#eaeaea;font-family:Trebuchet MS,sans-serif;',
        dmTitle: 'font-size:16px;font-weight:bold;color:#48cae4;text-align:center;border-bottom:1px solid #48cae4;padding-bottom:5px;margin-bottom:8px;',
        guide: 'background-color:#1b2838;border:2px solid #66bb6a;border-radius:10px;padding:10px;color:#eaeaea;font-family:Trebuchet MS,sans-serif;',
        guideTitle: 'font-size:16px;font-weight:bold;color:#66bb6a;text-align:center;border-bottom:1px solid #66bb6a;padding-bottom:5px;margin-bottom:8px;',
        debug: 'background-color:#2d2d2d;border:2px solid #ff9800;border-radius:10px;padding:10px;color:#eaeaea;font-family:monospace;font-size:11px;',
        debugTitle: 'font-size:14px;font-weight:bold;color:#ff9800;text-align:center;border-bottom:1px solid #ff9800;padding-bottom:5px;margin-bottom:8px;',
    };

    // Chat helpers (using Roll20's global sendChat)
    const whisperGM = (msg) => {
        sendChat('DMToolkit', '/w gm ' + msg);
    };

    const sendPublic = (msg) => {
        sendChat('DMToolkit', msg);
    };

    // ========================================================================
    // STATE INITIALIZATION
    // ========================================================================
    const initState = () => {
        if (!state.DMToolkit) {
            state.DMToolkit = {};
        }
        // Ensure all keys exist (migration-safe)
        state.DMToolkit = Object.assign({
            version: VERSION,
            config: {
                autoSort: true,
                announceRounds: true,
                announceTurns: true,
                whisperNPCInit: true,
                lootWhisper: false,
            },
            encounter: {
                active: false,
                round: 0,
                combatants: [],
                loot: [],
                log: [],
            },
            tags: {}, // Manual NPC/PC tags: { charId: 'npc' | 'pc' }
            initMods: {}, // Manual initiative modifiers: { charId: number }
        }, state.DMToolkit);

        // Ensure sub-objects
        if (!state.DMToolkit.config) state.DMToolkit.config = {};
        if (!state.DMToolkit.encounter) state.DMToolkit.encounter = { active: false, round: 0, combatants: [], loot: [], log: [] };
        if (!state.DMToolkit.tags) state.DMToolkit.tags = {};
        if (!state.DMToolkit.initMods) state.DMToolkit.initMods = {};
        if (!state.DMToolkit.concentration) state.DMToolkit.concentration = {};
        if (!state.DMToolkit.conditionTimers) state.DMToolkit.conditionTimers = [];
        if (!state.DMToolkit.sessionXP) state.DMToolkit.sessionXP = { kills: [], totalXP: 0 };
        if (!state.DMToolkit.quests) state.DMToolkit.quests = {};
        if (!state.DMToolkit.downtime) state.DMToolkit.downtime = { players: {} };
        if (!state.DMToolkit.sessionNotes) state.DMToolkit.sessionNotes = [];
        // Ensure config defaults for new features
        if (state.DMToolkit.config.hpMonitor === undefined) state.DMToolkit.config.hpMonitor = true;
        if (state.DMToolkit.config.bloodiedWarning === undefined) state.DMToolkit.config.bloodiedWarning = true;
        if (state.DMToolkit.config.autoRecap === undefined) state.DMToolkit.config.autoRecap = false;
    };

    // ========================================================================
    // UTILITY FUNCTIONS
    // ========================================================================

    // Robust NPC detection for 5E OGL sheet
    // Uses multiple signals since the 'npc' attribute may not exist
    const isNPC = (charId) => {
        // 1. Check manual tags first (user overrides)
        if (state.DMToolkit.tags[charId] === 'npc') return true;
        if (state.DMToolkit.tags[charId] === 'pc') return false;

        // 2. Check the 'npc' attribute (standard 5E OGL method)
        const npcVal = getAttrByName(charId, 'npc');
        if (npcVal === '1' || npcVal === 1) return true;

        // 3. Check 'sheet_type' attribute (used by some setups)
        const sheetType = getAttrByName(charId, 'sheet_type');
        if (sheetType === 'npc') return true;

        // 4. Check for NPC-specific attributes (npc_name, npc_ac exist only on NPC sheets)
        const npcName = getAttrByName(charId, 'npc_name');
        if (npcName && npcName !== '' && npcName !== '0') return true;

        const npcAC = getAttrByName(charId, 'npc_ac');
        if (npcAC && npcAC !== '' && npcAC !== '0') return true;

        // 5. Check controlledby - NPCs typically have no controlling player
        const character = getObj('character', charId);
        if (character) {
            const controlledBy = character.get('controlledby');

            // If no one controls it and it has NPC-like dex attribute, it's an NPC
            if (controlledBy === '' || controlledBy === undefined) {
                const npcDex = getAttrByName(charId, 'npcd_dex');
                if (npcDex && npcDex !== '' && npcDex !== '0') return true;

                // 6. FALLBACK: If controlledby is empty AND no PC attributes exist,
                // this is almost certainly an NPC (PCs always have player control).
                // Characters with empty sheets + no player = NPC from module/compendium.
                const initBonus = getAttrByName(charId, 'initiative_bonus');
                const level = getAttrByName(charId, 'level');
                const baseHP = getAttrByName(charId, 'base_level');
                const hasAnyPCAttr = (initBonus !== undefined && initBonus !== '') ||
                                     (level !== undefined && level !== '' && level !== '0');
                if (!hasAnyPCAttr) return true; // No player, no PC data = NPC
            }
        }

        return false;
    };

    // Get initiative bonus for a token's character
    // Tries multiple attribute names because 5E OGL has different naming conventions
    const getInitBonus = (charId) => {
        // Helper: try multiple attribute names, return first valid number
        const tryAttrs = function(names) {
            for (let i = 0; i < names.length; i++) {
                const val = getAttrByName(charId, names[i]);
                if (val !== undefined && val !== '' && val !== null && !isNaN(parseInt(val))) {
                    return parseInt(val);
                }
            }
            return null;
        };

        if (isNPC(charId)) {
            // 1. Check explicit NPC initiative bonus
            const npcInit = tryAttrs(['npc_initiative']);
            if (npcInit !== null && npcInit !== 0) return npcInit;

            // 2. Try NPC-specific DEX modifier attributes
            const npcDexMod = tryAttrs([
                'npcd_dex_mod',           // Standard NPC dex mod display field
                'npc_dexterity_mod',      // Alternative naming
            ]);
            if (npcDexMod !== null) return npcDexMod;

            // 3. Try shared dexterity modifier (auto-calculated by sheet)
            const dexMod = tryAttrs(['dexterity_mod']);
            if (dexMod !== null) return dexMod;

            // 4. Try to compute from raw dexterity score (shared attr)
            const dexScore = tryAttrs(['dexterity', 'npcd_dex']);
            if (dexScore !== null) return Math.floor((dexScore - 10) / 2);

            // 5. Check for stored init bonus in our state
            if (state.DMToolkit.initMods && state.DMToolkit.initMods[charId] !== undefined) {
                return state.DMToolkit.initMods[charId];
            }

            // 6. SRD lookup by character name
            const srdInit = getSRDInit(getCharName(charId));
            if (srdInit !== null) return srdInit;

            return 0;
        } else {
            // PC: try initiative_bonus first, then dexterity_mod, then raw dex
            const pcInit = tryAttrs([
                'initiative_bonus',       // Standard PC initiative bonus (includes feats etc.)
                'dexterity_mod',          // DEX modifier
            ]);
            if (pcInit !== null) return pcInit;

            // Compute from raw DEX if nothing else works
            const dexScore = tryAttrs(['dexterity']);
            if (dexScore !== null) return Math.floor((dexScore - 10) / 2);

            // Check stored overrides
            if (state.DMToolkit.initMods && state.DMToolkit.initMods[charId] !== undefined) {
                return state.DMToolkit.initMods[charId];
            }

            return 0;
        }
    };

    // Roll dice (returns integer) - uses Roll20's randomInteger
    const rollDice = (sides, count) => {
        count = count || 1;
        let total = 0;
        for (let i = 0; i < count; i++) {
            total += randomInteger(sides);
        }
        return total;
    };

    // Get the character's display name (handles NPC names)
    const getCharName = (charId) => {
        if (isNPC(charId)) {
            const npcName = getAttrByName(charId, 'npc_name');
            if (npcName && npcName !== '') return npcName;
        }
        const character = getObj('character', charId);
        return character ? character.get('name') : 'Unknown';
    };

    // ========================================================================
    // SRD MONSTER DATA (DEX scores for auto-lookup)
    // ========================================================================
    // Common SRD monsters mapped to their initiative modifier (DEX mod)
    // Used as fallback when character sheet has no data
    const SRD_INIT = {
        // CR 0
        'commoner':0,'goat':0,'cat':2,'crab':-1,'deer':1,'eagle':1,'frog':0,'hawk':1,
        'hyena':1,'jackal':1,'lizard':-1,'owl':1,'rat':0,'raven':2,'scorpion':-1,
        'spider':2,'vulture':0,'weasel':3,'bat':2,'baboon':1,'badger':-1,
        // CR 1/8
        'bandit':1,'blood hawk':2,'camel':-1,'cultist':1,'flying snake':4,
        'giant crab':-1,'giant rat':2,'giant weasel':3,'guard':1,'kobold':2,
        'mastiff':2,'merfolk':1,'mule':0,'noble':1,'poisonous snake':3,
        'stirge':3,'tribal warrior':0,
        // CR 1/4
        'acolyte':0,'axe beak':1,'blink dog':3,'boar':0,'constrictor snake':2,
        'draft horse':0,'drow':2,'elk':0,'flying sword':2,'giant badger':0,
        'giant bat':3,'giant centipede':2,'giant frog':1,'giant lizard':1,
        'giant owl':2,'giant poisonous snake':4,'giant wolf spider':3,
        'goblin':2,'goblin boss':2,'grimlock':2,'kenku':3,'panther':2,
        'pseudodragon':2,'riding horse':0,'skeleton':2,'sprite':4,
        'steam mephit':1,'swarm of bats':2,'swarm of rats':0,'wolf':2,'zombie':-2,
        // CR 1/2
        'ape':2,'black bear':0,'cockatrice':1,'crocodile':0,'darkmantle':1,
        'dust mephit':2,'giant goat':0,'giant sea horse':2,'giant wasp':2,
        'gnoll':1,'hobgoblin':1,'ice mephit':1,'lizardfolk':0,'magma mephit':1,
        'orc':1,'reef shark':1,'rust monster':1,'sahuagin':0,'satyr':3,
        'scout':2,'shadow':2,'swarm of insects':0,'thug':0,'warg':1,'worg':1,
        // CR 1
        'animated armor':0,'bugbear':2,'dire wolf':2,'dryad':1,'ghoul':2,
        'giant eagle':3,'giant hyena':1,'giant spider':3,'giant toad':1,
        'harpy':1,'hippogriff':1,'imp':3,'quasit':3,'specter':2,'spy':2,
        'tiger':2,'yuan-ti pureblood':1,
        // CR 2
        'allosaurus':1,'ankheg':0,'awakened tree':-2,'bandit captain':2,
        'berserker':1,'centaur':2,'cult fanatic':2,'druid':1,'ettercap':2,
        'gargoyle':0,'gelatinous cube':-4,'ghast':3,'giant boar':0,
        'giant constrictor snake':2,'giant elk':3,'gibbering mouther':-1,
        'griffon':2,'hunter shark':1,'merrow':0,'mimic':1,'minotaur skeleton':1,
        'ogre':-1,'ogre zombie':-2,'pegasus':2,'polar bear':0,
        'priest':0,'rhinoceros':-1,'rug of smothering':2,'saber-toothed tiger':2,
        'sea hag':1,'wererat':2,'will-o-wisp':9,
        // CR 3
        'basilisk':-1,'bearded devil':2,'blue dragon wyrmling':0,
        'doppelganger':4,'giant scorpion':1,'green hag':1,'hell hound':1,
        'killer whale':0,'knight':0,'manticore':3,'minotaur':0,'mummy':0,
        'nightmare':2,'owlbear':1,'phase spider':3,'veteran':1,'werewolf':1,
        'wight':2,'winter wolf':1,
        // CR 4-5
        'black pudding':-3,'chuul':0,'elephant':0,'ettin':-1,'ghost':1,
        'lamia':1,'red dragon wyrmling':0,'succubus':3,
        'air elemental':5,'barbed devil':3,'beholder zombie':0,'bulette':0,
        'earth elemental':-1,'fire elemental':3,'flesh golem':-1,'gorgon':0,
        'hill giant':-1,'night hag':2,'otyugh':0,'roper':-1,'salamander':2,
        'shambling mound':-1,'troll':1,'umber hulk':1,'unicorn':2,
        'water elemental':2,'werebear':0,'wraith':3,'xorn':0,
        // CR 5+
        'chimera':0,'cyclops':0,'drider':3,'medusa':2,'young white dragon':0,
        'young black dragon':2,'young green dragon':1,'young blue dragon':0,
        'young red dragon':0,'frost giant':-1,'fire giant':-1,'stone giant':2,
        'cloud giant':0,'storm giant':2,'adult black dragon':2,'adult blue dragon':0,
        'adult green dragon':1,'adult red dragon':0,'adult white dragon':0,
        'ancient black dragon':2,'ancient blue dragon':0,'ancient green dragon':1,
        'ancient red dragon':0,'ancient white dragon':0,
        'beholder':2,'death knight':0,'lich':3,'vampire':4,'tarrasque':0,
    };

    // Lookup SRD init mod by character name (fuzzy match)
    const getSRDInit = (name) => {
        if (!name) return null;
        const lower = name.toLowerCase().trim();
        // Exact match
        if (SRD_INIT[lower] !== undefined) return SRD_INIT[lower];
        // Try without numbers/suffixes: "Guard 3" -> "guard", "Goblin 1" -> "goblin"
        const stripped = lower.replace(/\s*\d+$/, '').trim();
        if (SRD_INIT[stripped] !== undefined) return SRD_INIT[stripped];
        // Try partial match (e.g., "Giant Goat" in "Young Giant Goat")
        const keys = Object.keys(SRD_INIT);
        for (let i = 0; i < keys.length; i++) {
            if (lower.indexOf(keys[i]) !== -1 || keys[i].indexOf(lower) !== -1) {
                return SRD_INIT[keys[i]];
            }
        }
        return null;
    };

    // ========================================================================
    // MODULE 1: COMBAT / INITIATIVE AUTOMATION
    // ========================================================================
    const Combat = {
        // Roll initiative for all tokens on the current page (or selected)
        rollAll: (msg) => {
            const pageId = Campaign().get('playerpageid');
            let tokens = [];

            if (msg.selected && msg.selected.length > 0) {
                tokens = msg.selected
                    .map(function(s) { return getObj('graphic', s._id); })
                    .filter(function(t) { return t && t.get('represents'); });
            } else {
                tokens = findObjs({ type: 'graphic', pageid: pageId, layer: 'objects' })
                    .filter(function(t) { return t.get('represents'); });
            }

            if (tokens.length === 0) {
                whisperGM('<div style="' + STYLE.box + '">' +
                    '<div style="' + STYLE.title + '">⚔️ Combat - No Tokens</div>' +
                    '<p>No tokens found with linked character sheets. Ensure tokens on the map represent characters.</p>' +
                    '<p style="font-size:11px;color:#aaa;">Tip: Right-click a token → Edit → "Represents Character" must be set.</p>' +
                    '</div>');
                return;
            }

            Combat._rollInitForTokens(tokens, 'all');
        },

        // Roll initiative for NPCs only
        rollNPCs: (msg) => {
            const pageId = Campaign().get('playerpageid');
            let tokens = [];

            if (msg.selected && msg.selected.length > 0) {
                tokens = msg.selected
                    .map(function(s) { return getObj('graphic', s._id); })
                    .filter(function(t) { return t && t.get('represents') && isNPC(t.get('represents')); });
            } else {
                tokens = findObjs({ type: 'graphic', pageid: pageId, layer: 'objects' })
                    .filter(function(t) { return t.get('represents') && isNPC(t.get('represents')); });

                // Also check GM layer for hidden NPCs
                const gmTokens = findObjs({ type: 'graphic', pageid: pageId, layer: 'gmlayer' })
                    .filter(function(t) { return t.get('represents') && isNPC(t.get('represents')); });
                tokens = tokens.concat(gmTokens);
            }

            if (tokens.length === 0) {
                whisperGM('<div style="' + STYLE.box + '">' +
                    '<div style="' + STYLE.title + '">⚔️ No NPCs Found</div>' +
                    '<p>No NPC tokens detected. This can happen if:</p>' +
                    '<p style="font-size:11px;">• Character sheets aren\'t set to NPC mode<br>' +
                    '• Tokens don\'t have "Represents Character" set<br>' +
                    '• Try <a style="' + STYLE.btn + '" href="!combat --debug">🔍 Debug Tokens</a> to inspect</p>' +
                    '<p style="font-size:11px;">• Or use <a style="' + STYLE.btn + '" href="!combat --tag npc">🏷️ Tag as NPC</a> on selected tokens</p>' +
                    '</div>');
                return;
            }

            Combat._rollInitForTokens(tokens, 'npc');
        },

        // Roll initiative for PCs only
        rollPCs: (msg) => {
            const pageId = Campaign().get('playerpageid');
            let tokens = [];

            if (msg.selected && msg.selected.length > 0) {
                tokens = msg.selected
                    .map(function(s) { return getObj('graphic', s._id); })
                    .filter(function(t) { return t && t.get('represents') && !isNPC(t.get('represents')); });
            } else {
                tokens = findObjs({ type: 'graphic', pageid: pageId, layer: 'objects' })
                    .filter(function(t) { return t.get('represents') && !isNPC(t.get('represents')); });
            }

            if (tokens.length === 0) {
                whisperGM('<div style="' + STYLE.box + '"><div style="' + STYLE.title + '">⚔️ No PCs Found</div></div>');
                return;
            }

            Combat._rollInitForTokens(tokens, 'pc');
        },

        // Core initiative rolling logic
        // mode: 'all' = clear and roll fresh, 'npc'/'pc' = add to existing
        _rollInitForTokens: (tokens, mode) => {
            const pageId = Campaign().get('playerpageid');
            let turnorder;
            if (mode === 'all') {
                turnorder = [];
            } else {
                turnorder = Campaign().get('turnorder') === '' ? [] : JSON.parse(Campaign().get('turnorder'));
            }

            let results = [];

            // IMPORTANT: Roll individually for EACH token, even if multiple share a character sheet
            tokens.forEach(function(token) {
                const charId = token.get('represents');
                const tokenId = token.get('_id');
                const tokenName = token.get('name') || getCharName(charId);
                const npc = isNPC(charId);
                const bonus = getInitBonus(charId);
                const roll = rollDice(20);
                const total = roll + bonus;

                // Remove any existing entry for THIS specific token
                turnorder = turnorder.filter(function(e) { return e.id !== tokenId; });

                turnorder.push({
                    id: tokenId,
                    pr: String(total),
                    _pageid: pageId,
                });

                results.push({
                    name: tokenName,
                    roll: roll,
                    bonus: bonus,
                    total: total,
                    npc: npc,
                    tokenId: tokenId,
                    charId: charId,
                });
            });

            // Sort descending by initiative (keep custom entries like Round at bottom)
            if (state.DMToolkit.config.autoSort) {
                turnorder.sort(function(a, b) {
                    if (a.id === '-1') return 1;
                    if (b.id === '-1') return -1;
                    return parseInt(b.pr) - parseInt(a.pr);
                });
                results.sort(function(a, b) { return b.total - a.total; });
            }

            // Add round counter if doing a fresh roll
            if (mode === 'all') {
                // Remove old round counters
                turnorder = turnorder.filter(function(e) { return !(e.id === '-1' && e.custom === '🔄 Round'); });
                turnorder.push({
                    id: '-1',
                    custom: '🔄 Round',
                    pr: '1',
                    formula: '+1',
                    _pageid: pageId,
                });
            }

            Campaign().set('turnorder', JSON.stringify(turnorder));

            // Ensure the Turn Order window is open
            if (!Campaign().get('initiativepage')) {
                Campaign().set('initiativepage', pageId);
            }

            // Update encounter state
            state.DMToolkit.encounter.active = true;
            if (mode === 'all') {
                state.DMToolkit.encounter.round = 1;
                state.DMToolkit.encounter.combatants = [];
            }

            results.forEach(function(r) {
                state.DMToolkit.encounter.combatants.push({
                    name: r.name,
                    tokenId: r.tokenId,
                    charId: r.charId,
                    initiative: r.total,
                    npc: r.npc,
                });
            });

            // Build GM output
            let modeLabel = mode === 'all' ? 'All' : mode === 'npc' ? 'NPC' : 'PC';
            let output = '<div style="' + STYLE.box + '">';
            output += '<div style="' + STYLE.title + '">⚔️ Initiative Rolled! (' + modeLabel + ')</div>';

            results.forEach(function(r, i) {
                const rowStyle = i % 2 === 0 ? STYLE.row : STYLE.rowAlt;
                const typeTag = r.npc
                    ? '<span style="color:#ff6b6b;font-size:10px;">[NPC]</span>'
                    : '<span style="color:#95e1d3;font-size:10px;">[PC]</span>';
                output += '<div style="' + rowStyle + '">';
                output += '<span style="' + STYLE.init + 'font-size:14px;font-weight:bold;">' + r.total + '</span> ';
                output += typeTag + ' ';
                output += '<b>' + r.name + '</b>';
                output += ' <span style="color:#888;font-size:10px;">(🎲' + r.roll + ' + ' + r.bonus + ')</span>';
                output += '</div>';
            });

            output += '<div style="margin-top:8px;text-align:center;">';
            output += '<a style="' + STYLE.btn + '" href="!combat --npcs">🎲 Roll NPCs</a> ';
            output += '<a style="' + STYLE.btnSecondary + '" href="!combat --remind">⏰ Remind PCs</a> ';
            output += '<a style="' + STYLE.btnSecondary + '" href="!combat --end">🛑 End</a>';
            output += '</div></div>';

            whisperGM(output);

            // Public announcement
            if (mode === 'all') {
                sendPublic('<div style="' + STYLE.box + '">' +
                    '<div style="' + STYLE.title + '">⚔️ Roll for Initiative!</div>' +
                    '<p style="text-align:center;color:#ccc;">Combat has begun! Round 1</p></div>');
            }
        },

        // Group initiative: roll once per character sheet, apply to all tokens of that character
        rollGroup: (msg) => {
            const pageId = Campaign().get('playerpageid');
            let tokens = [];

            if (msg.selected && msg.selected.length > 0) {
                tokens = msg.selected
                    .map(function(s) { return getObj('graphic', s._id); })
                    .filter(function(t) { return t && t.get('represents'); });
            } else {
                tokens = findObjs({ type: 'graphic', pageid: pageId, layer: 'objects' })
                    .filter(function(t) { return t.get('represents'); });
            }

            if (tokens.length === 0) {
                whisperGM('<div style="' + STYLE.box + '"><div style="' + STYLE.title + '">⚔️ No Tokens</div></div>');
                return;
            }

            let turnorder = [];
            let results = [];
            let groupRolls = {}; // charId -> { roll, bonus, total }

            tokens.forEach(function(token) {
                const charId = token.get('represents');
                const tokenId = token.get('_id');
                const tokenName = token.get('name') || getCharName(charId);
                const npc = isNPC(charId);

                // Roll once per character sheet
                if (!groupRolls[charId]) {
                    const bonus = getInitBonus(charId);
                    const roll = rollDice(20);
                    groupRolls[charId] = { roll: roll, bonus: bonus, total: roll + bonus };
                }

                const gr = groupRolls[charId];

                turnorder.push({ id: tokenId, pr: String(gr.total), _pageid: pageId });
                results.push({
                    name: tokenName,
                    roll: gr.roll,
                    bonus: gr.bonus,
                    total: gr.total,
                    npc: npc,
                    tokenId: tokenId,
                    grouped: true,
                });
            });

            // Sort and add round counter
            turnorder.sort(function(a, b) { return parseInt(b.pr) - parseInt(a.pr); });
            turnorder.push({ id: '-1', custom: '🔄 Round', pr: '1', formula: '+1', _pageid: pageId });
            results.sort(function(a, b) { return b.total - a.total; });

            Campaign().set('turnorder', JSON.stringify(turnorder));
            state.DMToolkit.encounter.active = true;
            state.DMToolkit.encounter.round = 1;

            let output = '<div style="' + STYLE.box + '">';
            output += '<div style="' + STYLE.title + '">⚔️ Group Initiative Rolled!</div>';
            output += '<p style="color:#aaa;font-size:10px;text-align:center;">Tokens sharing a character sheet rolled as a group</p>';

            results.forEach(function(r, i) {
                const rowStyle = i % 2 === 0 ? STYLE.row : STYLE.rowAlt;
                const typeTag = r.npc
                    ? '<span style="color:#ff6b6b;font-size:10px;">[NPC]</span>'
                    : '<span style="color:#95e1d3;font-size:10px;">[PC]</span>';
                output += '<div style="' + rowStyle + '">';
                output += '<span style="' + STYLE.init + 'font-size:14px;font-weight:bold;">' + r.total + '</span> ';
                output += typeTag + ' <b>' + r.name + '</b>';
                output += ' <span style="color:#888;font-size:10px;">(🎲' + r.roll + ' + ' + r.bonus + ')</span>';
                output += '</div>';
            });
            output += '</div>';
            whisperGM(output);
        },

        // Remind players who haven't rolled
        remind: (msg) => {
            const turnorder = Campaign().get('turnorder') === '' ? [] : JSON.parse(Campaign().get('turnorder'));
            const trackedIds = turnorder.map(function(e) { return e.id; }).filter(function(id) { return id !== '-1'; });
            const pageId = Campaign().get('playerpageid');

            const pcTokens = findObjs({ type: 'graphic', pageid: pageId, layer: 'objects' })
                .filter(function(t) {
                    const charId = t.get('represents');
                    return charId && !isNPC(charId);
                });

            const missing = pcTokens.filter(function(t) { return !trackedIds.includes(t.get('_id')); });

            if (missing.length === 0) {
                whisperGM('<div style="' + STYLE.box + '"><div style="' + STYLE.title + '">✅ All PCs Have Initiative</div></div>');
                return;
            }

            let output = '<div style="' + STYLE.box + '">';
            output += '<div style="' + STYLE.title + '">⏰ Initiative Reminder</div>';
            missing.forEach(function(t) {
                const name = t.get('name') || 'Unknown PC';
                output += '<div style="' + STYLE.row + '">⚠️ <b>' + name + '</b> — Roll initiative!</div>';
            });
            output += '</div>';
            sendPublic(output);
        },

        // Debug: inspect tokens for NPC detection
        debug: (msg) => {
            const pageId = Campaign().get('playerpageid');
            let tokens = [];

            if (msg.selected && msg.selected.length > 0) {
                tokens = msg.selected
                    .map(function(s) { return getObj('graphic', s._id); })
                    .filter(function(t) { return t; });
            } else {
                tokens = findObjs({ type: 'graphic', pageid: pageId, layer: 'objects' })
                    .filter(function(t) { return t.get('represents'); });
            }

            if (tokens.length === 0) {
                whisperGM('<div style="' + STYLE.debug + '"><div style="' + STYLE.debugTitle + '">🔍 No Tokens to Debug</div></div>');
                return;
            }

            let output = '<div style="' + STYLE.debug + '">';
            output += '<div style="' + STYLE.debugTitle + '">🔍 Token Debug Info</div>';

            tokens.forEach(function(token) {
                const charId = token.get('represents');
                const tokenName = token.get('name') || '(no name)';

                output += '<div style="border:1px solid #555;padding:5px;margin:3px 0;border-radius:4px;">';
                output += '<b style="color:#ff9800;">' + tokenName + '</b><br>';
                output += 'Token ID: ' + token.get('_id') + '<br>';
                output += 'Layer: ' + token.get('layer') + '<br>';

                if (!charId) {
                    output += '<span style="color:#ff5252;">❌ No character sheet linked!</span><br>';
                    output += 'Fix: Right-click token → Edit → set "Represents Character"';
                } else {
                    const character = getObj('character', charId);
                    const charName = character ? character.get('name') : '(not found)';
                    const controlledBy = character ? character.get('controlledby') : '';

                    output += 'Character: ' + charName + '<br>';
                    output += 'Char ID: ' + charId + '<br>';
                    output += 'Controlled By: ' + (controlledBy || '<i>nobody (GM only)</i>') + '<br>';

                    // NPC detection signals
                    const npcAttr = getAttrByName(charId, 'npc');
                    const sheetType = getAttrByName(charId, 'sheet_type');
                    const npcName = getAttrByName(charId, 'npc_name');
                    const npcAC = getAttrByName(charId, 'npc_ac');
                    const npcDex = getAttrByName(charId, 'npcd_dex');
                    const npcDexMod = getAttrByName(charId, 'npcd_dex_mod');
                    const initBonus = getAttrByName(charId, 'initiative_bonus');
                    const npcInit = getAttrByName(charId, 'npc_initiative');
                    const manualTag = state.DMToolkit.tags[charId] || 'none';

                    output += '<br><b>NPC Detection Signals:</b><br>';
                    output += '  npc attr: "' + npcAttr + '"<br>';
                    output += '  sheet_type: "' + sheetType + '"<br>';
                    output += '  npc_name: "' + npcName + '"<br>';
                    output += '  npc_ac: "' + npcAC + '"<br>';
                    output += '  npcd_dex: "' + npcDex + '"<br>';
                    output += '  npcd_dex_mod: "' + npcDexMod + '"<br>';
                    output += '  npc_initiative: "' + npcInit + '"<br>';
                    output += '  initiative_bonus (PC): "' + initBonus + '"<br>';
                    output += '  controlledby: "' + controlledBy + '"<br>';
                    output += '  manual tag: ' + manualTag + '<br>';

                    // Additional attribute lookups for init bonus debugging
                    const dexterity = getAttrByName(charId, 'dexterity');
                    const dexterityMod = getAttrByName(charId, 'dexterity_mod');
                    const npcDexterityMod = getAttrByName(charId, 'npc_dexterity_mod');
                    const storedInit = (state.DMToolkit.initMods && state.DMToolkit.initMods[charId] !== undefined) ? state.DMToolkit.initMods[charId] : 'none';

                    output += '<br><b>Init Bonus Lookups:</b><br>';
                    output += '  dexterity (raw): "' + dexterity + '"<br>';
                    output += '  dexterity_mod: "' + dexterityMod + '"<br>';
                    output += '  npc_dexterity_mod: "' + npcDexterityMod + '"<br>';
                    output += '  stored override: ' + storedInit + '<br>';

                    // SRD lookup
                    const srdLookupName = getCharName(charId);
                    const srdResult = getSRDInit(srdLookupName);
                    output += '  SRD lookup ("' + srdLookupName + '"): ' + (srdResult !== null ? srdResult : 'not found') + '<br>';

                    const detected = isNPC(charId);
                    const initBonusCalc = getInitBonus(charId);

                    output += '<br><b style="color:' + (detected ? '#ff6b6b' : '#95e1d3') + ';">→ Detected as: ' + (detected ? 'NPC' : 'PC') + '</b><br>';
                    output += '<b>→ Init bonus: ' + initBonusCalc + '</b><br>';

                    // Tag buttons
                    output += '<br><a style="' + STYLE.btn + '" href="!combat --tag npc ' + charId + '">Tag as NPC</a> ';
                    output += '<a style="' + STYLE.btnSuccess + '" href="!combat --tag pc ' + charId + '">Tag as PC</a> ';
                    output += '<a style="' + STYLE.btnSecondary + '" href="!combat --tag clear ' + charId + '">Clear Tag</a>';
                    output += '<br><a style="' + STYLE.btn + 'margin-top:3px;" href="!combat --setinit ?{Init modifier for ' + tokenName + '|0} ">📊 Set Init Mod</a>';
                }
                output += '</div>';
            });

            output += '</div>';
            whisperGM(output);
        },

        // Tag a character as NPC or PC manually
        tag: (msg) => {
            const args = msg.content.split(/\s+/);
            // !combat --tag npc [charId]
            // !combat --tag pc [charId]
            // !combat --tag clear [charId]
            const tagType = args[2] || 'npc';
            let charId = args[3];

            // If no charId provided, use selected tokens
            if (!charId && msg.selected && msg.selected.length > 0) {
                let count = 0;
                msg.selected.forEach(function(s) {
                    const token = getObj('graphic', s._id);
                    if (token && token.get('represents')) {
                        const cid = token.get('represents');
                        if (tagType === 'clear') {
                            delete state.DMToolkit.tags[cid];
                        } else {
                            state.DMToolkit.tags[cid] = tagType;
                        }
                        count++;
                    }
                });
                whisperGM('<div style="' + STYLE.box + '"><div style="' + STYLE.title + '">🏷️ Tagged ' + count + ' token(s) as ' + tagType.toUpperCase() + '</div></div>');
            } else if (charId) {
                if (tagType === 'clear') {
                    delete state.DMToolkit.tags[charId];
                } else {
                    state.DMToolkit.tags[charId] = tagType;
                }
                whisperGM('<div style="' + STYLE.box + '"><div style="' + STYLE.title + '">🏷️ Tagged as ' + tagType.toUpperCase() + '</div></div>');
            } else {
                whisperGM('<div style="' + STYLE.box + '"><div style="' + STYLE.title + '">⚠️ Select token(s) first</div></div>');
            }
        },

        // Set initiative modifier manually for a character
        // Usage: !combat --setinit [modifier] (with tokens selected)
        setInit: (msg) => {
            const args = msg.content.split(/\s+/);
            const value = args[2] || '';

            if (value === 'list') {
                let output = '<div style="' + STYLE.box + '">';
                output += '<div style="' + STYLE.title + '">📊 Stored Initiative Modifiers</div>';
                const mods = state.DMToolkit.initMods || {};
                const keys = Object.keys(mods);
                if (keys.length === 0) {
                    output += '<div style="color:#aaa;">No stored modifiers. Select tokens and use:<br><b>!combat --setinit [number]</b></div>';
                } else {
                    keys.forEach(function(cid) {
                        const character = getObj('character', cid);
                        const name = character ? character.get('name') : cid;
                        output += '<div style="' + STYLE.row + '"><b>' + name + '</b>: +' + mods[cid];
                        output += ' <a style="' + STYLE.btnSecondary + '" href="!combat --setinit clear ' + cid + '">✕</a></div>';
                    });
                }
                output += '</div>';
                whisperGM(output);
                return;
            }

            if (value === 'clear') {
                const clearId = args[3];
                if (clearId) {
                    delete state.DMToolkit.initMods[clearId];
                } else {
                    state.DMToolkit.initMods = {};
                }
                whisperGM('<div style="' + STYLE.box + '"><div style="' + STYLE.title + '">✅ Init modifiers cleared</div></div>');
                return;
            }

            const mod = parseInt(value);
            if (isNaN(mod)) {
                whisperGM('<div style="' + STYLE.box + '"><div style="' + STYLE.title + '">📊 Set Initiative Modifier</div>' +
                    '<p style="font-size:11px;">Select tokens, then:<br><b>!combat --setinit [number]</b><br>Example: <code>!combat --setinit 2</code> → +2 init<br>' +
                    '<code>!combat --setinit -1</code> → -1 init</p>' +
                    '<div style="text-align:center;"><a style="' + STYLE.btn + '" href="!combat --setinit list">📊 View Stored</a></div></div>');
                return;
            }

            if (!msg.selected || msg.selected.length === 0) {
                whisperGM('<div style="' + STYLE.box + '"><div style="' + STYLE.title + '">⚠️ Select Token(s) First</div></div>');
                return;
            }

            let count = 0;
            let names = [];
            msg.selected.forEach(function(s) {
                const token = getObj('graphic', s._id);
                if (token && token.get('represents')) {
                    const cid = token.get('represents');
                    state.DMToolkit.initMods[cid] = mod;
                    names.push(token.get('name') || getCharName(cid));
                    count++;
                }
            });

            const sign = mod >= 0 ? '+' : '';
            whisperGM('<div style="' + STYLE.box + '"><div style="' + STYLE.title + '">✅ Init Modifier Set</div>' +
                '<p><b>' + names.join(', ') + '</b> → ' + sign + mod + ' initiative</p>' +
                '<p style="font-size:10px;color:#aaa;">Used as fallback when sheet lacks DEX data.<br>' +
                '<a style="' + STYLE.btnSecondary + '" href="!combat --setinit list">📊 View All</a></p></div>');
        },

        // End combat
        end: () => {
            Campaign().set('turnorder', '[]');
            state.DMToolkit.encounter.active = false;

            // Clear all concentration on combat end
            const concKeys = Object.keys(state.DMToolkit.concentration || {});
            concKeys.forEach(function(charId) { Concentration.drop(charId, 'combat ended'); });

            let output = '<div style="' + STYLE.box + '">';
            output += '<div style="' + STYLE.title + '">🛑 Combat Ended</div>';
            output += '<p style="text-align:center;">Turn tracker cleared.</p>';
            output += '<div style="text-align:center;">';
            output += '<a style="' + STYLE.btn + '" href="!summary">📋 Battle Summary</a> ';
            output += '<a style="' + STYLE.btnSecondary + '" href="!loot --cr ?{CR|1} --count ?{Creatures|1}">💰 Generate Loot</a>';
            output += '</div></div>';
            whisperGM(output);
        },
    };

    // ========================================================================
    // MODULE 2: CONDITIONS
    // ========================================================================
    const CONDITIONS_5E = {
        blinded: { icon: 'bleeding-eye', desc: 'Can\'t see. Attacks against have advantage, its attacks have disadvantage.' },
        charmed: { icon: 'heart', desc: 'Can\'t attack the charmer. Charmer has advantage on social checks.' },
        deafened: { icon: 'screaming', desc: 'Can\'t hear. Auto-fails hearing-based ability checks.' },
        frightened: { icon: 'broken-skull', desc: 'Disadvantage on checks/attacks while source of fear is in line of sight.' },
        grappled: { icon: 'grab', desc: 'Speed becomes 0. Ends if grappler incapacitated or moved out of reach.' },
        incapacitated: { icon: 'interdiction', desc: 'Can\'t take actions or reactions.' },
        invisible: { icon: 'ninja-mask', desc: 'Attacks against have disadvantage, creature\'s attacks have advantage.' },
        paralyzed: { icon: 'padlock', desc: 'Incapacitated. Auto-fail STR/DEX saves. Attacks advantage, melee crits.' },
        petrified: { icon: 'frozen-orb', desc: 'Turned to stone. Resistance to all damage. Immune to poison/disease.' },
        poisoned: { icon: 'death-zone', desc: 'Disadvantage on attack rolls and ability checks.' },
        prone: { icon: 'back-pain', desc: 'Disadvantage on attacks. Melee against has advantage, ranged disadvantage.' },
        restrained: { icon: 'fishing-net', desc: 'Speed 0. Attacks/DEX saves disadvantage. Attacks against have advantage.' },
        stunned: { icon: 'lightning-helix', desc: 'Incapacitated. Auto-fail STR/DEX. Attacks against have advantage.' },
        unconscious: { icon: 'skull', desc: 'Drops items, falls prone. Auto-fail STR/DEX. Attacks advantage, melee crits.' },
        exhaustion: { icon: 'half-haze', desc: 'Levels 1-6 with cumulative effects. Level 6 = death.' },
        concentrating: { icon: 'stopwatch', desc: 'CON save on damage (DC 10 or half damage). Broken by another concentration spell.' },
    };

    const Conditions = {
        apply: (msg) => {
            const args = msg.content.split(/\s+/);
            const subCmd = args[1] || '--menu';

            if (subCmd === '--list' || subCmd === '--menu') {
                Conditions.showMenu(msg);
                return;
            }
            if (subCmd === '--timers' || subCmd === '--active') {
                Conditions.showTimers();
                return;
            }

            if (!msg.selected || msg.selected.length === 0) {
                whisperGM('<div style="' + STYLE.box + '"><div style="' + STYLE.title + '">⚠️ Select Token(s)</div><p>Select one or more tokens first, then use the condition menu.</p></div>');
                Conditions.showMenu(msg);
                return;
            }

            if (subCmd === '--clear') {
                msg.selected.forEach(function(s) {
                    const token = getObj('graphic', s._id);
                    if (token) {
                        token.set('statusmarkers', '');
                        // Remove all timers for this token
                        state.DMToolkit.conditionTimers = state.DMToolkit.conditionTimers.filter(function(t) {
                            return t.tokenId !== s._id;
                        });
                    }
                });
                whisperGM('<div style="' + STYLE.box + '"><div style="' + STYLE.title + '">✅ Conditions Cleared</div></div>');
                return;
            }

            // Parse: !condition --add stunned [duration]
            //    or: !condition --remove stunned
            const condName = (args[2] || '').toLowerCase();
            const duration = parseInt(args[3]); // optional rounds

            if (!CONDITIONS_5E[condName]) {
                Conditions.showMenu(msg);
                return;
            }

            const cond = CONDITIONS_5E[condName];
            const displayName = condName.charAt(0).toUpperCase() + condName.slice(1);

            msg.selected.forEach(function(s) {
                const token = getObj('graphic', s._id);
                if (!token) return;

                const tokenName = token.get('name') || 'Token';

                if (subCmd === '--add') {
                    const markers = token.get('statusmarkers').split(',').filter(function(m) { return m; });
                    if (!markers.includes(cond.icon)) {
                        markers.push(cond.icon);
                        token.set('statusmarkers', markers.join(','));
                    }

                    // If duration specified, add a timer
                    let durationText = '';
                    if (!isNaN(duration) && duration > 0) {
                        // Remove existing timer for same token+condition
                        state.DMToolkit.conditionTimers = state.DMToolkit.conditionTimers.filter(function(t) {
                            return !(t.tokenId === s._id && t.condition === condName);
                        });
                        state.DMToolkit.conditionTimers.push({
                            tokenId: s._id,
                            charId: token.get('represents') || '',
                            tokenName: tokenName,
                            condition: condName,
                            icon: cond.icon,
                            rounds: duration,
                            direction: -1, // count down
                        });
                        durationText = ' <span style="color:#66bb6a;">(' + duration + ' round' + (duration > 1 ? 's' : '') + ')</span>';
                    }

                    let output = '<div style="' + STYLE.box + '">';
                    output += '<div style="' + STYLE.title + '">📌 Condition Applied</div>';
                    output += '<b>' + tokenName + '</b> is now <b style="color:#e94560;">' + displayName + '</b>' + durationText;
                    output += '<br><span style="color:#aaa;font-size:11px;">' + cond.desc + '</span>';
                    output += '</div>';
                    whisperGM(output);

                } else if (subCmd === '--remove') {
                    const markers = token.get('statusmarkers').split(',').filter(function(m) { return m && m !== cond.icon; });
                    token.set('statusmarkers', markers.join(','));

                    // Remove timer
                    state.DMToolkit.conditionTimers = state.DMToolkit.conditionTimers.filter(function(t) {
                        return !(t.tokenId === s._id && t.condition === condName);
                    });

                    whisperGM('<div style="' + STYLE.box + '"><div style="' + STYLE.title + '">✅ Removed</div>' +
                        '<b>' + tokenName + '</b> is no longer <b>' + displayName + '</b></div>');
                }
            });
        },

        // Process condition timers on turn change
        processTurnChange: (tokenId) => {
            if (!state.DMToolkit.conditionTimers || state.DMToolkit.conditionTimers.length === 0) return;

            const token = getObj('graphic', tokenId);
            if (!token) return;

            const expiring = [];
            const active = [];

            state.DMToolkit.conditionTimers.forEach(function(timer) {
                if (timer.tokenId !== tokenId) return;

                timer.rounds += timer.direction; // typically -1

                if (timer.rounds <= 0) {
                    expiring.push(timer);
                } else {
                    active.push(timer);
                }
            });

            // Remove expired conditions
            expiring.forEach(function(timer) {
                // Remove the status marker
                const markers = token.get('statusmarkers').split(',').filter(function(m) {
                    return m && m !== timer.icon;
                });
                token.set('statusmarkers', markers.join(','));

                const displayName = timer.condition.charAt(0).toUpperCase() + timer.condition.slice(1);
                const tokenName = token.get('name') || timer.tokenName || 'Token';

                sendPublic('<div style="' + STYLE.box + '">' +
                    '<div style="text-align:center;">⏰ <b>' + tokenName + '</b> is no longer <b style="color:#66bb6a;">' + displayName + '</b>!</div></div>');
            });

            // Announce remaining durations to GM
            if (active.length > 0) {
                let output = '<div style="' + STYLE.box + '">';
                output += '<div style="' + STYLE.subtitle + '">⏱️ ' + (token.get('name') || 'Token') + ' — Active Conditions</div>';
                active.forEach(function(timer) {
                    const displayName = timer.condition.charAt(0).toUpperCase() + timer.condition.slice(1);
                    output += '<div style="' + STYLE.row + '"><b>' + displayName + '</b> — ' +
                        timer.rounds + ' round' + (timer.rounds > 1 ? 's' : '') + ' remaining</div>';
                });
                output += '</div>';
                whisperGM(output);
            }

            // Update state: remove expired timers
            state.DMToolkit.conditionTimers = state.DMToolkit.conditionTimers.filter(function(t) {
                return !(t.tokenId === tokenId && t.rounds <= 0);
            });
        },

        // Show all active condition timers
        showTimers: () => {
            const timers = state.DMToolkit.conditionTimers || [];

            let output = '<div style="' + STYLE.box + '">';
            output += '<div style="' + STYLE.title + '">⏱️ Active Condition Timers</div>';

            if (timers.length === 0) {
                output += '<p style="color:#aaa;text-align:center;">No timed conditions active.</p>';
            } else {
                timers.forEach(function(timer, idx) {
                    const displayName = timer.condition.charAt(0).toUpperCase() + timer.condition.slice(1);
                    const tokenName = timer.tokenName || 'Unknown';
                    output += '<div style="' + (idx % 2 === 0 ? STYLE.row : STYLE.rowAlt) + '">';
                    output += '<b>' + tokenName + '</b> — <b style="color:#e94560;">' + displayName + '</b>';
                    output += ' <span style="color:#66bb6a;">' + timer.rounds + ' rnd' + (timer.rounds > 1 ? 's' : '') + '</span>';
                    output += '</div>';
                });
            }

            output += '</div>';
            whisperGM(output);
        },

        showMenu: () => {
            let output = '<div style="' + STYLE.box + '">';
            output += '<div style="' + STYLE.title + '">📋 5E Conditions</div>';
            output += '<p style="color:#aaa;font-size:10px;text-align:center;">Select token(s) first. Click + to apply, − to remove. Add duration: <code>!condition --add stunned 3</code></p>';

            Object.keys(CONDITIONS_5E).forEach(function(name) {
                const c = CONDITIONS_5E[name];
                const displayName = name.charAt(0).toUpperCase() + name.slice(1);
                output += '<div style="' + STYLE.row + 'padding:3px 0;">';
                output += '<a style="' + STYLE.btn + '" href="!condition --add ' + name + ' ?{Rounds (0=permanent)|0}">+</a> ';
                output += '<a style="' + STYLE.btnSecondary + '" href="!condition --remove ' + name + '">−</a> ';
                output += '<b>' + displayName + '</b> ';
                output += '<span style="color:#aaa;font-size:10px;">' + c.desc.substring(0, 70) + '</span>';
                output += '</div>';
            });

            output += '<div style="margin-top:5px;">';
            output += '<a style="' + STYLE.btn + '" href="!condition --clear">🗑️ Clear All</a> ';
            output += '<a style="' + STYLE.btnSecondary + '" href="!condition --timers">⏱️ Active Timers</a>';
            output += '</div></div>';
            whisperGM(output);
        },
    };

    // ========================================================================
    // MODULE 3: LOOT GENERATOR
    // ========================================================================
    const LOOT_TABLES = {
        individual: {
            '0-4': {
                coins: [
                    { weight: 30, fn: function() { return { cp: rollDice(6, 5) }; } },
                    { weight: 60, fn: function() { return { sp: rollDice(6, 4) }; } },
                    { weight: 70, fn: function() { return { ep: rollDice(6, 3) }; } },
                    { weight: 95, fn: function() { return { gp: rollDice(6, 3) }; } },
                    { weight: 100, fn: function() { return { pp: rollDice(6, 1) }; } },
                ],
            },
            '5-10': {
                coins: [
                    { weight: 30, fn: function() { return { cp: rollDice(6, 4) * 100, ep: rollDice(6, 1) * 10 }; } },
                    { weight: 60, fn: function() { return { sp: rollDice(6, 6) * 10, gp: rollDice(6, 2) * 10 }; } },
                    { weight: 70, fn: function() { return { ep: rollDice(6, 3) * 10, gp: rollDice(6, 2) * 10 }; } },
                    { weight: 95, fn: function() { return { gp: rollDice(6, 4) * 10 }; } },
                    { weight: 100, fn: function() { return { gp: rollDice(6, 2) * 10, pp: rollDice(6, 3) }; } },
                ],
            },
            '11-16': {
                coins: [
                    { weight: 20, fn: function() { return { sp: rollDice(6, 4) * 100, gp: rollDice(6, 1) * 100 }; } },
                    { weight: 35, fn: function() { return { ep: rollDice(6, 1) * 100, gp: rollDice(6, 1) * 100 }; } },
                    { weight: 75, fn: function() { return { gp: rollDice(6, 2) * 100, pp: rollDice(6, 1) * 10 }; } },
                    { weight: 100, fn: function() { return { gp: rollDice(6, 2) * 100, pp: rollDice(6, 2) * 10 }; } },
                ],
            },
            '17+': {
                coins: [
                    { weight: 15, fn: function() { return { ep: rollDice(6, 2) * 1000, gp: rollDice(6, 8) * 100 }; } },
                    { weight: 55, fn: function() { return { gp: rollDice(6, 1) * 1000, pp: rollDice(6, 1) * 100 }; } },
                    { weight: 100, fn: function() { return { gp: rollDice(6, 1) * 1000, pp: rollDice(6, 2) * 100 }; } },
                ],
            },
        },
        mundane: [
            'Tattered map fragment', 'Silver ring (5 gp)', 'Bone dice set', 'Potion of Healing',
            'Quiver of 20 arrows', 'Torch (3)', 'Rope, hempen (50 ft)', 'Rations (3 days)',
            'Tinderbox', 'Waterskin', 'Healer\'s Kit', 'Caltrops (bag of 20)',
            'Component pouch', 'Holy symbol', 'Thieves\' tools', 'Vial of acid',
            'Alchemist\'s fire', 'Ball bearings (bag of 1000)', 'Hunting trap', 'Manacles',
            'Oil (flask)', 'Pouch with gem dust (10 gp)', 'Scroll case with old letter',
            'Small mirror', 'Spyglass', 'Net', 'Grappling hook', 'Crowbar',
        ],
        magic: {
            common: [
                'Potion of Healing', 'Spell Scroll (cantrip)', 'Potion of Climbing',
                'Driftglobe', 'Cloak of Many Fashions', 'Hat of Wizardry',
                'Tankard of Sobriety', 'Candle of the Deep', 'Ear Horn of Hearing',
            ],
            uncommon: [
                'Potion of Greater Healing', '+1 Weapon', '+1 Shield', '+1 Ammunition (x5)',
                'Bag of Holding', 'Cloak of Protection', 'Boots of Elvenkind',
                'Gloves of Thievery', 'Goggles of Night', 'Pearl of Power',
                'Ring of Jumping', 'Wand of Magic Missiles', 'Spell Scroll (1st level)',
                'Spell Scroll (2nd level)', 'Immovable Rod', 'Decanter of Endless Water',
                'Gauntlets of Ogre Power', 'Headband of Intellect', 'Rope of Climbing',
                'Sending Stones', 'Winged Boots', 'Amulet of Proof Against Detection',
            ],
            rare: [
                'Potion of Superior Healing', '+2 Weapon', '+2 Shield', '+1 Armor',
                'Flame Tongue', 'Ring of Protection', 'Cloak of Displacement',
                'Belt of Hill Giant Strength', 'Cape of the Mountebank',
                'Ring of Spell Storing', 'Necklace of Fireballs', 'Staff of the Woodlands',
                'Wand of Fireballs', 'Wand of Lightning Bolts', 'Spell Scroll (3rd level)',
                'Spell Scroll (4th level)', 'Spell Scroll (5th level)',
                'Amulet of Health', 'Bracers of Defense', 'Periapt of Wound Closure',
            ],
            veryRare: [
                'Potion of Supreme Healing', '+3 Weapon', '+2 Armor',
                'Staff of Power', 'Rod of Absorption', 'Cloak of Invisibility',
                'Ring of Regeneration', 'Spell Scroll (6th-8th level)',
                'Belt of Fire Giant Strength', 'Carpet of Flying', 'Crystal Ball',
                'Dancing Sword', 'Robe of Stars',
            ],
            legendary: [
                '+3 Armor', 'Vorpal Sword', 'Holy Avenger', 'Luck Blade',
                'Staff of the Magi', 'Ring of Three Wishes', 'Spell Scroll (9th level)',
                'Belt of Storm Giant Strength', 'Robe of the Archmagi', 'Hammer of Thunderbolts',
            ],
        },
        quest: [
            'Mysterious key (ornate, warm to the touch)',
            'Sealed letter with an unbroken wax seal (unfamiliar sigil)',
            'Wanted poster with a familiar face',
            'Fragment of a strange map',
            'Small journal written in an unknown language',
            'Broken amulet (half of a matched pair)',
            'Vial of shimmering liquid (unidentified)',
            'Ancient coin from a fallen kingdom',
            'Crumpled note: "Meet at the crossroads. Midnight. Come alone."',
            'Tooth of an unusual creature',
            'Iron lockbox (locked, no key)',
            'Tarnished insignia of a disbanded military order',
            'Crystal shard that glows faintly in darkness',
        ],
    };

    const Loot = {
        generate: (msg) => {
            const args = msg.content.split(/\s+/);
            let cr = 1, count = 1, mode = 'individual';

            for (let i = 1; i < args.length; i++) {
                if (args[i] === '--cr' && args[i + 1]) cr = parseInt(args[i + 1]) || 1;
                if (args[i] === '--count' && args[i + 1]) count = Math.min(parseInt(args[i + 1]) || 1, 20);
                if (args[i] === '--hoard') mode = 'hoard';
                if (args[i] === '--magic') mode = 'magic';
                if (args[i] === '--quest') mode = 'quest';
            }

            if (mode === 'quest') { Loot.generateQuest(); return; }
            if (mode === 'magic') {
                Loot.generateMagicItem(args[args.indexOf('--magic') + 1] || 'common');
                return;
            }

            let tier = '0-4';
            if (cr >= 5 && cr <= 10) tier = '5-10';
            else if (cr >= 11 && cr <= 16) tier = '11-16';
            else if (cr >= 17) tier = '17+';

            const table = LOOT_TABLES.individual[tier];
            let totalCoins = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
            let items = [];

            for (let n = 0; n < count; n++) {
                const roll = rollDice(100);
                for (let i = 0; i < table.coins.length; i++) {
                    if (roll <= table.coins[i].weight) {
                        const coins = table.coins[i].fn();
                        Object.keys(coins).forEach(function(k) { totalCoins[k] += coins[k]; });
                        break;
                    }
                }
            }

            if (rollDice(100) <= 40) {
                items.push(LOOT_TABLES.mundane[rollDice(LOOT_TABLES.mundane.length) - 1]);
            }

            if (mode === 'hoard' || cr >= 5) {
                const magicRoll = rollDice(100);
                let rarity = 'common';
                if (cr >= 17 && magicRoll <= 20) rarity = 'legendary';
                else if (cr >= 11 && magicRoll <= 30) rarity = 'veryRare';
                else if (cr >= 5 && magicRoll <= 40) rarity = 'rare';
                else if (magicRoll <= 50) rarity = 'uncommon';

                if (magicRoll <= 50 || mode === 'hoard') {
                    const magicList = LOOT_TABLES.magic[rarity];
                    items.push('✨ ' + magicList[rollDice(magicList.length) - 1] + ' (' + rarity + ')');
                }
            }

            if (rollDice(100) <= 10) {
                items.push('📜 ' + LOOT_TABLES.quest[rollDice(LOOT_TABLES.quest.length) - 1]);
            }

            state.DMToolkit.encounter.loot.push({ coins: Object.assign({}, totalCoins), items: items.slice() });

            let output = '<div style="' + STYLE.loot + '">';
            output += '<div style="' + STYLE.lootTitle + '">💰 Loot (CR ' + cr + ', ' + count + ' creature' + (count > 1 ? 's' : '') + ')</div>';

            let coinStr = [];
            if (totalCoins.pp > 0) coinStr.push('<span style="color:#b8d4e3;">' + totalCoins.pp + ' pp</span>');
            if (totalCoins.gp > 0) coinStr.push('<span style="' + STYLE.gold + '">' + totalCoins.gp + ' gp</span>');
            if (totalCoins.ep > 0) coinStr.push('<span style="color:#c0c0c0;">' + totalCoins.ep + ' ep</span>');
            if (totalCoins.sp > 0) coinStr.push('<span style="color:#d0d0d0;">' + totalCoins.sp + ' sp</span>');
            if (totalCoins.cp > 0) coinStr.push('<span style="color:#cd7f32;">' + totalCoins.cp + ' cp</span>');

            if (coinStr.length > 0) output += '<div style="padding:4px 0;"><b>🪙 Coins:</b> ' + coinStr.join(', ') + '</div>';
            if (items.length > 0) {
                output += '<div style="padding:4px 0;"><b>🎒 Items:</b></div>';
                items.forEach(function(item) { output += '<div style="padding:2px 8px;">• ' + item + '</div>'; });
            }
            if (coinStr.length === 0 && items.length === 0) output += '<div style="padding:4px;color:#888;">Nothing of value found.</div>';

            output += '<div style="margin-top:8px;text-align:center;">';
            output += '<a style="' + STYLE.btn + '" href="!loot --cr ' + cr + ' --count ' + count + '">🔄 Reroll</a> ';
            output += '<a style="' + STYLE.btnSecondary + '" href="!loot --magic ?{Rarity|common|uncommon|rare|veryRare|legendary}">✨ Magic Item</a>';
            output += '</div></div>';

            if (state.DMToolkit.config.lootWhisper) { whisperGM(output); } else { sendPublic(output); }
        },

        generateMagicItem: (rarity) => {
            const list = LOOT_TABLES.magic[rarity] || LOOT_TABLES.magic.common;
            const item = list[rollDice(list.length) - 1];
            whisperGM('<div style="' + STYLE.loot + '"><div style="' + STYLE.lootTitle + '">✨ Magic Item</div>' +
                '<div style="padding:5px;font-size:14px;text-align:center;"><b>' + item + '</b></div>' +
                '<div style="text-align:center;color:#aaa;">Rarity: ' + rarity + '</div></div>');
        },

        generateQuest: () => {
            const item = LOOT_TABLES.quest[rollDice(LOOT_TABLES.quest.length) - 1];
            whisperGM('<div style="' + STYLE.loot + '"><div style="' + STYLE.lootTitle + '">📜 Quest Item</div>' +
                '<div style="padding:5px;text-align:center;"><b>' + item + '</b></div>' +
                '<div style="margin-top:5px;text-align:center;"><a style="' + STYLE.btn + '" href="!loot --quest">🔄 Another</a></div></div>');
        },
    };

    // ========================================================================
    // MODULE 4: ENCOUNTER SUMMARY
    // ========================================================================
    const Summary = {
        generate: () => {
            const enc = state.DMToolkit.encounter;
            let output = '<div style="' + STYLE.box + '">';
            output += '<div style="' + STYLE.title + '">📋 Encounter Summary</div>';

            if (enc.combatants.length > 0) {
                const npcs = enc.combatants.filter(function(c) { return c.npc; });
                const pcs = enc.combatants.filter(function(c) { return !c.npc; });

                if (pcs.length > 0) {
                    output += '<div style="' + STYLE.subtitle + '">🛡️ Party</div>';
                    pcs.forEach(function(c) { output += '<div style="' + STYLE.row + '">• ' + c.name + ' (Init: ' + c.initiative + ')</div>'; });
                }
                if (npcs.length > 0) {
                    output += '<div style="' + STYLE.subtitle + '">👹 Enemies</div>';
                    npcs.forEach(function(c) { output += '<div style="' + STYLE.row + '">• ' + c.name + ' (Init: ' + c.initiative + ')</div>'; });
                }
            }

            if (enc.loot.length > 0) {
                output += '<div style="' + STYLE.subtitle + '">💰 Total Loot</div>';
                let totalCoins = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
                let allItems = [];
                enc.loot.forEach(function(l) {
                    Object.keys(l.coins).forEach(function(k) { totalCoins[k] += l.coins[k]; });
                    allItems = allItems.concat(l.items);
                });
                let coinStr = [];
                if (totalCoins.pp > 0) coinStr.push(totalCoins.pp + ' pp');
                if (totalCoins.gp > 0) coinStr.push(totalCoins.gp + ' gp');
                if (totalCoins.ep > 0) coinStr.push(totalCoins.ep + ' ep');
                if (totalCoins.sp > 0) coinStr.push(totalCoins.sp + ' sp');
                if (totalCoins.cp > 0) coinStr.push(totalCoins.cp + ' cp');
                if (coinStr.length > 0) output += '<div><span style="' + STYLE.gold + '">🪙 ' + coinStr.join(', ') + '</span></div>';
                allItems.forEach(function(item) { output += '<div style="padding:1px 8px;">• ' + item + '</div>'; });
            }

            if (enc.round > 0) output += '<div style="margin-top:5px;color:#aaa;">⏱️ ' + enc.round + ' round(s)</div>';

            output += '<div style="margin-top:8px;text-align:center;">';
            output += '<a style="' + STYLE.btnSecondary + '" href="!summary --reset">🗑️ Clear</a>';
            output += '</div></div>';
            whisperGM(output);
        },

        reset: () => {
            state.DMToolkit.encounter = { active: false, round: 0, combatants: [], loot: [], log: [] };
            whisperGM('<div style="' + STYLE.box + '"><div style="' + STYLE.title + '">✅ Encounter Data Cleared</div></div>');
        },
    };

    // ========================================================================
    // MODULE 5: DM SCREEN
    // ========================================================================
    const DM_REFERENCES = {
        actions: {
            title: '⚡ Actions in Combat',
            content: '<b>Attack</b> — Melee or ranged attack<br><b>Cast a Spell</b> — Cast time of 1 action<br><b>Dash</b> — Double movement speed<br><b>Disengage</b> — No opportunity attacks this turn<br><b>Dodge</b> — Attacks against you have disadvantage, advantage on DEX saves<br><b>Help</b> — Give ally advantage on next check/attack<br><b>Hide</b> — DEX (Stealth) check<br><b>Ready</b> — Set a trigger for a reaction<br><b>Search</b> — WIS (Perception) or INT (Investigation)<br><b>Use an Object</b> — Interact with a second object<br><br><b>Bonus Actions:</b> Class features, some spells (e.g. Healing Word), two-weapon fighting off-hand attack<br><b>Reactions:</b> Opportunity attack (when enemy leaves your reach), some spells (Shield, Counterspell)',
        },
        cover: {
            title: '🛡️ Cover',
            content: '<b>Half Cover (+2 AC, +2 DEX saves)</b> — Low wall, furniture, another creature<br><b>Three-Quarters Cover (+5 AC, +5 DEX saves)</b> — Portcullis, arrow slit<br><b>Total Cover</b> — Completely concealed, can\'t be targeted',
        },
        dc: {
            title: '🎯 Difficulty Classes',
            content: '<b>5</b> — Very Easy<br><b>10</b> — Easy<br><b>15</b> — Medium<br><b>20</b> — Hard<br><b>25</b> — Very Hard<br><b>30</b> — Nearly Impossible',
        },
        travel: {
            title: '🗺️ Travel Pace',
            content: '<b>Fast:</b> 400 ft/min, 4 mph, 30 mi/day (−5 passive Perception)<br><b>Normal:</b> 300 ft/min, 3 mph, 24 mi/day<br><b>Slow:</b> 200 ft/min, 2 mph, 18 mi/day (can use Stealth)',
        },
        light: {
            title: '💡 Light & Vision',
            content: '<b>Bright Light</b> — Normal vision<br><b>Dim Light</b> — Lightly obscured, disadvantage on Perception (sight)<br><b>Darkness</b> — Heavily obscured, effectively blinded<br><b>Darkvision</b> — See in dark as dim light (no color)',
        },
        exhaustion: {
            title: '😰 Exhaustion Levels',
            content: '<b>1:</b> Disadvantage on ability checks<br><b>2:</b> Speed halved<br><b>3:</b> Disadvantage on attacks and saves<br><b>4:</b> HP maximum halved<br><b>5:</b> Speed reduced to 0<br><b>6:</b> Death',
        },
        concentration: {
            title: '🔮 Concentration',
            content: '<b>CON save when taking damage:</b> DC 10 or half damage taken (whichever is higher)<br><b>Broken by:</b> Casting another concentration spell, incapacitation, death<br><b>Environment:</b> DM may call for DC 10 CON save',
        },
        encounter_difficulty: {
            title: '📊 Encounter Difficulty (XP per PC)',
            content: '<b>Lvl 1:</b> Easy 25 / Med 50 / Hard 75 / Deadly 100<br><b>Lvl 3:</b> Easy 75 / Med 150 / Hard 225 / Deadly 400<br><b>Lvl 5:</b> Easy 250 / Med 500 / Hard 750 / Deadly 1100<br><b>Lvl 10:</b> Easy 600 / Med 1200 / Hard 1900 / Deadly 2800<br><b>Lvl 15:</b> Easy 1800 / Med 3600 / Hard 5100 / Deadly 7800<br><b>Lvl 20:</b> Easy 2800 / Med 5700 / Hard 8500 / Deadly 12700<br><br><b>Multipliers:</b> 2 monsters ×1.5, 3-6 ×2, 7-10 ×2.5, 11-14 ×3, 15+ ×4',
        },
    };

    const DMScreen = {
        show: (msg) => {
            const args = msg.content.split(/\s+/);
            const topic = (args[1] || '--menu').replace('--', '');

            if (topic === 'menu' || !DM_REFERENCES[topic]) {
                DMScreen.showMenu();
                return;
            }

            const ref = DM_REFERENCES[topic];
            let output = '<div style="' + STYLE.dmScreen + '">';
            output += '<div style="' + STYLE.dmTitle + '">' + ref.title + '</div>';
            output += '<div style="padding:5px;font-size:12px;line-height:1.6;">' + ref.content + '</div>';
            output += '<div style="margin-top:5px;text-align:center;"><a style="' + STYLE.btnSecondary + '" href="!dm">↩ Back</a></div></div>';
            whisperGM(output);
        },

        showMenu: () => {
            let output = '<div style="' + STYLE.dmScreen + '">';
            output += '<div style="' + STYLE.dmTitle + '">📖 DM Quick Reference</div>';

            Object.keys(DM_REFERENCES).forEach(function(key) {
                output += '<div style="padding:2px 0;"><a style="' + STYLE.btn + 'display:block;text-align:left;margin:1px 0;" href="!dm --' + key + '">' + DM_REFERENCES[key].title + '</a></div>';
            });

            output += '<div style="margin-top:8px;border-top:1px solid #48cae4;padding-top:6px;text-align:center;">';
            output += '<a style="' + STYLE.btn + '" href="!combat --all">⚔️ Roll All Init</a> ';
            output += '<a style="' + STYLE.btn + '" href="!combat --npcs">👹 Roll NPC Init</a> ';
            output += '<a style="' + STYLE.btn + '" href="!condition">📌 Conditions</a> ';
            output += '<a style="' + STYLE.btn + '" href="!loot --cr ?{CR|1} --count ?{Creatures|1}">💰 Loot</a>';
            output += '</div></div>';
            whisperGM(output);
        },
    };

    // ========================================================================
    // MODULE 6: PLAYER GUIDE (Public-facing 5E reference)
    // ========================================================================
    const PLAYER_GUIDES = {
        turn: {
            title: '🎮 Your Turn in Combat',
            content: '<b>On your turn you can:</b><br><br>' +
                '1️⃣ <b>Move</b> — up to your speed (usually 30 ft). You can split movement around actions.<br><br>' +
                '2️⃣ <b>Take ONE Action:</b><br>' +
                '• <b>Attack</b> — Swing your weapon or fire a ranged weapon<br>' +
                '• <b>Cast a Spell</b> — If it has a casting time of "1 action"<br>' +
                '• <b>Dash</b> — Double your movement this turn<br>' +
                '• <b>Dodge</b> — Harder to hit until your next turn<br>' +
                '• <b>Disengage</b> — Move away without provoking attacks<br>' +
                '• <b>Help</b> — Give an ally advantage on their next roll<br>' +
                '• <b>Hide</b> — Try to become hidden (Stealth check)<br>' +
                '• <b>Ready</b> — Prepare an action with a trigger ("When the goblin opens the door, I shoot")<br><br>' +
                '3️⃣ <b>Bonus Action</b> (if you have one) — Some spells and class features<br><br>' +
                '4️⃣ <b>Free Interaction</b> — Draw/sheathe a weapon, open a door, speak briefly<br><br>' +
                '💡 <b>Reaction</b> (once per round, not on your turn): Opportunity Attack when enemy leaves your reach, or spells like Shield',
        },
        attacks: {
            title: '⚔️ How Attacks Work',
            content: '<b>Melee Attack:</b> Roll d20 + STR mod + proficiency bonus vs target AC<br>' +
                '<b>Ranged Attack:</b> Roll d20 + DEX mod + proficiency bonus vs target AC<br>' +
                '<b>Finesse weapons:</b> Choose STR or DEX<br><br>' +
                '<b>If d20 roll ≥ AC → Hit!</b> Roll damage dice + modifier<br>' +
                '<b>Natural 20</b> = Critical Hit! Roll damage dice twice<br>' +
                '<b>Natural 1</b> = Automatic miss<br><br>' +
                '<b>Advantage:</b> Roll 2d20, take the higher<br>' +
                '<b>Disadvantage:</b> Roll 2d20, take the lower',
        },
        spells: {
            title: '✨ Spellcasting Basics',
            content: '<b>Spell Attack:</b> d20 + spellcasting ability mod + proficiency<br>' +
                '<b>Spell Save DC:</b> 8 + spellcasting ability mod + proficiency<br><br>' +
                '<b>Spell Slots:</b> You spend a slot to cast. Higher-level slots can cast lower-level spells (often with bonus effects).<br><br>' +
                '<b>Cantrips:</b> Free to cast, no slot needed. Scale with character level.<br><br>' +
                '<b>Concentration:</b> Only one at a time. If you take damage, make a CON save (DC 10 or half damage). Casting another concentration spell ends the first.<br><br>' +
                '<b>Components:</b> V (verbal/speaking), S (somatic/gestures), M (material/focus)',
        },
        skills: {
            title: '🎯 Skills & Ability Checks',
            content: '<b>Roll:</b> d20 + ability modifier + proficiency (if proficient)<br><br>' +
                '<b>STR:</b> Athletics<br>' +
                '<b>DEX:</b> Acrobatics, Sleight of Hand, Stealth<br>' +
                '<b>INT:</b> Arcana, History, Investigation, Nature, Religion<br>' +
                '<b>WIS:</b> Animal Handling, Insight, Medicine, Perception, Survival<br>' +
                '<b>CHA:</b> Deception, Intimidation, Performance, Persuasion<br><br>' +
                '<b>Passive Perception:</b> 10 + Perception modifier (always "on")',
        },
        conditions: {
            title: '🤕 Common Conditions',
            content: '<b>Prone:</b> Must spend half movement to stand. Melee attacks against you have advantage, ranged have disadvantage. Your attacks have disadvantage.<br><br>' +
                '<b>Grappled:</b> Your speed is 0. You can try to escape (Athletics or Acrobatics vs their Athletics).<br><br>' +
                '<b>Frightened:</b> Disadvantage on attacks/checks while you can see the source. Can\'t willingly move closer.<br><br>' +
                '<b>Poisoned:</b> Disadvantage on attacks and ability checks.<br><br>' +
                '<b>Stunned/Paralyzed:</b> Can\'t move or act. Attacks against you have advantage. If paralyzed, melee hits are auto-crits.<br><br>' +
                '<b>Unconscious:</b> Like paralyzed but you drop everything and fall prone.',
        },
        rest: {
            title: '😴 Resting',
            content: '<b>Short Rest (1 hour):</b><br>' +
                '• Spend Hit Dice to heal (roll HD + CON mod per die)<br>' +
                '• Some class features recharge (Fighter\'s Action Surge, Warlock spell slots, etc.)<br><br>' +
                '<b>Long Rest (8 hours):</b><br>' +
                '• Regain all HP<br>' +
                '• Regain up to half your total Hit Dice (min 1)<br>' +
                '• All spell slots restored<br>' +
                '• Most class features recharge<br>' +
                '• One level of exhaustion removed<br>' +
                '• Only one long rest per 24 hours',
        },
    };

    const PlayerGuide = {
        show: (msg) => {
            const args = msg.content.split(/\s+/);
            const topic = (args[1] || '--menu').replace('--', '');
            const who = msg.who.replace(' (GM)', '');

            if (topic === 'menu' || !PLAYER_GUIDES[topic]) {
                PlayerGuide.showMenu(who);
                return;
            }

            const ref = PLAYER_GUIDES[topic];
            let output = '<div style="' + STYLE.guide + '">';
            output += '<div style="' + STYLE.guideTitle + '">' + ref.title + '</div>';
            output += '<div style="padding:5px;font-size:12px;line-height:1.6;">' + ref.content + '</div>';
            output += '<div style="margin-top:5px;text-align:center;"><a style="' + STYLE.btnSuccess + '" href="!guide">↩ Back to Guide</a></div></div>';
            sendChat('DMToolkit', '/w "' + who + '" ' + output);
        },

        showMenu: (who) => {
            let output = '<div style="' + STYLE.guide + '">';
            output += '<div style="' + STYLE.guideTitle + '">📚 Player\'s Quick Guide</div>';
            output += '<p style="color:#aaa;font-size:10px;text-align:center;">Click any topic for a quick reference!</p>';

            Object.keys(PLAYER_GUIDES).forEach(function(key) {
                output += '<div style="padding:2px 0;"><a style="' + STYLE.btnSuccess + 'display:block;text-align:left;margin:1px 0;" href="!guide --' + key + '">' + PLAYER_GUIDES[key].title + '</a></div>';
            });

            output += '</div>';
            sendChat('DMToolkit', '/w "' + who + '" ' + output);
        },
    };

    // ========================================================================
    // MODULE 7: SESSION SETUP (Beyond20 stat sync)
    // ========================================================================
    const Setup = {
        run: (msg) => {
            const args = msg.content.split(/\s+/);
            const subCmd = args[1] || '--full';
            if (subCmd === '--bulk') { Setup.bulkImport(msg); return; }
            if (subCmd === '--srd') { Setup.srdLookup(); return; }
            if (subCmd === '--save') { Setup.saveStats(msg); return; }
            Setup.notifyPlayers();
            Setup.showGMSetup();
        },

        notifyPlayers: () => {
            const pageId = Campaign().get('playerpageid');
            const tokens = findObjs({ type: 'graphic', pageid: pageId, layer: 'objects' })
                .filter(function(t) { return t.get('represents') && !isNPC(t.get('represents')); });

            const playerChars = {};
            tokens.forEach(function(token) {
                const charId = token.get('represents');
                const character = getObj('character', charId);
                if (!character) return;
                const controlledBy = character.get('controlledby');
                if (!controlledBy || controlledBy === '') return;
                const playerIds = controlledBy.split(',').filter(function(p) { return p.trim() !== ''; });
                playerIds.forEach(function(pid) {
                    if (!playerChars[pid]) playerChars[pid] = [];
                    const already = playerChars[pid].some(function(c) { return c.charId === charId; });
                    if (!already) {
                        playerChars[pid].push({
                            charId: charId,
                            name: token.get('name') || character.get('name'),
                        });
                    }
                });
            });

            Object.keys(playerChars).forEach(function(pid) {
                const player = getObj('player', pid);
                if (!player || playerIsGM(pid)) return;
                const displayName = player.get('displayname');
                const chars = playerChars[pid];

                let output = '<div style="' + STYLE.guide + '">';
                output += '<div style="' + STYLE.guideTitle + '">📋 Session Setup — Sync Your Stats!</div>';
                output += '<p style="color:#ccc;font-size:11px;text-align:center;">Open your D&D Beyond character sheet and enter these values so the DM\'s tools work properly.</p>';

                chars.forEach(function(c) {
                    const currentInit = getInitBonus(c.charId);
                    const initSign = currentInit >= 0 ? '+' : '';
                    output += '<div style="border:1px solid #66bb6a;padding:6px;margin:4px 0;border-radius:4px;">';
                    output += '<b style="color:#66bb6a;font-size:13px;">' + c.name + '</b>';
                    output += ' <span style="color:#888;font-size:10px;">(init: ' + initSign + currentInit + ')</span><br>';
                    output += '<a style="' + STYLE.btnSuccess + 'margin:2px;" href="!setup --save ' + c.charId + ' init ?{' + c.name + ' — Initiative Modifier (DEX mod + any bonuses)|0}">⚔️ Initiative</a> ';
                    output += '<a style="' + STYLE.btnSuccess + 'margin:2px;" href="!setup --save ' + c.charId + ' ac ?{' + c.name + ' — Armor Class|10}">🛡️ AC</a> ';
                    output += '<a style="' + STYLE.btnSuccess + 'margin:2px;" href="!setup --save ' + c.charId + ' hp ?{' + c.name + ' — Max HP|10}">❤️ HP</a>';
                    output += '</div>';
                });

                output += '<p style="color:#aaa;font-size:10px;text-align:center;">💡 Find these on your D&D Beyond character sheet overview page</p>';
                output += '</div>';

                sendChat('DMToolkit', '/w "' + displayName + '" ' + output);
            });

            const playerCount = Object.keys(playerChars).filter(function(pid) { return !playerIsGM(pid); }).length;
            whisperGM('<div style="' + STYLE.box + '"><div style="' + STYLE.title + '">📋 Setup Sent!</div>' +
                '<p style="text-align:center;">Sent to <b>' + playerCount + '</b> player(s).</p></div>');
        },

        showGMSetup: () => {
            const pageId = Campaign().get('playerpageid');
            const tokens = findObjs({ type: 'graphic', pageid: pageId, layer: 'objects' })
                .filter(function(t) { return t.get('represents') && isNPC(t.get('represents')); });

            const seen = {};
            const uniqueNPCs = [];
            tokens.forEach(function(token) {
                const charId = token.get('represents');
                if (seen[charId]) return;
                seen[charId] = true;
                const name = token.get('name') || getCharName(charId);
                const currentInit = getInitBonus(charId);
                const srdResult = getSRDInit(getCharName(charId));
                uniqueNPCs.push({ charId: charId, name: name, currentInit: currentInit, srdInit: srdResult });
            });

            let output = '<div style="' + STYLE.box + '">';
            output += '<div style="' + STYLE.title + '">👹 NPC Setup</div>';

            if (uniqueNPCs.length === 0) {
                output += '<p style="color:#aaa;">No NPCs on current page.</p>';
            } else {
                uniqueNPCs.forEach(function(npc) {
                    const srdLabel = npc.srdInit !== null
                        ? ' <span style="color:#66bb6a;font-size:10px;">(SRD: +' + npc.srdInit + ')</span>'
                        : ' <span style="color:#ff9800;font-size:10px;">(not in SRD)</span>';
                    const initSign = npc.currentInit >= 0 ? '+' : '';

                    output += '<div style="' + STYLE.row + 'padding:3px 0;">';
                    output += '<b>' + npc.name + '</b> ' + initSign + npc.currentInit + srdLabel + ' ';
                    output += '<a style="' + STYLE.btn + 'font-size:10px;" href="!setup --save ' + npc.charId + ' init ?{' + npc.name + ' init|' + (npc.srdInit || 0) + '}">Set</a>';
                    output += '</div>';
                });
            }

            output += '<div style="margin-top:8px;text-align:center;">';
            output += '<a style="' + STYLE.btnSuccess + '" href="!setup --srd">📖 Auto-fill from SRD</a> ';
            output += '<a style="' + STYLE.btnSecondary + '" href="!setup --bulk">📝 Bulk Import</a>';
            output += '</div></div>';

            whisperGM(output);
        },

        saveStats: (msg) => {
            const args = msg.content.split(/\s+/);
            const charId = args[2];
            const stat = args[3];
            const value = parseInt(args[4]);

            if (!charId || !stat || isNaN(value)) {
                whisperGM('<div style="' + STYLE.box + '"><div style="' + STYLE.title + '">⚠️ Invalid format</div></div>');
                return;
            }

            const character = getObj('character', charId);
            const charName = character ? character.get('name') : 'Unknown';

            if (stat === 'init') {
                state.DMToolkit.initMods[charId] = value;
                // Write to sheet attribute too
                const existing = findObjs({ type: 'attribute', characterid: charId, name: 'initiative_bonus' })[0];
                if (existing) { existing.set('current', String(value)); }
                else { createObj('attribute', { characterid: charId, name: 'initiative_bonus', current: String(value) }); }

                const sign = value >= 0 ? '+' : '';
                const response = '<div style="' + STYLE.box + '"><div style="' + STYLE.title + '">✅ Initiative Updated</div>' +
                    '<p style="text-align:center;"><b>' + charName + '</b> → ' + sign + value + '</p></div>';

                if (playerIsGM(msg.playerid)) {
                    whisperGM(response);
                } else {
                    const player = getObj('player', msg.playerid);
                    if (player) sendChat('DMToolkit', '/w "' + player.get('displayname') + '" ' + response);
                }
            } else if (stat === 'ac') {
                const existing = findObjs({ type: 'attribute', characterid: charId, name: 'ac' })[0];
                if (existing) { existing.set('current', String(value)); }
                else { createObj('attribute', { characterid: charId, name: 'ac', current: String(value) }); }
                if (isNPC(charId)) {
                    const npcAC = findObjs({ type: 'attribute', characterid: charId, name: 'npc_ac' })[0];
                    if (npcAC) { npcAC.set('current', String(value)); }
                    else { createObj('attribute', { characterid: charId, name: 'npc_ac', current: String(value) }); }
                }
                const response = '<div style="' + STYLE.box + '"><div style="' + STYLE.title + '">✅ AC Updated</div>' +
                    '<p style="text-align:center;"><b>' + charName + '</b> → AC ' + value + '</p></div>';
                if (playerIsGM(msg.playerid)) { whisperGM(response); }
                else {
                    const player = getObj('player', msg.playerid);
                    if (player) sendChat('DMToolkit', '/w "' + player.get('displayname') + '" ' + response);
                }
            } else if (stat === 'hp') {
                const existing = findObjs({ type: 'attribute', characterid: charId, name: 'hp' })[0];
                if (existing) { existing.set('current', String(value)); existing.set('max', String(value)); }
                else { createObj('attribute', { characterid: charId, name: 'hp', current: String(value), max: String(value) }); }
                const response = '<div style="' + STYLE.box + '"><div style="' + STYLE.title + '">✅ HP Updated</div>' +
                    '<p style="text-align:center;"><b>' + charName + '</b> → ' + value + ' HP</p></div>';
                if (playerIsGM(msg.playerid)) { whisperGM(response); }
                else {
                    const player = getObj('player', msg.playerid);
                    if (player) sendChat('DMToolkit', '/w "' + player.get('displayname') + '" ' + response);
                }
            }
        },

        srdLookup: () => {
            const pageId = Campaign().get('playerpageid');
            const tokens = findObjs({ type: 'graphic', pageid: pageId, layer: 'objects' })
                .filter(function(t) { return t.get('represents') && isNPC(t.get('represents')); });

            const seen = {};
            let filled = 0, skipped = 0;
            let results = [];

            tokens.forEach(function(token) {
                const charId = token.get('represents');
                if (seen[charId]) return;
                seen[charId] = true;
                const charName = getCharName(charId);
                const srdInit = getSRDInit(charName);
                if (srdInit !== null) {
                    state.DMToolkit.initMods[charId] = srdInit;
                    filled++;
                    results.push({ name: charName, init: srdInit, found: true });
                } else {
                    skipped++;
                    results.push({ name: charName, init: 0, found: false });
                }
            });

            let output = '<div style="' + STYLE.box + '">';
            output += '<div style="' + STYLE.title + '">📖 SRD Auto-Fill</div>';
            output += '<p style="text-align:center;color:#aaa;">Found: <b style="color:#66bb6a;">' + filled + '</b> | Missing: <b style="color:#ff9800;">' + skipped + '</b></p>';

            results.forEach(function(r) {
                const icon = r.found ? '✅' : '⚠️';
                const sign = r.init >= 0 ? '+' : '';
                output += '<div style="' + STYLE.row + '">' + icon + ' <b>' + r.name + '</b> → ' +
                    (r.found ? sign + r.init : '<i>not found</i>') + '</div>';
            });

            if (skipped > 0) {
                output += '<p style="color:#aaa;font-size:10px;">Use <b>!combat --setinit</b> or <b>!setup --bulk</b> for missing NPCs.</p>';
            }
            output += '</div>';
            whisperGM(output);
        },

        bulkImport: (msg) => {
            const content = msg.content.replace('!setup --bulk', '').trim();
            if (!content || content === '') {
                whisperGM('<div style="' + STYLE.box + '"><div style="' + STYLE.title + '">📝 Bulk Import</div>' +
                    '<p style="font-size:11px;">Paste character names and init modifiers:</p>' +
                    '<p style="font-size:11px;color:#66bb6a;"><code>!setup --bulk Talaczar:3, Saphira:2, Giant Goat:0, Scout:2</code></p>' +
                    '<p style="font-size:10px;color:#aaa;">Matches character sheet names (case-insensitive).</p></div>');
                return;
            }

            const pairs = content.split(',');
            let results = [];

            pairs.forEach(function(pair) {
                const parts = pair.trim().split(':');
                if (parts.length < 2) return;
                const name = parts[0].trim();
                const mod = parseInt(parts[1].trim());
                if (isNaN(mod)) return;

                const allChars = findObjs({ type: 'character' });
                const matches = allChars.filter(function(c) {
                    return c.get('name').toLowerCase() === name.toLowerCase();
                });

                if (matches.length > 0) {
                    matches.forEach(function(c) { state.DMToolkit.initMods[c.id] = mod; });
                    results.push({ name: name, mod: mod, found: true });
                } else {
                    results.push({ name: name, mod: mod, found: false });
                }
            });

            let output = '<div style="' + STYLE.box + '">';
            output += '<div style="' + STYLE.title + '">📝 Bulk Import</div>';
            results.forEach(function(r) {
                const icon = r.found ? '✅' : '❌';
                const sign = r.mod >= 0 ? '+' : '';
                output += '<div style="' + STYLE.row + '">' + icon + ' ' + r.name + ' → ' + sign + r.mod +
                    (r.found ? '' : ' <i style="color:#ff6b6b;">not found</i>') + '</div>';
            });
            output += '</div>';
            whisperGM(output);
        },
    };

    // ========================================================================
    // MODULE 8: CONCENTRATION TRACKER
    // ========================================================================
    // Listens for concentration spells from Beyond20/OGL sheet, tracks who is
    // concentrating, prompts for CON saves when damage is taken.
    const Concentration = {
        // Status marker used for concentration
        MARKER: 'stopwatch',

        // Get all current concentration entries
        getAll: () => { return state.DMToolkit.concentration || {}; },

        // Set concentration for a character
        set: (charId, spellName, tokenId) => {
            const prev = state.DMToolkit.concentration[charId];
            state.DMToolkit.concentration[charId] = { spell: spellName, tokenId: tokenId };

            // Apply marker to token
            const token = getObj('graphic', tokenId);
            if (token) {
                const markers = token.get('statusmarkers') || '';
                if (markers.indexOf(Concentration.MARKER) === -1) {
                    token.set('statusmarkers', markers ? markers + ',' + Concentration.MARKER : Concentration.MARKER);
                }
            }

            // Announce
            const charName = getCharName(charId);
            if (prev && prev.spell !== spellName) {
                sendChat('DMToolkit', '<div style="' + STYLE.box + '">' +
                    '<div style="' + STYLE.title + '">🔮 Concentration Changed</div>' +
                    '<p style="text-align:center;"><b>' + charName + '</b> dropped <i>' + prev.spell + '</i><br>' +
                    'Now concentrating on <b style="color:#ff9800;">' + spellName + '</b></p></div>');
            } else if (!prev) {
                sendChat('DMToolkit', '<div style="' + STYLE.box + '">' +
                    '<div style="' + STYLE.title + '">🔮 Concentration</div>' +
                    '<p style="text-align:center;"><b>' + charName + '</b> is concentrating on<br>' +
                    '<b style="color:#ff9800;">' + spellName + '</b></p></div>');
            }
        },

        // Drop concentration for a character
        drop: (charId, reason) => {
            const entry = state.DMToolkit.concentration[charId];
            if (!entry) return;

            // Remove marker from token
            const token = getObj('graphic', entry.tokenId);
            if (token) {
                const markers = (token.get('statusmarkers') || '').split(',')
                    .filter(function(m) { return m !== Concentration.MARKER; })
                    .join(',');
                token.set('statusmarkers', markers);
            }

            const charName = getCharName(charId);
            const spellName = entry.spell;
            delete state.DMToolkit.concentration[charId];

            const reasonText = reason ? ' (' + reason + ')' : '';
            sendChat('DMToolkit', '<div style="' + STYLE.box + '">' +
                '<div style="' + STYLE.title + '">💥 Concentration Broken!</div>' +
                '<p style="text-align:center;"><b>' + charName + '</b> lost concentration on<br>' +
                '<b style="color:#ff6b6b;">' + spellName + '</b>' + reasonText + '</p></div>');
        },

        // Handle the !conc command
        handleCommand: (msg) => {
            const args = msg.content.split(/\s+/);
            const subCmd = args[1];

            if (subCmd === '--drop') {
                // Drop concentration on selected tokens
                const selected = msg.selected;
                if (selected && selected.length > 0) {
                    selected.forEach(function(sel) {
                        const token = getObj('graphic', sel._id);
                        if (!token) return;
                        const charId = token.get('represents');
                        if (charId && state.DMToolkit.concentration[charId]) {
                            Concentration.drop(charId, 'manual');
                        }
                    });
                } else {
                    // Try by name: !conc --drop CharName
                    const name = args.slice(2).join(' ');
                    if (name) {
                        const chars = findObjs({ type: 'character' }).filter(function(c) {
                            return c.get('name').toLowerCase() === name.toLowerCase();
                        });
                        chars.forEach(function(c) {
                            if (state.DMToolkit.concentration[c.id]) {
                                Concentration.drop(c.id, 'manual');
                            }
                        });
                    }
                }
                return;
            }

            if (subCmd === '--clear') {
                const all = Object.keys(state.DMToolkit.concentration);
                all.forEach(function(charId) { Concentration.drop(charId, 'cleared'); });
                whisperGM('<div style="' + STYLE.box + '"><div style="' + STYLE.title + '">🔮 Cleared</div>' +
                    '<p style="text-align:center;">All concentration cleared.</p></div>');
                return;
            }

            // Default: show who is concentrating
            const entries = state.DMToolkit.concentration;
            const charIds = Object.keys(entries);

            let output = '<div style="' + STYLE.box + '">';
            output += '<div style="' + STYLE.title + '">🔮 Concentration Tracker</div>';

            if (charIds.length === 0) {
                output += '<p style="color:#aaa;text-align:center;">Nobody is concentrating.</p>';
            } else {
                charIds.forEach(function(charId) {
                    const entry = entries[charId];
                    const charName = getCharName(charId);
                    output += '<div style="' + STYLE.row + 'padding:3px;">';
                    output += '<b>' + charName + '</b> → <span style="color:#ff9800;">' + entry.spell + '</span> ';
                    output += '<a style="' + STYLE.btn + 'font-size:10px;" href="!conc --drop ' + charName + '">💥 Drop</a>';
                    output += '</div>';
                });
            }

            output += '<div style="margin-top:6px;text-align:center;">';
            output += '<a style="' + STYLE.btnSecondary + '" href="!conc --clear">Clear All</a>';
            output += '</div></div>';
            whisperGM(output);
        },

        // Listen to ALL chat messages for concentration spells
        // Beyond20 and OGL sheet both use {{concentration=1}} in roll templates
        handleChat: (msg) => {
            // Skip API commands (already handled by handleInput)
            if (msg.type === 'api') return;
            // Only care about messages with roll templates
            if (!msg.rolltemplate) return;
            // Check for concentration flag in content
            if (!msg.content || msg.content.indexOf('{{concentration=1}}') === -1) return;

            // Extract character name from the message
            const charNameMatch = msg.content.match(/charname=([^}]+)/);
            if (!charNameMatch) return;
            const charName = charNameMatch[1].trim();

            // Extract spell name
            let spellName = 'Unknown Spell';
            // Try 'name=' (spellcard template) first, then 'rname=' (attack templates)
            const nameMatch = msg.content.match(/\{\{name=([^}]+)\}\}/);
            const rnameMatch = msg.content.match(/rname=([^}]+)\}/);
            if (nameMatch) spellName = nameMatch[1].trim();
            else if (rnameMatch) spellName = rnameMatch[1].trim();

            // Find the character
            const characters = findObjs({ type: 'character' }).filter(function(c) {
                return c.get('name').toLowerCase() === charName.toLowerCase();
            });
            if (characters.length === 0) {
                log('DMToolkit Concentration: Could not find character "' + charName + '"');
                return;
            }
            const character = characters[0];
            const charId = character.id;

            // Find the token on the current page
            const pageId = Campaign().get('playerpageid');
            const tokens = findObjs({ type: 'graphic', pageid: pageId, represents: charId, layer: 'objects' });
            const tokenId = tokens.length > 0 ? tokens[0].get('_id') : null;

            if (!tokenId) {
                log('DMToolkit Concentration: No token found for "' + charName + '" on current page');
                return;
            }

            // Set concentration (will handle replacing previous concentration)
            Concentration.set(charId, spellName, tokenId);
        },

        // Called when a token's bar1_value changes (HP damage)
        handleDamage: (obj, prev) => {
            const charId = obj.get('represents');
            if (!charId) return;

            // Check if this character is concentrating
            const entry = state.DMToolkit.concentration[charId];
            if (!entry) return;

            // Calculate damage taken
            const oldHP = parseInt(prev['bar1_value']) || 0;
            const newHP = parseInt(obj.get('bar1_value')) || 0;
            const damage = oldHP - newHP;

            // Only trigger on damage (not healing)
            if (damage <= 0) return;

            // Calculate CON save DC: max(10, floor(damage / 2))
            const dc = Math.max(10, Math.floor(damage / 2));
            const charName = obj.get('name') || getCharName(charId);
            const spellName = entry.spell;

            // Prompt GM with CON save button
            let output = '<div style="' + STYLE.box + '">';
            output += '<div style="' + STYLE.title + '">⚡ Concentration Check!</div>';
            output += '<p style="text-align:center;">';
            output += '<b>' + charName + '</b> took <b style="color:#ff6b6b;">' + damage + ' damage</b><br>';
            output += 'while concentrating on <b style="color:#ff9800;">' + spellName + '</b></p>';
            output += '<p style="text-align:center;font-size:14px;margin:4px 0;">';
            output += 'CON Save DC: <b style="color:#e94560;font-size:18px;">' + dc + '</b></p>';
            output += '<div style="text-align:center;">';
            output += '<a style="' + STYLE.btnSuccess + 'padding:5px 12px;font-size:12px;" href="!conc --pass">✅ Passed</a> ';
            output += '<a style="' + STYLE.btn + 'padding:5px 12px;font-size:12px;" href="!conc --fail ' + charId + '">💥 Failed</a>';
            output += '</div>';

            // If the character went to 0 HP, concentration auto-drops
            if (newHP <= 0) {
                output += '<p style="text-align:center;color:#ff6b6b;font-size:11px;margin-top:4px;">' +
                    '⚠️ ' + charName + ' dropped to 0 HP — concentration automatically lost!</p>';
                Concentration.drop(charId, 'dropped to 0 HP');
            }

            output += '</div>';
            whisperGM(output);
        },
    };

    // ========================================================================
    // MODULE 9: HP MONITOR / DEATH TRACKER
    // ========================================================================
    const HPMonitor = {
        DEAD_MARKER: 'dead',
        UNCONSCIOUS_MARKER: 'skull',
        GRAY_TINT: '#888888',

        handleHPChange: (obj, prev) => {
            if (!state.DMToolkit.config.hpMonitor) return;

            const charId = obj.get('represents');
            const oldHP = parseInt(prev['bar1_value']) || 0;
            const newHP = parseInt(obj.get('bar1_value')) || 0;
            const maxHP = parseInt(obj.get('bar1_max')) || 0;
            const tokenName = obj.get('name') || 'Token';

            // --- DROP TO 0 HP ---
            if (newHP <= 0 && oldHP > 0) {
                const npc = charId ? isNPC(charId) : true;
                const markers = (obj.get('statusmarkers') || '').split(',').filter(function(m) { return m; });

                if (npc) {
                    // NPC: apply dead marker + gray tint
                    if (!markers.includes(HPMonitor.DEAD_MARKER)) {
                        markers.push(HPMonitor.DEAD_MARKER);
                        obj.set('statusmarkers', markers.join(','));
                    }
                    obj.set('tint_color', HPMonitor.GRAY_TINT);

                    whisperGM('<div style="' + STYLE.box + '">' +
                        '<div style="' + STYLE.title + '">💀 NPC Defeated</div>' +
                        '<p style="text-align:center;"><b>' + tokenName + '</b> has been slain!</p></div>');

                    // Track for XP if encounter is active
                    if (state.DMToolkit.encounter.active && charId) {
                        XPTracker.recordKill(charId, tokenName, obj.get('_id'));
                    }
                } else {
                    // PC: apply unconscious marker
                    if (!markers.includes(HPMonitor.UNCONSCIOUS_MARKER)) {
                        markers.push(HPMonitor.UNCONSCIOUS_MARKER);
                        obj.set('statusmarkers', markers.join(','));
                    }

                    sendPublic('<div style="' + STYLE.box + '">' +
                        '<div style="' + STYLE.title + '">⚠️ ' + tokenName + ' Has Fallen!</div>' +
                        '<p style="text-align:center;"><b>' + tokenName + '</b> has dropped to 0 HP and is <b style="color:#ff6b6b;">unconscious</b>!</p></div>');
                }
            }

            // --- RECOVER FROM 0 HP ---
            if (newHP > 0 && oldHP <= 0 && oldHP !== '') {
                const npc = charId ? isNPC(charId) : true;

                if (!npc) {
                    // PC recovered: remove unconscious marker
                    const markers = (obj.get('statusmarkers') || '').split(',')
                        .filter(function(m) { return m !== HPMonitor.UNCONSCIOUS_MARKER && m !== HPMonitor.DEAD_MARKER; });
                    obj.set('statusmarkers', markers.join(','));

                    sendPublic('<div style="' + STYLE.box + '">' +
                        '<div style="text-align:center;">💚 <b>' + tokenName + '</b> is back on their feet! (' + newHP + ' HP)</div></div>');
                }
            }

            // --- BLOODIED WARNING (optional: half HP) ---
            if (state.DMToolkit.config.bloodiedWarning && maxHP > 0 && newHP > 0) {
                const halfHP = Math.floor(maxHP / 2);
                if (oldHP > halfHP && newHP <= halfHP) {
                    const npc = charId ? isNPC(charId) : true;
                    if (npc) {
                        whisperGM('<div style="' + STYLE.box + '">' +
                            '<div style="text-align:center;">🩸 <b>' + tokenName + '</b> is <b style="color:#ff9800;">bloodied</b>! (' + newHP + '/' + maxHP + ' HP)</div></div>');
                    }
                }
            }
        },
    };

    // ========================================================================
    // MODULE 10: XP TRACKER
    // ========================================================================
    // CR-to-XP table (5E SRD standard)
    const CR_XP = {
        '0':10,'1/8':25,'1/4':50,'1/2':100,
        '1':200,'2':450,'3':700,'4':1100,'5':1800,
        '6':2300,'7':2900,'8':3900,'9':5000,'10':5900,
        '11':7200,'12':8400,'13':10000,'14':11500,'15':13000,
        '16':15000,'17':18000,'18':20000,'19':22000,'20':25000,
        '21':33000,'22':41000,'23':50000,'24':62000,'25':75000,
        '26':90000,'27':105000,'28':120000,'29':135000,'30':155000,
    };

    // SRD monster CR lookup (common monsters)
    const SRD_CR = {
        'commoner':'0','goat':'0','cat':'0','rat':'0','bat':'0','frog':'0','hawk':'0',
        'hyena':'0','jackal':'0','spider':'0','owl':'0','raven':'0','scorpion':'0',
        'bandit':'1/8','guard':'1/8','kobold':'1/8','cultist':'1/8','noble':'1/8',
        'stirge':'1/8','tribal warrior':'1/8','mastiff':'1/8','poisonous snake':'1/8',
        'goblin':'1/4','skeleton':'1/4','wolf':'1/4','zombie':'1/4','acolyte':'1/4',
        'blink dog':'1/4','boar':'1/4','drow':'1/4','elk':'1/4','giant bat':'1/4',
        'giant frog':'1/4','giant wolf spider':'1/4','panther':'1/4','pseudodragon':'1/4',
        'giant goat':'1/2','orc':'1/2','hobgoblin':'1/2','gnoll':'1/2','lizardfolk':'1/2',
        'scout':'1/2','shadow':'1/2','satyr':'1/2','thug':'1/2','worg':'1/2',
        'bugbear':'1','dire wolf':'1','ghoul':'1','giant eagle':'1','giant spider':'1',
        'hippogriff':'1','imp':'1','spy':'1','tiger':'1','harpy':'1',
        'bandit captain':'2','berserker':'2','centaur':'2','druid':'2','gargoyle':'2',
        'ghast':'2','griffon':'2','mimic':'2','ogre':'2','priest':'2','wererat':'2',
        'basilisk':'3','hell hound':'3','knight':'3','manticore':'3','minotaur':'3',
        'mummy':'3','owlbear':'3','veteran':'3','werewolf':'3','wight':'3','winter wolf':'3',
        'ettin':'4','ghost':'4','lamia':'4','succubus':'4',
        'bulette':'5','earth elemental':'5','fire elemental':'5','flesh golem':'5',
        'gorgon':'5','hill giant':'5','troll':'5','unicorn':'5','wraith':'5',
        'chimera':'6','cyclops':'6','drider':'6','medusa':'6','young white dragon':'6',
        'stone giant':'7','young black dragon':'7',
        'frost giant':'8','hydra':'8','young green dragon':'8',
        'fire giant':'9','young blue dragon':'9','young silver dragon':'9',
        'aboleth':'10','young red dragon':'10','young gold dragon':'10',
        'beholder':'13','adult white dragon':'13','adult black dragon':'14',
        'adult green dragon':'15','adult blue dragon':'16','adult red dragon':'17',
        'lich':'21','ancient black dragon':'21','ancient white dragon':'20',
        'ancient green dragon':'22','ancient blue dragon':'23','ancient red dragon':'24',
        'tarrasque':'30',
    };

    const getSRDCR = (name) => {
        if (!name) return null;
        const lower = name.toLowerCase().trim();
        if (SRD_CR[lower] !== undefined) return SRD_CR[lower];
        const stripped = lower.replace(/\s*\d+$/, '').trim();
        if (SRD_CR[stripped] !== undefined) return SRD_CR[stripped];
        return null;
    };

    const XPTracker = {
        recordKill: (charId, tokenName, tokenId) => {
            if (!state.DMToolkit.sessionXP) state.DMToolkit.sessionXP = { kills: [], totalXP: 0 };

            // Avoid double-counting same token
            const already = state.DMToolkit.sessionXP.kills.some(function(k) { return k.tokenId === tokenId; });
            if (already) return;

            // Try to find CR: first from sheet, then from SRD
            let cr = null;
            const charName = getCharName(charId);

            // Try npc_challenge attribute (5E OGL)
            const sheetCR = getAttrByName(charId, 'npc_challenge');
            if (sheetCR && sheetCR !== '' && sheetCR !== undefined) {
                cr = String(sheetCR);
            }

            // Fallback to SRD lookup
            if (cr === null) {
                cr = getSRDCR(charName);
            }

            // Fallback to SRD lookup by token name
            if (cr === null) {
                cr = getSRDCR(tokenName);
            }

            const xp = (cr !== null && CR_XP[cr] !== undefined) ? CR_XP[cr] : 0;

            state.DMToolkit.sessionXP.kills.push({
                tokenId: tokenId,
                charId: charId,
                name: tokenName || charName,
                cr: cr || '?',
                xp: xp,
            });
            state.DMToolkit.sessionXP.totalXP += xp;

            if (xp > 0) {
                whisperGM('<div style="' + STYLE.box + '">' +
                    '<div style="text-align:center;">⭐ <b>' + (tokenName || charName) + '</b> — CR ' + cr + ' — <b style="color:#f5a623;">' + xp + ' XP</b>' +
                    ' <span style="color:#aaa;">(Session: ' + state.DMToolkit.sessionXP.totalXP + ' XP)</span></div></div>');
            }
        },

        handleCommand: (msg) => {
            const args = msg.content.split(/\s+/);
            const subCmd = args[1] || '--show';

            if (subCmd === '--end' || subCmd === '--award') {
                XPTracker.awardXP(msg);
                return;
            }
            if (subCmd === '--reset' || subCmd === '--clear') {
                state.DMToolkit.sessionXP = { kills: [], totalXP: 0 };
                whisperGM('<div style="' + STYLE.box + '"><div style="' + STYLE.title + '">🗑️ XP Reset</div>' +
                    '<p style="text-align:center;">Session XP cleared.</p></div>');
                return;
            }
            if (subCmd === '--add') {
                // Manual XP add: !xp --add 500 Puzzle solved
                const amount = parseInt(args[2]) || 0;
                const reason = args.slice(3).join(' ') || 'bonus';
                if (amount > 0) {
                    if (!state.DMToolkit.sessionXP) state.DMToolkit.sessionXP = { kills: [], totalXP: 0 };
                    state.DMToolkit.sessionXP.kills.push({
                        tokenId: 'manual',
                        charId: 'manual',
                        name: reason,
                        cr: '—',
                        xp: amount,
                    });
                    state.DMToolkit.sessionXP.totalXP += amount;
                    whisperGM('<div style="' + STYLE.box + '"><div style="' + STYLE.title + '">⭐ XP Added</div>' +
                        '<p style="text-align:center;"><b>' + reason + '</b> — <b style="color:#f5a623;">' + amount + ' XP</b>' +
                        '<br>Session total: ' + state.DMToolkit.sessionXP.totalXP + ' XP</p></div>');
                }
                return;
            }

            // Default: show session XP summary
            XPTracker.showSummary();
        },

        showSummary: () => {
            const data = state.DMToolkit.sessionXP || { kills: [], totalXP: 0 };

            let output = '<div style="' + STYLE.box + '">';
            output += '<div style="' + STYLE.title + '">⭐ Session XP Tracker</div>';

            if (data.kills.length === 0) {
                output += '<p style="color:#aaa;text-align:center;">No XP earned this session.</p>';
            } else {
                data.kills.forEach(function(k, idx) {
                    output += '<div style="' + (idx % 2 === 0 ? STYLE.row : STYLE.rowAlt) + '">';
                    output += '<b>' + k.name + '</b>';
                    if (k.cr !== '—') output += ' <span style="color:#aaa;">(CR ' + k.cr + ')</span>';
                    output += ' — <span style="color:#f5a623;">' + k.xp + ' XP</span>';
                    output += '</div>';
                });

                output += '<div style="border-top:2px solid #e94560;padding-top:5px;margin-top:5px;text-align:center;">';
                output += '<b style="font-size:14px;">Total: <span style="color:#f5a623;">' + data.totalXP + ' XP</span></b>';
                output += '</div>';
            }

            // Count PCs on page for per-player calc
            const pageId = Campaign().get('playerpageid');
            const pcTokens = findObjs({ type: 'graphic', pageid: pageId, layer: 'objects' })
                .filter(function(t) { return t.get('represents') && !isNPC(t.get('represents')); });
            const pcCount = pcTokens.length || 1;

            if (data.totalXP > 0) {
                const perPC = Math.floor(data.totalXP / pcCount);
                output += '<p style="text-align:center;color:#aaa;">÷ ' + pcCount + ' PCs = <b style="color:#66bb6a;">' + perPC + ' XP each</b></p>';
            }

            output += '<div style="text-align:center;margin-top:5px;">';
            output += '<a style="' + STYLE.btnSuccess + '" href="!xp --end">🎉 Award XP</a> ';
            output += '<a style="' + STYLE.btn + '" href="!xp --add ?{XP Amount|100} ?{Reason|bonus}">➕ Add Manual XP</a> ';
            output += '<a style="' + STYLE.btnSecondary + '" href="!xp --reset">🗑️ Reset</a>';
            output += '</div></div>';
            whisperGM(output);
        },

        awardXP: () => {
            const data = state.DMToolkit.sessionXP || { kills: [], totalXP: 0 };
            if (data.totalXP <= 0) {
                whisperGM('<div style="' + STYLE.box + '"><div style="' + STYLE.title + '">⭐ No XP to Award</div></div>');
                return;
            }

            // Find PCs on current page
            const pageId = Campaign().get('playerpageid');
            const pcTokens = findObjs({ type: 'graphic', pageid: pageId, layer: 'objects' })
                .filter(function(t) { return t.get('represents') && !isNPC(t.get('represents')); });
            const pcCount = pcTokens.length || 1;
            const perPC = Math.floor(data.totalXP / pcCount);

            // Build public announcement
            let output = '<div style="' + STYLE.loot + '">';
            output += '<div style="' + STYLE.lootTitle + '">🎉 Session XP Awarded!</div>';
            output += '<p style="text-align:center;font-size:13px;">';
            output += 'Total XP earned: <b style="color:#f5a623;">' + data.totalXP + '</b><br>';
            output += 'Split ' + pcCount + ' ways: <b style="color:#66bb6a;font-size:16px;">' + perPC + ' XP each!</b></p>';

            if (data.kills.length > 0 && data.kills.length <= 10) {
                output += '<p style="color:#aaa;font-size:10px;text-align:center;">';
                data.kills.forEach(function(k, i) {
                    if (i > 0) output += ', ';
                    output += k.name;
                    if (k.cr !== '—') output += ' (CR ' + k.cr + ')';
                });
                output += '</p>';
            }

            output += '</div>';
            sendPublic(output);

            // Reset session XP
            state.DMToolkit.sessionXP = { kills: [], totalXP: 0 };
        },
    };

    // ========================================================================
    // MODULE 11: SESSION RECAP / MOTD
    // ========================================================================
    // Auto-whispers a "last session" recap to players when they connect.
    // Recap text stored in state. GM sets it with !recap --set.
    const Recap = {
        handleCommand: (msg) => {
            const args = msg.content.split(/\s+/);
            const subCmd = args[1] || '--show';

            if (subCmd === '--set') {
                // !recap --set <text> OR prompt
                const text = msg.content.replace(/^!recap\s+--set\s*/i, '').trim();
                if (!text) {
                    whisperGM('<div style="' + STYLE.box + '">' +
                        '<div style="' + STYLE.title + '">📜 Set Session Recap</div>' +
                        '<p>Usage: <code>!recap --set Your recap text here...</code></p>' +
                        '<p>Supports basic HTML: &lt;b&gt;, &lt;i&gt;, &lt;br&gt;</p></div>');
                    return;
                }
                state.DMToolkit.recap = {
                    text: text,
                    date: new Date().toLocaleDateString(),
                    pushed: [],
                };
                whisperGM('<div style="' + STYLE.box + '">' +
                    '<div style="' + STYLE.title + '">📜 Recap Saved!</div>' +
                    '<div style="padding:5px;background:#1a1a2e;border-radius:4px;margin:5px 0;">' + text + '</div>' +
                    '<div style="text-align:center;">' +
                    '<a style="' + STYLE.btnSuccess + '" href="!recap --push">📢 Push to All Players Now</a> ' +
                    '<a style="' + STYLE.btn + '" href="!recap --clear">🗑️ Clear</a></div></div>');
                return;
            }

            if (subCmd === '--clear') {
                state.DMToolkit.recap = null;
                whisperGM('<div style="' + STYLE.box + '"><div style="' + STYLE.title + '">🗑️ Recap Cleared</div></div>');
                return;
            }

            if (subCmd === '--push') {
                Recap.pushToAll();
                return;
            }

            if (subCmd === '--auto') {
                // Toggle auto-push on player join
                state.DMToolkit.config.autoRecap = !state.DMToolkit.config.autoRecap;
                whisperGM('<div style="' + STYLE.box + '"><p>Auto-push recap on join: <b>' +
                    (state.DMToolkit.config.autoRecap ? '✅ ON' : '❌ OFF') + '</b></p></div>');
                return;
            }

            // Default: show current recap
            const recap = state.DMToolkit.recap;
            if (!recap || !recap.text) {
                whisperGM('<div style="' + STYLE.box + '">' +
                    '<div style="' + STYLE.title + '">📜 Session Recap</div>' +
                    '<p style="color:#aaa;">No recap set. Use <code>!recap --set [text]</code></p></div>');
                return;
            }

            let output = '<div style="' + STYLE.box + '">';
            output += '<div style="' + STYLE.title + '">📜 Session Recap</div>';
            output += '<div style="padding:5px;background:#1a1a2e;border-radius:4px;margin:5px 0;">' + recap.text + '</div>';
            output += '<p style="color:#aaa;font-size:10px;">Set on: ' + recap.date + '</p>';
            output += '<div style="text-align:center;">';
            output += '<a style="' + STYLE.btnSuccess + '" href="!recap --push">📢 Push to All</a> ';
            output += '<a style="' + STYLE.btn + '" href="!recap --set ?{Recap text}">✏️ Edit</a> ';
            output += '<a style="' + STYLE.btnSecondary + '" href="!recap --clear">🗑️ Clear</a>';
            output += '</div></div>';
            whisperGM(output);
        },

        pushToAll: () => {
            const recap = state.DMToolkit.recap;
            if (!recap || !recap.text) {
                whisperGM('<div style="' + STYLE.box + '"><p style="color:#aaa;">No recap to push.</p></div>');
                return;
            }

            const output = '<div style="' + STYLE.loot + '">' +
                '<div style="' + STYLE.lootTitle + '">📜 Last Session...</div>' +
                '<div style="padding:8px;font-size:12px;line-height:1.5;">' + recap.text + '</div></div>';
            sendPublic(output);
            whisperGM('<div style="' + STYLE.box + '"><p>📢 Recap pushed to all players!</p></div>');
        },

        // Called when a player joins — whisper them the recap
        whisperToPlayer: (playerId) => {
            if (!state.DMToolkit.config.autoRecap) return;
            const recap = state.DMToolkit.recap;
            if (!recap || !recap.text) return;

            // Don't re-push if already seen this version
            if (recap.pushed && recap.pushed.includes(playerId)) return;

            const player = getObj('player', playerId);
            if (!player) return;
            const displayName = player.get('displayname');

            const output = '/w "' + displayName + '" <div style="' + STYLE.loot + '">' +
                '<div style="' + STYLE.lootTitle + '">📜 Previously on our adventure...</div>' +
                '<div style="padding:8px;font-size:12px;line-height:1.5;">' + recap.text + '</div></div>';
            sendChat('DMToolkit', output);

            if (!recap.pushed) recap.pushed = [];
            recap.pushed.push(playerId);
        },
    };

    // ========================================================================
    // MODULE 12: QUEST TRACKER
    // ========================================================================
    // Persistent quest log with statuses. Quests stored in state.
    // Can optionally auto-create a "Quest Board" handout.
    const QuestTracker = {
        STATUS: {
            active: { label: 'Active', icon: '🟢', color: '#66bb6a' },
            complete: { label: 'Complete', icon: '✅', color: '#4fc3f7' },
            failed: { label: 'Failed', icon: '❌', color: '#ef5350' },
            hidden: { label: 'Hidden', icon: '👁️', color: '#9e9e9e' },
        },

        handleCommand: (msg, isGM) => {
            const content = msg.content;
            const args = content.split(/\s+/);
            const subCmd = args[1] || '--show';

            if (subCmd === '--add' && isGM) {
                // !quest --add Quest Title | Description
                const text = content.replace(/^!quest\s+--add\s*/i, '').trim();
                const parts = text.split('|').map(function(s) { return s.trim(); });
                const title = parts[0];
                const desc = parts[1] || '';
                if (!title) {
                    whisperGM('<div style="' + STYLE.box + '"><p>Usage: <code>!quest --add Quest Title | Optional description</code></p></div>');
                    return;
                }

                const id = 'q' + Date.now();
                if (!state.DMToolkit.quests) state.DMToolkit.quests = {};
                state.DMToolkit.quests[id] = {
                    title: title,
                    description: desc,
                    status: 'active',
                    created: new Date().toLocaleDateString(),
                    notes: [],
                };

                whisperGM('<div style="' + STYLE.box + '">' +
                    '<div style="' + STYLE.title + '">🟢 Quest Added</div>' +
                    '<p><b>' + title + '</b></p>' +
                    (desc ? '<p style="color:#aaa;">' + desc + '</p>' : '') +
                    '<div style="text-align:center;"><a style="' + STYLE.btn + '" href="!quest">📋 View All</a></div></div>');
                return;
            }

            if (subCmd === '--status' && isGM) {
                // !quest --status q123 complete
                const qid = args[2];
                const newStatus = args[3];
                if (!qid || !newStatus || !QuestTracker.STATUS[newStatus]) {
                    whisperGM('<div style="' + STYLE.box + '"><p>Usage: <code>!quest --status [id] [active|complete|failed|hidden]</code></p></div>');
                    return;
                }
                const quest = (state.DMToolkit.quests || {})[qid];
                if (!quest) {
                    whisperGM('<div style="' + STYLE.box + '"><p>Quest not found.</p></div>');
                    return;
                }
                const oldStatus = quest.status;
                quest.status = newStatus;

                const info = QuestTracker.STATUS[newStatus];
                whisperGM('<div style="' + STYLE.box + '">' +
                    '<p>' + info.icon + ' <b>' + quest.title + '</b> — ' + info.label + '</p></div>');

                // Announce completion/failure publicly if not hidden
                if (newStatus === 'complete') {
                    sendPublic('<div style="' + STYLE.loot + '">' +
                        '<div style="' + STYLE.lootTitle + '">✅ Quest Complete!</div>' +
                        '<p style="text-align:center;font-size:14px;"><b>' + quest.title + '</b></p></div>');
                } else if (newStatus === 'failed') {
                    sendPublic('<div style="' + STYLE.box + '">' +
                        '<div style="' + STYLE.title + '">❌ Quest Failed</div>' +
                        '<p style="text-align:center;"><b>' + quest.title + '</b></p></div>');
                }
                return;
            }

            if (subCmd === '--note' && isGM) {
                // !quest --note q123 Some note text
                const qid = args[2];
                const noteText = args.slice(3).join(' ');
                const quest = (state.DMToolkit.quests || {})[qid];
                if (!quest || !noteText) {
                    whisperGM('<div style="' + STYLE.box + '"><p>Usage: <code>!quest --note [id] Note text here</code></p></div>');
                    return;
                }
                quest.notes.push({ text: noteText, date: new Date().toLocaleDateString() });
                whisperGM('<div style="' + STYLE.box + '"><p>📝 Note added to <b>' + quest.title + '</b></p></div>');
                return;
            }

            if (subCmd === '--remove' && isGM) {
                const qid = args[2];
                if (state.DMToolkit.quests && state.DMToolkit.quests[qid]) {
                    const name = state.DMToolkit.quests[qid].title;
                    delete state.DMToolkit.quests[qid];
                    whisperGM('<div style="' + STYLE.box + '"><p>🗑️ Removed quest: <b>' + name + '</b></p></div>');
                }
                return;
            }

            if (subCmd === '--board') {
                // Show public quest board (active quests only, no hidden)
                QuestTracker.showBoard();
                return;
            }

            if (subCmd === '--handout' && isGM) {
                QuestTracker.updateHandout();
                return;
            }

            // Default: show full quest list (GM view — includes hidden, notes, controls)
            if (isGM) {
                QuestTracker.showGMView();
            } else {
                const who = msg.who.replace(' (GM)', '');
                QuestTracker.showBoard(who);
            }
        },

        showGMView: () => {
            const quests = state.DMToolkit.quests || {};
            const keys = Object.keys(quests);

            let output = '<div style="' + STYLE.box + '">';
            output += '<div style="' + STYLE.title + '">📋 Quest Tracker (GM View)</div>';

            if (keys.length === 0) {
                output += '<p style="color:#aaa;">No quests. <code>!quest --add Title | Description</code></p>';
            } else {
                // Group by status
                ['active', 'hidden', 'complete', 'failed'].forEach(function(status) {
                    const filtered = keys.filter(function(k) { return quests[k].status === status; });
                    if (filtered.length === 0) return;

                    const info = QuestTracker.STATUS[status];
                    output += '<div style="' + STYLE.subtitle + '">' + info.icon + ' ' + info.label + ' (' + filtered.length + ')</div>';

                    filtered.forEach(function(qid) {
                        const q = quests[qid];
                        output += '<div style="' + STYLE.row + 'padding:4px;">';
                        output += '<b style="color:' + info.color + ';">' + q.title + '</b>';
                        if (q.description) output += '<br><span style="color:#aaa;font-size:10px;">' + q.description + '</span>';
                        if (q.notes && q.notes.length > 0) {
                            q.notes.forEach(function(n) {
                                output += '<br><span style="color:#8888aa;font-size:10px;">📝 ' + n.text + ' <i>(' + n.date + ')</i></span>';
                            });
                        }
                        output += '<br>';

                        // Status change buttons
                        if (status !== 'complete') output += '<a style="' + STYLE.btnSuccess + 'font-size:9px;" href="!quest --status ' + qid + ' complete">✅</a> ';
                        if (status !== 'active') output += '<a style="' + STYLE.btn + 'font-size:9px;" href="!quest --status ' + qid + ' active">🟢</a> ';
                        if (status !== 'failed') output += '<a style="' + STYLE.btnSecondary + 'font-size:9px;" href="!quest --status ' + qid + ' failed">❌</a> ';
                        if (status !== 'hidden') output += '<a style="' + STYLE.btnSecondary + 'font-size:9px;" href="!quest --status ' + qid + ' hidden">👁️</a> ';
                        output += '<a style="' + STYLE.btnSecondary + 'font-size:9px;" href="!quest --note ' + qid + ' ?{Note}">📝</a> ';
                        output += '<a style="' + STYLE.btnSecondary + 'font-size:9px;" href="!quest --remove ' + qid + '">🗑️</a>';
                        output += '</div>';
                    });
                });
            }

            output += '<div style="text-align:center;margin-top:5px;">';
            output += '<a style="' + STYLE.btnSuccess + '" href="!quest --add ?{Quest Title} | ?{Description (optional)}">➕ New Quest</a> ';
            output += '<a style="' + STYLE.btn + '" href="!quest --board">📢 Show Board (Public)</a> ';
            output += '<a style="' + STYLE.btnSecondary + '" href="!quest --handout">📄 Update Handout</a>';
            output += '</div></div>';
            whisperGM(output);
        },

        showBoard: (whisperTo) => {
            const quests = state.DMToolkit.quests || {};
            const keys = Object.keys(quests);
            const active = keys.filter(function(k) { return quests[k].status === 'active'; });
            const complete = keys.filter(function(k) { return quests[k].status === 'complete'; });

            let output = '<div style="' + STYLE.loot + '">';
            output += '<div style="' + STYLE.lootTitle + '">📋 Quest Board</div>';

            if (active.length === 0 && complete.length === 0) {
                output += '<p style="text-align:center;color:#aaa;">No active quests.</p>';
            }

            if (active.length > 0) {
                output += '<div style="padding:4px;"><b style="color:#66bb6a;">Active Quests:</b></div>';
                active.forEach(function(qid) {
                    const q = quests[qid];
                    output += '<div style="padding:3px 8px;">🟢 <b>' + q.title + '</b>';
                    if (q.description) output += ' — <span style="color:#ccc;">' + q.description + '</span>';
                    output += '</div>';
                });
            }

            if (complete.length > 0) {
                output += '<div style="padding:4px;margin-top:4px;"><b style="color:#4fc3f7;">Completed:</b></div>';
                complete.forEach(function(qid) {
                    output += '<div style="padding:3px 8px;color:#888;">✅ <s>' + quests[qid].title + '</s></div>';
                });
            }

            output += '</div>';
            if (whisperTo) {
                sendChat('DMToolkit', '/w "' + whisperTo + '" ' + output);
            } else {
                sendPublic(output);
            }
        },

        updateHandout: () => {
            const quests = state.DMToolkit.quests || {};
            const keys = Object.keys(quests);

            let html = '<h1 style="color:#e94560;">📋 Quest Board</h1>';
            html += '<p style="color:#888;">Auto-generated by DMToolkit. Updated: ' + new Date().toLocaleDateString() + '</p>';

            ['active', 'complete', 'failed'].forEach(function(status) {
                const filtered = keys.filter(function(k) { return quests[k].status === status; });
                if (filtered.length === 0) return;
                const info = QuestTracker.STATUS[status];
                html += '<h2>' + info.icon + ' ' + info.label + '</h2>';
                filtered.forEach(function(qid) {
                    const q = quests[qid];
                    html += '<p><b>' + q.title + '</b>';
                    if (q.description) html += ' — ' + q.description;
                    html += '</p>';
                });
            });

            // Find or create handout
            let handout = findObjs({ type: 'handout', name: 'Quest Board' })[0];
            if (!handout) {
                handout = createObj('handout', { name: 'Quest Board', inplayerjournals: 'all' });
            }
            setTimeout(function() {
                handout.set('notes', html);
            }, 100);

            whisperGM('<div style="' + STYLE.box + '"><p>📄 Quest Board handout updated!</p></div>');
        },
    };

    // ========================================================================
    // MODULE 13: DOWNTIME TRACKER
    // ========================================================================
    // Track downtime days per PC and activities between sessions.
    // State: state.DMToolkit.downtime = { players: { charId: { days, log } } }
    const DOWNTIME_ACTIVITIES = {
        'crafting':     { label: 'Crafting',             icon: '🔨', desc: 'Create items, potions, or equipment' },
        'training':     { label: 'Training',             icon: '⚔️', desc: 'Learn a new skill, tool, or language' },
        'research':     { label: 'Research',             icon: '📚', desc: 'Study lore, investigate a mystery' },
        'carousing':    { label: 'Carousing',            icon: '🍺', desc: 'Make contacts, gather rumors' },
        'working':      { label: 'Working',              icon: '💰', desc: 'Earn gold (1gp/day modest, 2gp/day comfortable)' },
        'recuperating': { label: 'Recuperating',         icon: '🩹', desc: 'Recover from disease, poison, or injuries' },
        'shopping':     { label: 'Shopping',             icon: '🛒', desc: 'Find and buy specific items' },
        'religious':    { label: 'Religious Service',    icon: '⛪', desc: 'Earn favor at a temple or shrine' },
        'crime':        { label: 'Crime',                icon: '🗡️', desc: 'Burglary, heist, or shady dealings' },
        'pit-fighting': { label: 'Pit Fighting',         icon: '💪', desc: 'Fight for glory and gold' },
        'gambling':     { label: 'Gambling',             icon: '🎲', desc: 'Games of chance for profit or ruin' },
        'custom':       { label: 'Other',                icon: '📋', desc: 'Custom downtime activity' },
    };

    const Downtime = {
        ensureState: () => {
            if (!state.DMToolkit.downtime) state.DMToolkit.downtime = { players: {} };
        },

        getPC: (charId) => {
            Downtime.ensureState();
            if (!state.DMToolkit.downtime.players[charId]) {
                state.DMToolkit.downtime.players[charId] = { days: 0, log: [] };
            }
            return state.DMToolkit.downtime.players[charId];
        },

        handleCommand: (msg) => {
            const content = msg.content;
            const args = content.split(/\s+/);
            const subCmd = args[1] || '--show';

            if (subCmd === '--grant') {
                // !downtime --grant [days] — grant days to ALL PCs on the page
                const days = parseInt(args[2]) || 0;
                if (days <= 0) {
                    whisperGM('<div style="' + STYLE.box + '"><p>Usage: <code>!downtime --grant [days]</code> — Adds days to all PCs on page</p></div>');
                    return;
                }

                const pageId = Campaign().get('playerpageid');
                const tokens = findObjs({ type: 'graphic', pageid: pageId, layer: 'objects' })
                    .filter(function(t) { return t.get('represents') && !isNPC(t.get('represents')); });

                let names = [];
                tokens.forEach(function(t) {
                    const cid = t.get('represents');
                    const pc = Downtime.getPC(cid);
                    pc.days += days;
                    names.push(t.get('name') || getCharName(cid));
                });

                sendPublic('<div style="' + STYLE.loot + '">' +
                    '<div style="' + STYLE.lootTitle + '">⏳ Downtime Granted!</div>' +
                    '<p style="text-align:center;">Each PC receives <b style="color:#f5a623;">' + days + ' days</b> of downtime.</p>' +
                    '<p style="text-align:center;color:#aaa;">' + names.join(', ') + '</p></div>');
                return;
            }

            if (subCmd === '--spend') {
                // !downtime --spend — interactive menu with selected token
                const selected = msg.selected;
                if (!selected || selected.length === 0) {
                    whisperGM('<div style="' + STYLE.box + '"><p>Select a PC token first, then use <code>!downtime --spend</code></p></div>');
                    return;
                }
                const token = getObj('graphic', selected[0]._id);
                const charId = token ? token.get('represents') : null;
                if (!charId || isNPC(charId)) {
                    whisperGM('<div style="' + STYLE.box + '"><p>Select a PC token.</p></div>');
                    return;
                }

                const pc = Downtime.getPC(charId);
                const name = token.get('name') || getCharName(charId);

                let output = '<div style="' + STYLE.box + '">';
                output += '<div style="' + STYLE.title + '">⏳ ' + name + ' — Downtime (' + pc.days + ' days available)</div>';

                if (pc.days <= 0) {
                    output += '<p style="color:#aaa;">No downtime days available.</p>';
                } else {
                    output += '<div style="font-size:11px;">';
                    Object.keys(DOWNTIME_ACTIVITIES).forEach(function(key) {
                        const act = DOWNTIME_ACTIVITIES[key];
                        output += '<div style="' + STYLE.row + 'padding:3px;">';
                        output += '<a style="' + STYLE.btn + 'font-size:10px;" href="!downtime --do ' + charId + ' ' + key + ' ?{How many days?|1}">';
                        output += act.icon + ' ' + act.label + '</a> ';
                        output += '<span style="color:#aaa;">' + act.desc + '</span>';
                        output += '</div>';
                    });
                    output += '</div>';
                }

                output += '</div>';
                whisperGM(output);
                return;
            }

            if (subCmd === '--do') {
                // !downtime --do [charId] [activity] [days]
                const charId = args[2];
                const activity = args[3];
                const days = parseInt(args[4]) || 1;
                const actInfo = DOWNTIME_ACTIVITIES[activity];
                if (!charId || !actInfo) {
                    whisperGM('<div style="' + STYLE.box + '"><p>Invalid downtime activity.</p></div>');
                    return;
                }

                const pc = Downtime.getPC(charId);
                const charName = getCharName(charId) || charId;

                if (pc.days < days) {
                    whisperGM('<div style="' + STYLE.box + '"><p><b>' + charName + '</b> only has ' + pc.days + ' days available.</p></div>');
                    return;
                }

                pc.days -= days;
                const entry = {
                    activity: actInfo.label,
                    icon: actInfo.icon,
                    days: days,
                    date: new Date().toLocaleDateString(),
                    note: '',
                };
                pc.log.push(entry);

                let output = '<div style="' + STYLE.box + '">';
                output += '<div style="' + STYLE.title + '">' + actInfo.icon + ' Downtime: ' + actInfo.label + '</div>';
                output += '<p style="text-align:center;"><b>' + charName + '</b> spends <b>' + days + ' day' + (days > 1 ? 's' : '') + '</b> ' + actInfo.label.toLowerCase() + '.</p>';
                output += '<p style="text-align:center;color:#aaa;">Remaining: ' + pc.days + ' days</p>';

                // Activity-specific flavor/mechanics
                if (activity === 'working') {
                    const gold = days * 2;
                    output += '<p style="text-align:center;color:#f5a623;">💰 Earned ' + gold + ' gp (comfortable lifestyle)</p>';
                    entry.note = 'Earned ' + gold + ' gp';
                } else if (activity === 'carousing') {
                    const roll = randomInteger(100);
                    if (roll <= 10) {
                        output += '<p style="text-align:center;color:#ef5350;">🎲 d100: ' + roll + ' — Got into trouble! (Jailed, enemies made, etc.)</p>';
                        entry.note = 'Trouble! (d100: ' + roll + ')';
                    } else if (roll <= 20) {
                        output += '<p style="text-align:center;color:#ff9800;">🎲 d100: ' + roll + ' — Minor mishap, but made a useful contact</p>';
                        entry.note = 'Minor mishap + contact';
                    } else {
                        output += '<p style="text-align:center;color:#66bb6a;">🎲 d100: ' + roll + ' — Made ' + Math.ceil(roll / 25) + ' friendly contact(s)</p>';
                        entry.note = Math.ceil(roll / 25) + ' contacts';
                    }
                } else if (activity === 'gambling') {
                    const rolls = [randomInteger(6) + randomInteger(6) + randomInteger(6)];
                    const total = rolls[0];
                    if (total <= 5) {
                        const loss = days * 10;
                        output += '<p style="text-align:center;color:#ef5350;">🎲 3d6: ' + total + ' — Lost ' + loss + ' gp and a debt!</p>';
                        entry.note = 'Lost ' + loss + ' gp';
                    } else if (total <= 11) {
                        output += '<p style="text-align:center;color:#ff9800;">🎲 3d6: ' + total + ' — Broke even</p>';
                        entry.note = 'Broke even';
                    } else if (total <= 16) {
                        const gain = days * 10;
                        output += '<p style="text-align:center;color:#66bb6a;">🎲 3d6: ' + total + ' — Won ' + gain + ' gp!</p>';
                        entry.note = 'Won ' + gain + ' gp';
                    } else {
                        const gain = days * 25;
                        output += '<p style="text-align:center;color:#f5a623;">🎲 3d6: ' + total + ' — Big win! ' + gain + ' gp!</p>';
                        entry.note = 'Big win: ' + gain + ' gp';
                    }
                } else if (activity === 'pit-fighting') {
                    // Athletics, Acrobatics, or special weapon — simplified
                    const roll = randomInteger(20);
                    if (roll >= 15) {
                        const winnings = days * 10;
                        output += '<p style="text-align:center;color:#66bb6a;">🎲 d20: ' + roll + ' — Victory! Won ' + winnings + ' gp</p>';
                        entry.note = 'Won ' + winnings + ' gp';
                    } else if (roll >= 6) {
                        output += '<p style="text-align:center;color:#ff9800;">🎲 d20: ' + roll + ' — Close match, no payout</p>';
                        entry.note = 'No payout';
                    } else {
                        output += '<p style="text-align:center;color:#ef5350;">🎲 d20: ' + roll + ' — Defeated! Lost entry fee and took a beating</p>';
                        entry.note = 'Defeated, lost fee';
                    }
                }

                output += '</div>';
                whisperGM(output);
                return;
            }

            if (subCmd === '--log') {
                // !downtime --log [charId] OR selected token
                let charId = args[2];
                if (!charId && msg.selected && msg.selected.length > 0) {
                    const token = getObj('graphic', msg.selected[0]._id);
                    if (token) charId = token.get('represents');
                }
                if (!charId) {
                    whisperGM('<div style="' + STYLE.box + '"><p>Select a PC token or use <code>!downtime --log [charId]</code></p></div>');
                    return;
                }
                const pc = Downtime.getPC(charId);
                const name = getCharName(charId) || charId;

                let output = '<div style="' + STYLE.box + '">';
                output += '<div style="' + STYLE.title + '">📜 ' + name + ' — Downtime Log</div>';
                output += '<p>Days remaining: <b style="color:#f5a623;">' + pc.days + '</b></p>';

                if (pc.log.length === 0) {
                    output += '<p style="color:#aaa;">No activities logged.</p>';
                } else {
                    pc.log.forEach(function(entry, idx) {
                        output += '<div style="' + (idx % 2 === 0 ? STYLE.row : STYLE.rowAlt) + '">';
                        output += entry.icon + ' <b>' + entry.activity + '</b> (' + entry.days + 'd)';
                        if (entry.note) output += ' — <span style="color:#aaa;">' + entry.note + '</span>';
                        output += ' <span style="color:#666;font-size:9px;">' + entry.date + '</span>';
                        output += '</div>';
                    });
                }
                output += '<div style="text-align:center;margin-top:5px;">';
                output += '<a style="' + STYLE.btn + '" href="!downtime --spend">⏳ Spend Days</a> ';
                output += '<a style="' + STYLE.btnSecondary + '" href="!downtime">⬅ Overview</a>';
                output += '</div></div>';
                whisperGM(output);
                return;
            }

            if (subCmd === '--reset') {
                state.DMToolkit.downtime = { players: {} };
                whisperGM('<div style="' + STYLE.box + '"><div style="' + STYLE.title + '">🗑️ Downtime Reset</div></div>');
                return;
            }

            // Default: show all PCs' downtime status
            Downtime.showOverview();
        },

        showOverview: () => {
            Downtime.ensureState();
            const players = state.DMToolkit.downtime.players;
            const keys = Object.keys(players);

            let output = '<div style="' + STYLE.box + '">';
            output += '<div style="' + STYLE.title + '">⏳ Downtime Overview</div>';

            if (keys.length === 0) {
                output += '<p style="color:#aaa;">No downtime tracked yet. Use <code>!downtime --grant [days]</code> to start.</p>';
            } else {
                keys.forEach(function(charId, idx) {
                    const pc = players[charId];
                    const name = getCharName(charId) || charId;
                    const lastActivity = pc.log.length > 0 ? pc.log[pc.log.length - 1] : null;

                    output += '<div style="' + (idx % 2 === 0 ? STYLE.row : STYLE.rowAlt) + '">';
                    output += '<b>' + name + '</b> — <span style="color:#f5a623;">' + pc.days + ' days</span>';
                    if (lastActivity) {
                        output += ' <span style="color:#888;font-size:10px;">(Last: ' + lastActivity.icon + ' ' + lastActivity.activity + ')</span>';
                    }
                    output += ' <a style="' + STYLE.btnSecondary + 'font-size:9px;" href="!downtime --log ' + charId + '">📜</a>';
                    output += '</div>';
                });
            }

            output += '<div style="text-align:center;margin-top:5px;">';
            output += '<a style="' + STYLE.btnSuccess + '" href="!downtime --grant ?{Days to grant|7}">🎁 Grant Days (All PCs)</a> ';
            output += '<a style="' + STYLE.btn + '" href="!downtime --spend">⏳ Spend (Selected Token)</a>';
            output += '</div></div>';
            whisperGM(output);
        },
    };

    // ========================================================================
    // MODULE 14: SESSION SUMMARY BUILDER
    // ========================================================================
    // Compiles data from the current session into a plain-text summary
    // suitable for Discord posts or AI-assisted session write-ups.
    // Pulls from: recap, quests, XP, downtime, combat encounters, and
    // GM-added session notes.
    const SessionSummary = {
        handleCommand: (msg) => {
            const args = msg.content.split(/\s+/);
            const subCmd = args[1] || '--build';

            if (subCmd === '--note') {
                // !session --note Some important thing that happened
                const noteText = msg.content.replace(/^!session\s+--note\s*/i, '').trim();
                if (!noteText) {
                    whisperGM('<div style="' + STYLE.box + '"><p>Usage: <code>!session --note Something notable happened</code></p></div>');
                    return;
                }
                if (!state.DMToolkit.sessionNotes) state.DMToolkit.sessionNotes = [];
                state.DMToolkit.sessionNotes.push({ text: noteText, time: new Date().toLocaleTimeString() });
                whisperGM('<div style="' + STYLE.box + '">' +
                    '<p>📝 Session note added: <i>' + noteText + '</i></p>' +
                    '<p style="color:#aaa;font-size:10px;">Total notes: ' + state.DMToolkit.sessionNotes.length + '</p></div>');
                return;
            }

            if (subCmd === '--clear') {
                state.DMToolkit.sessionNotes = [];
                whisperGM('<div style="' + STYLE.box + '"><p>🗑️ Session notes cleared.</p></div>');
                return;
            }

            // Default: build the summary
            SessionSummary.build();
        },

        build: () => {
            const lines = [];

            // --- HEADER ---
            lines.push('# SESSION SUMMARY');
            lines.push('Date: ' + new Date().toLocaleDateString());
            lines.push('');

            // --- RECAP (what happened last time) ---
            const recap = state.DMToolkit.recap;
            if (recap && recap.text) {
                lines.push('## PREVIOUSLY...');
                // Strip HTML tags for plain text
                lines.push(recap.text.replace(/<[^>]+>/g, '').trim());
                lines.push('');
            }

            // --- SESSION NOTES (GM's in-session notes) ---
            const notes = state.DMToolkit.sessionNotes || [];
            if (notes.length > 0) {
                lines.push('## KEY EVENTS');
                notes.forEach(function(n) {
                    lines.push('- ' + n.text);
                });
                lines.push('');
            }

            // --- COMBAT ENCOUNTERS ---
            // Pull from encounter state if available
            const enc = state.DMToolkit.encounter || {};
            const xpData = state.DMToolkit.sessionXP || { kills: [], totalXP: 0 };
            if (xpData.kills.length > 0) {
                lines.push('## COMBAT');
                lines.push('Enemies defeated:');
                xpData.kills.forEach(function(k) {
                    if (k.cr !== '—') {
                        lines.push('- ' + k.name + ' (CR ' + k.cr + ', ' + k.xp + ' XP)');
                    } else {
                        lines.push('- ' + k.name + ' (' + k.xp + ' XP)');
                    }
                });
                lines.push('Total XP: ' + xpData.totalXP);

                // PC count for split
                const pageId = Campaign().get('playerpageid');
                const pcTokens = findObjs({ type: 'graphic', pageid: pageId, layer: 'objects' })
                    .filter(function(t) { return t.get('represents') && !isNPC(t.get('represents')); });
                if (pcTokens.length > 0) {
                    lines.push('XP per PC: ' + Math.floor(xpData.totalXP / pcTokens.length) + ' (' + pcTokens.length + ' PCs)');
                }
                lines.push('');
            }

            // --- QUESTS ---
            const quests = state.DMToolkit.quests || {};
            const qKeys = Object.keys(quests);
            if (qKeys.length > 0) {
                const active = qKeys.filter(function(k) { return quests[k].status === 'active'; });
                const completed = qKeys.filter(function(k) { return quests[k].status === 'complete'; });
                const failed = qKeys.filter(function(k) { return quests[k].status === 'failed'; });

                lines.push('## QUESTS');
                if (completed.length > 0) {
                    lines.push('Completed:');
                    completed.forEach(function(k) { lines.push('- ✅ ' + quests[k].title); });
                }
                if (failed.length > 0) {
                    lines.push('Failed:');
                    failed.forEach(function(k) { lines.push('- ❌ ' + quests[k].title); });
                }
                if (active.length > 0) {
                    lines.push('Still active:');
                    active.forEach(function(k) {
                        let line = '- ' + quests[k].title;
                        if (quests[k].notes && quests[k].notes.length > 0) {
                            const latest = quests[k].notes[quests[k].notes.length - 1];
                            line += ' (Note: ' + latest.text + ')';
                        }
                        lines.push(line);
                    });
                }
                lines.push('');
            }

            // --- DOWNTIME ---
            const dt = (state.DMToolkit.downtime || {}).players || {};
            const dtKeys = Object.keys(dt);
            const anyActivity = dtKeys.some(function(k) { return dt[k].log && dt[k].log.length > 0; });
            if (anyActivity) {
                lines.push('## DOWNTIME');
                dtKeys.forEach(function(charId) {
                    const pc = dt[charId];
                    if (pc.log.length === 0) return;
                    const name = getCharName(charId) || charId;
                    lines.push(name + ' (' + pc.days + ' days remaining):');
                    pc.log.forEach(function(entry) {
                        let line = '- ' + entry.activity + ' (' + entry.days + ' days)';
                        if (entry.note) line += ' — ' + entry.note;
                        lines.push(line);
                    });
                });
                lines.push('');
            }

            // --- PARTY ---
            const pageId = Campaign().get('playerpageid');
            const pcTokens = findObjs({ type: 'graphic', pageid: pageId, layer: 'objects' })
                .filter(function(t) { return t.get('represents') && !isNPC(t.get('represents')); });
            if (pcTokens.length > 0) {
                lines.push('## PARTY');
                pcTokens.forEach(function(t) {
                    const hp = t.get('bar1_value') || '?';
                    const maxHP = t.get('bar1_max') || '?';
                    lines.push('- ' + t.get('name') + ' (HP: ' + hp + '/' + maxHP + ')');
                });
                lines.push('');
            }

            // --- BUILD OUTPUT ---
            const plainText = lines.join('\n');

            // Display in chat with copy-friendly format
            let output = '<div style="' + STYLE.box + '">';
            output += '<div style="' + STYLE.title + '">📋 Session Summary</div>';
            output += '<div style="background:#0d0d1a;padding:8px;border-radius:4px;margin:5px 0;font-family:monospace;font-size:10px;white-space:pre-wrap;color:#ddd;">';
            output += plainText.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            output += '</div>';
            output += '<div style="text-align:center;margin-top:5px;">';
            output += '<a style="' + STYLE.btn + '" href="!session --note ?{Add a session note}">📝 Add Note</a> ';
            output += '<a style="' + STYLE.btnSecondary + '" href="!session --clear">🗑️ Clear Notes</a>';
            output += '</div>';
            output += '<p style="color:#888;font-size:9px;text-align:center;">Copy the text above for Discord or paste into an AI tool for a polished write-up.</p>';
            output += '</div>';
            whisperGM(output);

            // Also create a handout for easy copying
            SessionSummary.updateHandout(plainText);
        },

        updateHandout: (plainText) => {
            let handout = findObjs({ type: 'handout', name: 'Session Summary' })[0];
            if (!handout) {
                handout = createObj('handout', { name: 'Session Summary', inplayerjournals: '' });
            }
            const html = '<pre style="white-space:pre-wrap;font-family:monospace;font-size:12px;">' +
                plainText.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</pre>';
            setTimeout(function() {
                handout.set('notes', html);
            }, 100);
            whisperGM('<div style="' + STYLE.box + '"><p style="font-size:10px;color:#aaa;">📄 "Session Summary" handout updated (GM-only for easy copy/paste).</p></div>');
        },
    };

    // ========================================================================
    // MODULE 15: HELP & CONFIG
    // ========================================================================
    const Config = {
        showHelp: () => {
            let output = '<div style="' + STYLE.box + '">';
            output += '<div style="' + STYLE.title + '">🛠️ DMToolkit v' + VERSION + '</div>';

            output += '<div style="' + STYLE.subtitle + '">⚔️ Combat</div>';
            output += '<div style="font-size:11px;padding:2px 4px;">';
            output += '<b>!combat --all</b> — Roll initiative for all tokens<br>';
            output += '<b>!combat --npcs</b> — Roll for NPCs only<br>';
            output += '<b>!combat --pcs</b> — Roll for PCs only<br>';
            output += '<b>!combat --group</b> — Group init (shared sheet = same roll)<br>';
            output += '<b>!combat --remind</b> — Remind missing PCs<br>';
            output += '<b>!combat --debug</b> — Inspect token NPC/PC detection<br>';
            output += '<b>!combat --tag npc/pc</b> — Manually tag selected tokens<br>';
            output += '<b>!combat --setinit [N]</b> — Set init modifier for selected tokens<br>';
            output += '<b>!combat --end</b> — End combat<br></div>';

            output += '<div style="' + STYLE.subtitle + '">📌 Conditions</div>';
            output += '<div style="font-size:11px;padding:2px 4px;">';
            output += '<b>!condition</b> — Show condition menu<br>';
            output += '<b>!condition --add/--remove [name]</b> — Apply/remove<br>';
            output += '<b>!condition --add [name] [rounds]</b> — Apply with duration<br>';
            output += '<b>!condition --timers</b> — View active timed conditions<br></div>';

            output += '<div style="' + STYLE.subtitle + '">💰 Loot</div>';
            output += '<div style="font-size:11px;padding:2px 4px;">';
            output += '<b>!loot --cr [N] --count [X]</b> — Generate loot<br>';
            output += '<b>!loot --hoard --cr [N]</b> — Hoard loot<br>';
            output += '<b>!loot --magic [rarity]</b> — Random magic item<br>';
            output += '<b>!loot --quest</b> — Quest flavor item<br></div>';

            output += '<div style="' + STYLE.subtitle + '">📋 Other</div>';
            output += '<div style="font-size:11px;padding:2px 4px;">';
            output += '<b>!summary</b> — Encounter summary<br>';
            output += '<b>!dm</b> — DM quick reference<br>';
            output += '<b>!guide</b> — Player guide (public, visible to all)<br>';
            output += '<b>!setup</b> — Session setup (sync stats from D&D Beyond)<br>';
            output += '<b>!setup --srd</b> — Auto-fill NPC init from SRD data<br>';
            output += '<b>!setup --bulk [list]</b> — Bulk import init mods<br>';
            output += '<b>!conc</b> — View active concentration<br>';
            output += '<b>!conc --drop [name]</b> — Drop concentration<br>';
            output += '<b>!xp</b> — View session XP summary<br>';
            output += '<b>!xp --add [N] [reason]</b> — Add manual XP<br>';
            output += '<b>!xp --end</b> — Award XP to players<br>';
            output += '<b>!xp --reset</b> — Clear session XP<br>';
            output += '<b>!recap</b> — View/set session recap<br>';
            output += '<b>!recap --set [text]</b> — Set recap text<br>';
            output += '<b>!recap --push</b> — Push recap to all players<br>';
            output += '<b>!quest</b> — Quest tracker (GM view)<br>';
            output += '<b>!quest --add Title | Desc</b> — Add a quest<br>';
            output += '<b>!quest --board</b> — Show public quest board<br>';
            output += '<b>!downtime</b> — Downtime overview<br>';
            output += '<b>!downtime --grant [days]</b> — Grant days to all PCs<br>';
            output += '<b>!downtime --spend</b> — Spend days (selected token)<br>';
            output += '<b>!downtime --log</b> — View log (selected token)<br>';
            output += '<b>!session</b> — Build session summary for Discord/AI<br>';
            output += '<b>!session --note [text]</b> — Add a session note<br>';
            output += '<b>!toolkit --config</b> — Settings<br>';
            output += '<b>!toolkit --handout</b> — Create/update the in-game guide handout<br></div>';
            output += '<div style="' + STYLE.subtitle + '">🤖 Auto-Features</div>';
            output += '<div style="font-size:11px;padding:2px 4px;">';
            output += '• <b>HP Monitor:</b> Auto-marks dead NPCs (gray tint) and unconscious PCs<br>';
            output += '• <b>Bloodied Warning:</b> Whispers GM when NPCs drop below half HP<br>';
            output += '• <b>XP Tracking:</b> Auto-tallies XP when NPCs are defeated<br>';
            output += '• <b>Concentration:</b> Detects from Beyond20, prompts CON saves on damage<br>';
            output += '• <b>Condition Timers:</b> Auto-expire timed conditions on turn change<br></div>';
            output += '</div>';
            whisperGM(output);
        },

        showConfig: () => {
            const cfg = state.DMToolkit.config;
            let output = '<div style="' + STYLE.box + '">';
            output += '<div style="' + STYLE.title + '">⚙️ Configuration</div>';

            [
                { key: 'autoSort', label: 'Auto-sort initiative' },
                { key: 'announceRounds', label: 'Announce rounds in chat' },
                { key: 'announceTurns', label: 'Announce PC turns in chat' },
                { key: 'whisperNPCInit', label: 'Whisper NPC initiative to GM' },
                { key: 'lootWhisper', label: 'Whisper loot to GM only' },
                { key: 'hpMonitor', label: '💀 HP Monitor (dead/unconscious markers)' },
                { key: 'bloodiedWarning', label: '🩸 Bloodied warning (NPC half HP)' },
                { key: 'autoRecap', label: '📜 Auto-push recap on player join' },
            ].forEach(function(s) {
                const status = cfg[s.key] ? '✅' : '❌';
                output += '<div style="' + STYLE.row + 'padding:3px 0;">';
                output += '<a style="' + STYLE.btnSecondary + '" href="!toolkit --toggle ' + s.key + '">' + status + '</a> ' + s.label;
                output += '</div>';
            });

            // Show manual tags
            const tagKeys = Object.keys(state.DMToolkit.tags);
            if (tagKeys.length > 0) {
                output += '<div style="' + STYLE.subtitle + '">🏷️ Manual Tags</div>';
                tagKeys.forEach(function(cid) {
                    const character = getObj('character', cid);
                    const name = character ? character.get('name') : cid;
                    output += '<div style="' + STYLE.row + '">' + name + ': <b>' + state.DMToolkit.tags[cid] + '</b> ';
                    output += '<a style="' + STYLE.btnSecondary + '" href="!combat --tag clear ' + cid + '">✕</a></div>';
                });
            }

            output += '</div>';
            whisperGM(output);
        },

        toggle: (setting) => {
            if (state.DMToolkit.config.hasOwnProperty(setting)) {
                state.DMToolkit.config[setting] = !state.DMToolkit.config[setting];
                Config.showConfig();
            }
        },

        // Create/update an in-game Handout with full documentation
        createHandout: () => {
            // Find or create the handout
            let handout = findObjs({ type: 'handout', name: 'DMToolkit Guide' })[0];
            if (!handout) {
                handout = createObj('handout', {
                    name: 'DMToolkit Guide',
                    inplayerjournals: 'all',
                    archived: false,
                });
            }

            // Player-facing notes (HTML)
            const playerNotes = '<h1 style="color:#e94560;">🛠️ DMToolkit v' + VERSION + ' — Player & DM Guide</h1>' +
                '<hr>' +

                '<h2 style="color:#66bb6a;">📚 For Players</h2>' +

                '<h3>🎮 Your Turn in Combat</h3>' +
                '<p>On your turn you get: <b>Movement</b> (up to your speed), <b>one Action</b>, optionally a <b>Bonus Action</b>, and a <b>Free Object Interaction</b>.</p>' +
                '<p><b>Actions you can take:</b></p>' +
                '<ul>' +
                '<li><b>Attack</b> — Make a melee or ranged attack</li>' +
                '<li><b>Cast a Spell</b> — If its casting time is 1 action</li>' +
                '<li><b>Dash</b> — Double your movement this turn</li>' +
                '<li><b>Dodge</b> — Attacks against you have disadvantage, DEX saves have advantage</li>' +
                '<li><b>Disengage</b> — Move without provoking opportunity attacks</li>' +
                '<li><b>Help</b> — Give an ally advantage on their next roll</li>' +
                '<li><b>Hide</b> — Make a Stealth check to become hidden</li>' +
                '<li><b>Ready</b> — Prepare an action with a trigger condition</li>' +
                '<li><b>Search</b> — Make a Perception or Investigation check</li>' +
                '</ul>' +
                '<p><b>Reactions</b> (once per round, usually not on your turn): Opportunity Attack when an enemy leaves your reach, or reaction spells like Shield and Counterspell.</p>' +

                '<h3>⚔️ How Attacks Work</h3>' +
                '<p><b>Melee:</b> d20 + STR mod + proficiency vs target AC<br>' +
                '<b>Ranged:</b> d20 + DEX mod + proficiency vs target AC<br>' +
                '<b>Finesse weapons:</b> Choose STR or DEX<br>' +
                '<b>Natural 20:</b> Critical hit! Roll damage dice twice<br>' +
                '<b>Natural 1:</b> Automatic miss</p>' +
                '<p><b>Advantage:</b> Roll 2d20, use the higher. <b>Disadvantage:</b> Roll 2d20, use the lower.</p>' +

                '<h3>✨ Spellcasting Basics</h3>' +
                '<p><b>Spell Attack:</b> d20 + spellcasting ability mod + proficiency<br>' +
                '<b>Spell Save DC:</b> 8 + spellcasting ability mod + proficiency<br>' +
                '<b>Cantrips:</b> Free, no slot needed. Scale with character level.<br>' +
                '<b>Concentration:</b> Only one at a time. CON save on damage (DC 10 or half damage taken).</p>' +

                '<h3>🎯 Skills & Ability Checks</h3>' +
                '<p>Roll: d20 + ability modifier + proficiency (if proficient)</p>' +
                '<p><b>STR:</b> Athletics | <b>DEX:</b> Acrobatics, Sleight of Hand, Stealth | <b>INT:</b> Arcana, History, Investigation, Nature, Religion | <b>WIS:</b> Animal Handling, Insight, Medicine, Perception, Survival | <b>CHA:</b> Deception, Intimidation, Performance, Persuasion</p>' +

                '<h3>🤕 Common Conditions</h3>' +
                '<ul>' +
                '<li><b>Prone:</b> Half movement to stand. Melee advantage against you, ranged disadvantage. Your attacks have disadvantage.</li>' +
                '<li><b>Grappled:</b> Speed 0. Escape with Athletics or Acrobatics vs their Athletics.</li>' +
                '<li><b>Frightened:</b> Disadvantage on attacks/checks while you can see the source.</li>' +
                '<li><b>Poisoned:</b> Disadvantage on attacks and ability checks.</li>' +
                '<li><b>Stunned/Paralyzed:</b> Can\'t move or act. Attacks against you have advantage.</li>' +
                '</ul>' +

                '<h3>😴 Resting</h3>' +
                '<p><b>Short Rest (1 hour):</b> Spend Hit Dice to heal. Some features recharge.<br>' +
                '<b>Long Rest (8 hours):</b> Regain all HP, half your Hit Dice, all spell slots. One exhaustion level removed.</p>' +

                '<h3>📋 Session Setup</h3>' +
                '<p>At the start of each session, the DM may send you a setup prompt asking you to enter your Initiative modifier, AC, and HP from D&D Beyond. This helps the DM\'s automation tools work properly with Beyond20.</p>' +

                '<hr>' +
                '<h2 style="color:#e94560;">🛠️ For the DM</h2>' +

                '<h3>⚔️ Combat Commands</h3>' +
                '<table border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse;width:100%;">' +
                '<tr style="background:#333;color:white;"><th>Command</th><th>Description</th></tr>' +
                '<tr><td><code>!combat --all</code></td><td>Roll initiative for all tokens on the page</td></tr>' +
                '<tr><td><code>!combat --npcs</code></td><td>Roll initiative for NPCs only</td></tr>' +
                '<tr><td><code>!combat --pcs</code></td><td>Roll initiative for PCs only</td></tr>' +
                '<tr><td><code>!combat --group</code></td><td>Group initiative (shared sheets = same roll)</td></tr>' +
                '<tr><td><code>!combat --remind</code></td><td>Remind players who haven\'t rolled</td></tr>' +
                '<tr><td><code>!combat --debug</code></td><td>Inspect token NPC/PC detection</td></tr>' +
                '<tr><td><code>!combat --tag npc/pc</code></td><td>Manually tag selected tokens</td></tr>' +
                '<tr><td><code>!combat --setinit [N]</code></td><td>Set initiative modifier for selected tokens</td></tr>' +
                '<tr><td><code>!combat --end</code></td><td>End combat, clear turn order</td></tr>' +
                '</table>' +

                '<h3>📌 Condition Commands</h3>' +
                '<table border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse;width:100%;">' +
                '<tr style="background:#333;color:white;"><th>Command</th><th>Description</th></tr>' +
                '<tr><td><code>!condition</code></td><td>Show interactive condition menu</td></tr>' +
                '<tr><td><code>!condition --add [name]</code></td><td>Apply condition to selected tokens</td></tr>' +
                '<tr><td><code>!condition --remove [name]</code></td><td>Remove condition from selected tokens</td></tr>' +
                '<tr><td><code>!condition --clear</code></td><td>Remove all conditions from selected tokens</td></tr>' +
                '</table>' +

                '<h3>💰 Loot Commands</h3>' +
                '<table border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse;width:100%;">' +
                '<tr style="background:#333;color:white;"><th>Command</th><th>Description</th></tr>' +
                '<tr><td><code>!loot --cr [N]</code></td><td>Generate individual treasure for CR N</td></tr>' +
                '<tr><td><code>!loot --cr [N] --count [X]</code></td><td>Roll for X creatures, total coins</td></tr>' +
                '<tr><td><code>!loot --hoard --cr [N]</code></td><td>Hoard treasure with magic items</td></tr>' +
                '<tr><td><code>!loot --magic [rarity]</code></td><td>Random magic item</td></tr>' +
                '<tr><td><code>!loot --quest</code></td><td>Random quest/flavor item</td></tr>' +
                '</table>' +

                '<h3>📋 Other Commands</h3>' +
                '<table border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse;width:100%;">' +
                '<tr style="background:#333;color:white;"><th>Command</th><th>Description</th></tr>' +
                '<tr><td><code>!summary</code></td><td>Show encounter summary (combatants, loot)</td></tr>' +
                '<tr><td><code>!dm</code></td><td>DM quick reference screen</td></tr>' +
                '<tr><td><code>!guide</code></td><td>Player quick guide (public)</td></tr>' +
                '<tr><td><code>!setup</code></td><td>Session setup — sync stats from D&D Beyond</td></tr>' +
                '<tr><td><code>!setup --srd</code></td><td>Auto-fill NPC init mods from SRD</td></tr>' +
                '<tr><td><code>!setup --bulk [list]</code></td><td>Bulk import (e.g., <code>Goblin:2,Wolf:2</code>)</td></tr>' +
                '<tr><td><code>!toolkit</code></td><td>Show help menu</td></tr>' +
                '<tr><td><code>!toolkit --config</code></td><td>Toggle settings</td></tr>' +
                '<tr><td><code>!toolkit --handout</code></td><td>Create/update this handout</td></tr>' +
                '</table>' +

                '<h3>⭐ XP Tracker</h3>' +
                '<table border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse;width:100%;">' +
                '<tr style="background:#333;color:white;"><th>Command</th><th>Description</th></tr>' +
                '<tr><td><code>!xp</code></td><td>View session XP summary</td></tr>' +
                '<tr><td><code>!xp --add [N] [reason]</code></td><td>Add manual XP (puzzles, RP, etc.)</td></tr>' +
                '<tr><td><code>!xp --end</code></td><td>Award XP to players (public announcement)</td></tr>' +
                '<tr><td><code>!xp --reset</code></td><td>Clear session XP tally</td></tr>' +
                '</table>' +
                '<p><b>Auto-tracking:</b> When HP Monitor is enabled, defeated NPCs automatically add XP to the session tally based on CR (from sheet or SRD lookup). Manual XP for non-combat rewards can be added with <code>!xp --add</code>.</p>' +

                '<h3>💀 HP Monitor (Auto-Feature)</h3>' +
                '<p>Enabled via <code>!toolkit --config</code>. Triggers automatically when token HP changes:</p>' +
                '<ul>' +
                '<li><b>NPC drops to 0 HP:</b> Applies dead marker + gray tint, logs XP</li>' +
                '<li><b>PC drops to 0 HP:</b> Applies unconscious marker, announces publicly</li>' +
                '<li><b>PC healed from 0:</b> Removes markers, announces recovery</li>' +
                '<li><b>Bloodied (optional):</b> Whispers GM when NPC drops below half HP</li>' +
                '</ul>' +

                '<h3>🔧 How Initiative Works (Beyond20 Workflow)</h3>' +
                '<p>Since D&D Beyond + Beyond20 doesn\'t sync character data to Roll20 sheets, DMToolkit uses this priority order for initiative modifiers:</p>' +
                '<ol>' +
                '<li>Sheet attributes (if they exist): <code>initiative_bonus</code>, <code>dexterity_mod</code>, etc.</li>' +
                '<li>Stored overrides from <code>!combat --setinit</code> or <code>!setup</code></li>' +
                '<li>SRD monster database lookup (200+ monsters)</li>' +
                '<li>Default: +0</li>' +
                '</ol>' +
                '<p>Run <code>!setup --srd</code> at session start to auto-populate NPC init mods, and <code>!setup</code> to prompt players for their stats.</p>' +

                '<hr>' +
                '<p style="color:#888;font-size:11px;">DMToolkit v' + VERSION + ' | Created by Guy with Claude | Compatible with D&D Beyond + Beyond20 + Roll20 5E OGL</p>';

            // GM notes with additional technical info
            const gmNotes = '<h2>🔒 GM Technical Notes</h2>' +
                '<p><b>State Storage:</b> All data stored in <code>state.DMToolkit</code></p>' +
                '<p><b>Manual Tags:</b> ' + JSON.stringify(state.DMToolkit.tags || {}) + '</p>' +
                '<p><b>Init Overrides:</b> ' + JSON.stringify(state.DMToolkit.initMods || {}) + '</p>' +
                '<p><b>Config:</b> ' + JSON.stringify(state.DMToolkit.config || {}) + '</p>';

            // IMPORTANT: notes and gmnotes must be set AFTER creation, in separate calls
            setTimeout(function() {
                handout.set('notes', playerNotes);
            }, 100);
            setTimeout(function() {
                handout.set('gmnotes', gmNotes);
            }, 200);

            whisperGM('<div style="' + STYLE.box + '"><div style="' + STYLE.title + '">📖 Handout Created!</div>' +
                '<p style="text-align:center;"><b>"DMToolkit Guide"</b> has been created/updated in your Journal.</p>' +
                '<p style="text-align:center;color:#aaa;">Visible to all players. Find it in the Journal tab (📋).</p></div>');
        },
    };

    // ========================================================================
    // MESSAGE ROUTER
    // ========================================================================
    const handleInput = (msg) => {
        if (msg.type !== 'api') return;

        const args = msg.content.split(/\s+/);
        const cmd = args[0].toLowerCase();
        const isGM = playerIsGM(msg.playerid);

        switch (cmd) {
            case '!combat':
                if (!isGM) return;
                switch (args[1] || '--all') {
                    case '--all': Combat.rollAll(msg); break;
                    case '--npcs': Combat.rollNPCs(msg); break;
                    case '--pcs': Combat.rollPCs(msg); break;
                    case '--group': Combat.rollGroup(msg); break;
                    case '--remind': Combat.remind(msg); break;
                    case '--reroll': Combat.rollAll(msg); break;
                    case '--debug': Combat.debug(msg); break;
                    case '--tag': Combat.tag(msg); break;
                    case '--setinit': Combat.setInit(msg); break;
                    case '--end': Combat.end(); break;
                    default: Combat.rollAll(msg); break;
                }
                break;

            case '!condition':
                Conditions.apply(msg);
                break;

            case '!loot':
                if (!isGM) return;
                Loot.generate(msg);
                break;

            case '!summary':
                if (!isGM) return;
                if (args[1] === '--reset') Summary.reset();
                else Summary.generate();
                break;

            case '!dm':
                if (!isGM) return;
                DMScreen.show(msg);
                break;

            case '!guide':
                // Public — anyone can use
                PlayerGuide.show(msg);
                break;

            case '!setup':
                // Players can use --save on their own characters
                // GM can use everything
                if (args[1] === '--save') {
                    Setup.saveStats(msg);
                } else if (isGM) {
                    Setup.run(msg);
                }
                break;

            case '!conc':
                if (args[1] === '--fail') {
                    // GM clicked "Failed" on a concentration check
                    const failCharId = args[2];
                    if (failCharId && state.DMToolkit.concentration[failCharId]) {
                        Concentration.drop(failCharId, 'failed CON save');
                    }
                } else if (args[1] === '--pass') {
                    whisperGM('<div style="' + STYLE.box + '"><div style="' + STYLE.title + '">✅ Concentration Held</div></div>');
                } else if (isGM) {
                    Concentration.handleCommand(msg);
                }
                break;

            case '!xp':
                if (!isGM) return;
                XPTracker.handleCommand(msg);
                break;

            case '!recap':
                if (!isGM) return;
                Recap.handleCommand(msg);
                break;

            case '!quest':
                QuestTracker.handleCommand(msg, isGM);
                break;

            case '!downtime':
                if (!isGM) return;
                Downtime.handleCommand(msg);
                break;

            case '!session':
                if (!isGM) return;
                SessionSummary.handleCommand(msg);
                break;

            case '!toolkit':
                if (!isGM) return;
                if (args[1] === '--config') Config.showConfig();
                else if (args[1] === '--toggle' && args[2]) Config.toggle(args[2]);
                else if (args[1] === '--handout') Config.createHandout();
                else Config.showHelp();
                break;
        }
    };

    // ========================================================================
    // TURN ORDER CHANGE HANDLER
    // ========================================================================
    const handleTurnOrderChange = (obj) => {
        if (!state.DMToolkit.encounter.active) return;

        const turnorder = obj.get('turnorder') === '' ? [] : JSON.parse(obj.get('turnorder'));
        if (turnorder.length === 0) return;

        const current = turnorder[0];

        if (current.id === '-1' && current.custom === '🔄 Round') {
            state.DMToolkit.encounter.round = current.pr;
            if (state.DMToolkit.config.announceRounds) {
                sendPublic('<div style="' + STYLE.box + '"><div style="' + STYLE.title + '">🔄 Round ' + current.pr + '</div></div>');
            }
        } else if (current.id !== '-1') {
            // Process condition timers for the token whose turn just STARTED
            // (conditions tick at start of affected creature's turn in 5E)
            Conditions.processTurnChange(current.id);

            if (state.DMToolkit.config.announceTurns) {
                const token = getObj('graphic', current.id);
                if (token) {
                    const charId = token.get('represents');
                    const npc = charId ? isNPC(charId) : false;
                    if (!npc) {
                        const name = token.get('name') || 'Adventurer';
                        sendPublic('<div style="' + STYLE.box + '">' +
                            '<div style="text-align:center;font-size:14px;">⚔️ <b>' + name + '</b> — Your turn!</div></div>');
                    }
                }
            }
        }
    };

    // ========================================================================
    // REGISTER
    // ========================================================================
    const registerEventHandlers = () => {
        on('chat:message', handleInput);
        on('chat:message', Concentration.handleChat);
        on('change:campaign:turnorder', handleTurnOrderChange);
        on('change:graphic:bar1_value', Concentration.handleDamage);
        on('change:graphic:bar1_value', HPMonitor.handleHPChange);
        on('change:player:_online', function(obj) {
            if (obj.get('_online')) Recap.whisperToPlayer(obj.get('_id'));
        });
    };

    on('ready', () => {
        initState();
        registerEventHandlers();
        log('DMToolkit v' + VERSION + ' loaded. Type !toolkit for help.');

        // Auto-create handout on first install (or if deleted)
        setTimeout(function() {
            const existing = findObjs({ type: 'handout', name: 'DMToolkit Guide' });
            if (existing.length === 0) {
                Config.createHandout();
                log('DMToolkit: Created "DMToolkit Guide" handout.');
            }
        }, 2000);

        setTimeout(function() {
            whisperGM('<div style="' + STYLE.box + '">' +
                '<div style="' + STYLE.title + '">🛠️ DMToolkit v' + VERSION + ' Ready!</div>' +
                '<div style="text-align:center;padding:5px;">' +
                '<a style="' + STYLE.btn + '" href="!toolkit">📖 Help</a> ' +
                '<a style="' + STYLE.btn + '" href="!dm">📋 DM Screen</a> ' +
                '<a style="' + STYLE.btn + '" href="!setup">📋 Session Setup</a> ' +
                '<a style="' + STYLE.btn + '" href="!guide">📚 Player Guide</a> ' +
                '<a style="' + STYLE.btn + '" href="!toolkit --handout">📄 Update Handout</a> ' +
                '<a style="' + STYLE.btn + '" href="!toolkit --config">⚙️ Config</a>' +
                '</div></div>');
        }, 1000);
    });

    return { version: VERSION };
}());