# Super Sluggers League HQ

A static React/Vite dashboard for a custom CPU-vs-CPU Mario Super Sluggers league. It is designed for GitHub Pages and does not require a backend.

## Features

- **Players:** searchable/filterable character cards and detail modal with batting, pitching, fielding, ability, captain status, and good/bad chemistry.
- **Chemistry:** interactive horizontal bar chart and connection directory for the good/bad chemistry entries recorded in the supplied HTML.
- **Rosters:** four randomly generated sample teams (nine players each, reshuffled on page load); swap this logic for your real teams in `src/App.jsx`.
- **Outfield:** ranks LF/CF/RF trios where the CF has good chemistry with both corner outfielders. The displayed formula is intentionally explicit and editable.

## Data source and assumptions

`src/data/characters.json` was generated from the character detail pages in the provided `index.html`. Stats and chemistry names are preserved from that source where present. The HTML's image assets were not included as separate files, so the UI uses initials and class-colored avatar blocks instead of broken image links.

The outfield ranking formula is a prototype policy, not an in-game official formula:
- Fielding throw speed: 25% of the 100-point base score, normalized against 90.
- Speed: 35%, normalized against 90.
- Fielding: 32%, normalized against 100.
- Super Dive: +8 points per player.
- Trio score is the mean of the three player scores. Tiers: S >= 82, A >= 72, B >= 62, C >= 50, otherwise D.

Chemistry is evaluated using the center fielder's listed good-chemistry entries, including simple group/family matching (for labels such as Yoshis and Toads). Because chemistry labels can be family/group names, review `familyAliases` in `src/App.jsx` if you want to tune matching rules. Bad chemistry is not treated as a hard constraint for the outfield search.

## Run locally

Install Node.js 20+ (or a current LTS release), then:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

To test a production build:

```bash
npm run build
npm run preview
```

## Deploy to GitHub Pages

1. Create a GitHub repository and push this project to it.
2. In GitHub, open **Settings → Pages** and set the publishing source to **GitHub Actions**.
3. Add the workflow below as `.github/workflows/deploy.yml` (included in this project).
4. Push to the `main` branch. The workflow builds and publishes the `dist/` folder.

The Vite base is `./`, so the generated static assets work when hosted at a repository subpath.

## Good practices used

- **Data/UI separation:** character records are JSON, not hard-coded in every component.
- **Small components:** cards, avatars, stat bars, modals, tabs, and chart panels have separate responsibilities.
- **Derived views:** filters, chemistry summaries, and outfield configurations are computed from source data rather than maintained as duplicate state.
- **Stable keys:** mapped React elements use character IDs or unique position/configuration keys.
- **Accessible basics:** semantic buttons, labels, navigation landmarks, modal dialog semantics, and visible keyboard focus.
- **Responsive layout:** grid-based cards and compact mobile layouts.
- **Transparent ranking:** the outfield score and tier thresholds are displayed next to the results so viewers can evaluate or challenge the methodology.
- **Static hosting:** no server, credentials, or environment variables are needed.

## Updating league data

Edit `src/data/characters.json`. Each character record has `name`, `class`, `ability`, `stats`, `goodChemistry`, and `badChemistry`. Keep `id` stable when updating names to avoid React key churn. Rosters are randomly assigned in `RostersTab` on page load; replace that assignment logic with your final team data when ready.
