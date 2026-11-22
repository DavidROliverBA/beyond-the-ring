# Canon research (E3.1): how it was done, what to trust

Task: BACKLOG E3.1. Purpose: give the Rocinante-voyage scenarios (E3.2, E3.3) a factual base. Written 2026-11-22.
Files here: `leviathan-wakes.md` (detailed), `overview-all-books.md` (books 2-9 and novellas, shorter).

## Method and its main limit

The researcher (an AI agent) **cannot read the novels**. Everything below comes from public web pages, fetched on 2026-11-22. No chapter text was read, so:

- **No book and chapter pointers are given.** E3.1.a asked for them; they cannot be established from public summaries (the study-guide pages that have chapter ranges rate-limited the fetches, and none of the fetched pages gave chapter numbers). A person with the book should add them. Each claim carries a source tag and a grade instead.
- Page text was read through a fetch tool that returns a model-written digest of the page, not the raw page. Every claim here is therefore "per digest" of that page. Figures were cross-checked against a second source where one was found; where not, the grade says so.
- The Expanse Wiki on Fandom (the usual reference) could **not** be opened (HTTP 402 on every page). Facts that come from it arrive only second-hand through aggregators (Fables.gg) and search snippets. Treat them as one step further from the source.
- Claims the researcher holds from general memory of the books and that no fetched page confirms are tagged **[R, unverified]**. Do not build on them without a check.

## Sources and reliability

| Tag | Source | What it is | Reliability |
|---|---|---|---|
| W | Wikipedia, plot sections of each novel and the series page, `Memory's Legion` | Community plot summaries | Good for order of events and who is where; thin on numbers; no ship specs. Several summaries look compressed or slightly off (for example it puts the Eros-into-Sun plan one way where a study guide says another). Grade B |
| F | Fables.gg lore pages (Donnager-class, Rocinante, Amun-Ra class, Epstein drive) | A lore aggregator that mirrors Fandom-style ship pages | Gives numbers (lengths, weapons, crews). It does not say whether each figure is from the books, the show or the tabletop RPG, and some look RPG- or show-derived. Grade C for specs, B for event summaries |
| SS/GS | SuperSummary and GradeSaver study guides | Chapter and fan summaries | GradeSaver is fan-contributed and contains clear errors (it merges Ceres and Eros stations, has Eros "decide to destroy life"). Used only where it agrees with something else. SuperSummary fetches were rate-limited and not read in full. Grade C |
| B&N, AL | Barnes & Noble blog and Andrew Liptak book-vs-show recaps of the TV season 1 | Reviewers who had read the books, comparing page and screen | Best available source for **book vs show** differences on the Donnager and Canterbury material. Grade B |
| RPG | Tabletop RPG ship sheets (Green Ronin), reproduced on World Anvil and fan sites | Game stats | The RPG is licensed and shares the setting, but its numbers are game design, partly show-based, not Corey's text. Grade C. Only used when nothing else exists, and flagged |
| WS | Web search result digests | Snippets from the above and from fan sites | Used for pointers only. Grade C |
| E | This repo (`src/`, `assets/models/`, `docs/BACKLOG.md`, `CREDITS.md`) | Engine facts | Reliable for what exists |

Grades for a claim: **A** two or more independent public sources agree and one is not an aggregator; **B** one reasonable source or two that agree but look related; **C** single weak source, RPG/show-derived, or conflicting; **?** not established.

Set-piece documentation is graded A/B/C the same way (how well the public record gives positions, ships, weapons). No set piece reached a clean A for positions or weapons, because public summaries do not carry those details. The grade means "best available".

## Book versus show

The backlog rule: the books are the authority. Because the researcher could not read them, "book" here means "what book-aware sources say is in the book". Where a source is show-based (episode recaps, show-era wiki pages, the RPG), the claim is marked **[show]** or **[show/RPG?]**. Known divergences are listed in each file. The show also reorders events (it runs several books' plots together, adds a Donnager boarding sequence, builds the stealth ships into a named fleet, and gives Phoebe Station scenes); do not take those as book content.

## Rights stance

- Fan project, unofficial and non-commercial. Keep the notice in `CREDITS.md`.
- These notes use facts (names, orders of events, specifications) in the researcher's own words. **No book text is quoted or closely paraphrased**, and no show dialogue, audio, music, stills or screenshots are used or described beyond naming what differs.
- Scenario captions (E3.2) must be newly written, a few words of the books at most, and should not reuse the summary wording of Wikipedia or the wikis either (Wikipedia and Fandom text is CC BY-SA; copying it would bring licence duties).
- Ship dimensions and weapon counts are facts about a fictional setting; they are fine to use, but their source should be recorded in each scenario file (see the format sketch in `leviathan-wakes.md`).
- Spoilers: each tour shows a spoiler warning (E3.5.d). These research notes spoil everything.

## What could not be established (whole project)

- Chapter and page references for any claim.
- Any acceleration figure (in g) given by the books for a named flight, and any in-story date or duration of a flight or battle. No public summary found carries them.
- Positions of bodies at the time of events (the books place events on a calendar only loosely).
- Which ship specifications are book canon and which come from the show or the RPG.
- Details of events in the later books beyond plot summaries (formations, ranges, times).
- Fandom wiki pages (blocked) and the Expanse RPG rulebook text (not available).
