### Overall ordering

From highest to lowest priority for the backend, based on what’s in `rules.md` and `cards_database_reference.md`:

---

### 1. Core domain data model (cards and powers)

- **Hero model**
  - Fields: `id`, `name`, `strength`, `default_spawn_amount`, `rarity`, `power1`, `power2`.
  - Static data seeding for all 15 heroes.
- **Monster model**
  - Fields: `id`, `name`, `strength`, `loot_coins`, `loot_gems`, `rarity`, `spawn_rate` (or implied by tier).
  - Static data seeding for all monsters including Ghost King.
- **Power model**
  - Fields: `name`, `cost`, `target_type`, `is_passive`, `trigger_event`, `description`.
  - Static data for all active and passive powers.

---

### 2. Game session and player state model

- **GameSession entity**
  - Player list and turn order.
  - Active monsters (2 per rules.md, or 3 if you follow the reference note — you need to choose).
  - Decks: hero deck, monster deck.
  - Discard piles: heroes, monsters.
  - Burned piles: permanently removed heroes.
  - Global configuration (win conditions, starting resources).
- **PlayerState entity**
  - Current hero (face‑down / hidden vs revealed state).
  - Resources: `life`, `coins`, `gems`.
  - Whether alive or eliminated.
  - Last declared “identity” (could differ from true hero).
  - Any temporary effects (e.g. from powers like mimic).

---

### 3. Game lifecycle and turn engine

- **Game setup**
  - Burn 1 random hero card at start.
  - Deal 1 random hero to each player.
  - Populate active monsters (2 from monster deck per rules.md).
- **Turn sequencing**
  - Track whose turn it is and move to next living player.
  - Enforce that actions happen in a valid order per turn.
- **Identity declaration and accusation**
  - API/state for a player to declare an “identity” (hero claim).
  - Logic for other players to accuse “liar” without blocking ongoing actions.
  - Resolution of accusations when truth of identity is revealed:
    - Stop actions if liar is revealed.
    - Apply penalties/effects as per your design (the docs hint at action stopping, but details are up to you).
- **Available turn actions**
  - “Pick a card, discard one, then use free/paid power.”
    - Draw logic from hero deck.
    - Choose which hero to keep/discard.
    - Enforce discard visibility rule (last discarded card visible).
  - “Attack a monster.”
    - Choose active monster.
    - Compare declared identity’s strength vs monster strength.
    - On success: grant monster loot.
    - On failure: lose a life.
  - “Demask another player” (if 6 gems).
    - Guess target’s true hero.
    - If correct: target loses hero and a life, assign them a new hero (and handle discard/burn of old).
- **End‑game checks**
  - Only 1 player alive.
  - Any player reaches coins = players + 1.
  - Consistent winner resolution and game session closure.

---

### 4. Power system (execution framework)

- **Generic power execution pipeline**
  - Resolve the power from current hero (or from mimic/command effects).
  - Check cost (gems) and target validity.
  - Apply effect atomically, updating game state.
  - Log actions for clients and auditing.
- **Targeting & selection**
  - Validation for `self`, `other_player`, `monster`, `session` targets.
  - Rules when multiple candidates exist (e.g. which monster to pick).
- **Timing and stacking**
  - Decide when a power can be used:
    - During own turn only?
    - Some reactive windows?
  - Handling combinations (e.g. using `fight_monster` then another power in same turn).

---

### 5. Implementation of each power (concrete rules)

You need concrete server‑side implementations for all listed powers:

- **Active powers**
  - `change_monster`: swap active monster with top of deck.
  - `fight_monster`: extra monster fight outside normal restrictions.
  - `fight_player_with_discarded_card`: duel using a hero from discard pile.
  - `add_strength_to_challenger`: temporary +1 strength modifier for above duel.
  - `shuffle_heroes_deck`: refill/shuffle hero deck from non‑burned discards.
  - `change_hero`: draw new hero, discard current.
  - `exchange_gems_with_player`: swap gem counts.
  - `exchange_2coins_for_life`: convert 2 coins to 1 life.
  - `gain_2gems`: add 2 gems.
  - `gain_life`: pay 6 gems to add 1 life.
  - `see_player_card`: reveal target’s hero to caller only.
  - `remove_coin`: target loses 1 coin (removed from game).
  - `shoot_player`: guess hero; if correct, target loses 1 life; track last shot for `all_in`.
  - `all_in`: if last `shoot_player` was correct, double gems; otherwise lose all gems.
  - `steal_gem` (twice for Gobelin): transfer 1 gem from target.
  - `parry_this_you_f_casual`: target loses 1 life.
  - `steal_coin`: transfer 1 coin from target.
  - `mimic_power`: copy and execute eligible active power from target hero.
  - `mimic_hero`: temporarily copy another player’s hero abilities.
  - `dual_attack`: immediate second monster fight.
  - `blind_draw`: draw a card from some deck without seeing it first (you must define from which deck and where it goes).
  - `force_transform`: force discard of target hero and draw new one.
  - `execution`: burn a hero from the game.
  - `command_the_dead`: use discarded hero to fight monster and gain loot.
- **Passive powers**
  - `keep_gems`: cancel steal attempts against you.
  - `teamwork`: whenever you gain gems, double the amount.
  - `alternate_strength`: flip Werewolf strength each turn (5/12).
  - `tribute`: redirect half of other players’ gained gems to you.
  - `royal_immunity`: cannot be targeted by player attacks; also no loot from direct monster fights.

Each of the above requires clear, deterministic backend semantics and integration into the general turn/power system.

---

### 6. Special mechanics and edge rules

- **Ghost of the King**
  - Cannot be challenged when fought (no challenge window).
  - Extra loot when defeated by Mad Prince or Mad Queen.
  - Extra bonus values when Mad Queen uses `command_the_dead` vs Ghost King.
- **Mad Queen**
  - Enforce royal immunity in all target selection logic.
  - Enforce “no direct loot” from her own monster fights.
- **Werewolf transformation**
  - Automatic strength alternation per turn start.
  - Ensure you use the current form’s strength for all calculations.
- **Interactions between passives**
  - Order of operations when multiple passives apply (e.g. `teamwork` and `tribute` in same gem gain event).
  - Clarify if passives trigger on power‑driven gains, loot, or both.
- **Discard / burn rules**
  - Keep last discarded hero visible.
  - Correctly manage when heroes move between deck, hand, discard, burn.

---

### 7. Validation and rules enforcement

- **Resource checks**
  - Gems before power use.
  - Life > 0 to keep playing.
- **Strength checks**
  - Server‑side verification for all fights and duels.
- **State machine validation**
  - Prevent illegal actions for the current game phase / turn step.
  - Ensure only the active player performs turn actions (with clear rules for others’ reactive actions, if any).
- **Challenge timing logic**
  - Implement 10‑second windows where specified (e.g. for fights, powers but not demask).
  - Enforce “no challenge” where explicitly forbidden (Ghost King).

---

### 8. Persistence and concurrency

- **Database persistence**
  - Tables for heroes, monsters, powers, and static data (likely read‑only after seeding).
  - Game session storage with full state snapshot per game.
  - Player state storage.
- **Transactions and concurrency**
  - Ensure each move is atomic.
  - Prevent race conditions when multiple players try to act “at once”.
- **Reconnection and resume**
  - Ability to reload game state for connected clients.

---

### 9. Public backend API

- **Game management endpoints**
  - Create game, join game, start game.
  - Fetch current game state (for a player‑scoped view).
- **Turn and action endpoints**
  - Declare identity.
  - Accuse liar.
  - Draw/discard hero (the “pick card then discard” flow).
  - Attack monster.
  - Use power (generic endpoint with power name and targets).
  - Demask player.
  - End turn (if needed explicitly).
- **State queries**
  - List active monsters, visible discards, own resources, etc.

---

### 10. Real‑time layer and timers

- **Transport**
  - WebSockets or similar to broadcast:
    - Turn changes.
    - Power usage.
    - Combat results.
    - Resource changes.
- **Timer enforcement**
  - Server‑side timers for:
    - Challenge windows.
    - Turn duration (if you add a hard limit).
  - Auto‑resolution on timeout (e.g. no challenge received, or forced pass).

---

### 11. Users, auth, and lobby

- **User accounts**
  - Identity model for human players.
- **Authentication**
  - Basic login/auth mechanism (token, session, etc.).
- **Lobby / matchmaking**
  - Create/join/leave lobby.
  - Start game when conditions met.

---

### 12. Administration, tooling, and balance support

- **Admin tools**
  - Inspect and edit card data (for balance passes).
  - Force end/reset games.
- **Analytics and logging**
  - Track card usage, win rates, and resource flows to support balance.

---

### 13. Testing and simulation

- **Automated tests**
  - Unit tests for each power.
  - Scenario tests for full turn flows, edge cases, and special mechanics.
- **Bots / simulators (optional but valuable)**
  - Run Monte‑Carlo style simulations to validate balance and spot degenerate strategies.

---

If you tell me your planned tech stack (e.g. Node/TypeScript, Python, etc.), I can reorder/merge these into a concrete implementation roadmap (e.g. “Week 1: items 1–3, Week 2: items 4–5…”) with suggested modules and interfaces.