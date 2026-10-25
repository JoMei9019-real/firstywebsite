# JoMei9019 — Projects

Responsive project website for **AirPort-RTW** and **Feixiao**, with direct release downloads, version-specific changelogs, a system-aware light/dark theme and a separate test-build page. All visible branding is JoMei9019.

## Hosting

The website is buildless HTML, CSS and JavaScript. Serve the repository root on **GitHub Pages** (branch `main`, folder `/ (root)`) or any static web host. The existing `CNAME` is retained. `.nojekyll` ensures the static files are served directly. No dependencies, server or credentials are needed.

- `/`: project presentation, stable downloads, changelog and support
- `/beta/`: AirPort-RTW GitHub Actions artifacts
- `/airport-rtw/` and `/feixiao/`: individual Coming soon product pages, linked from the homepage project titles
- `/site/`: redirect to the homepage, preserving the old entry point
- `/discord/` and `/discord.html`: existing Discord destination

Relative asset URLs support both the custom domain and the GitHub Pages repository subpath.

## Appearance

Appearance defaults to **System** on every page and tracks `prefers-color-scheme` changes while the page is open. The compact appearance selector in each page footer, next to the language selector, can explicitly choose **Light** or **Dark**, or return to **System**. New choices persist as `jomei-appearance` and synchronize between tabs. Legacy `jomei-theme` values are ignored so returning visitors receive the new automatic default. Disabled storage does not prevent automatic selection. The early theme script applies the appearance before content renders; browser theme color follows it too.

## Languages

English is the default, including the static HTML served without JavaScript. The compact **EN / DE** selector in the homepage and beta footers switches between English and German immediately. The choice is stored as `jomei-language` and applies across pages and return visits; disabled browser storage falls back gracefully.

`assets/i18n.js` contains the German translations, locale-aware formatting and language selection. Static text, page metadata, accessibility labels, theme controls and API error messages are translated. Dynamic release and artifact interfaces rerender in the selected language without another API request or losing the selected project/version or beta search/filter. Release notes, commit titles, versions and filenames remain as published on GitHub.

When adding interface text, use English in the HTML, add the German equivalent to `GERMAN`, and use `t()` for dynamically rendered strings. Keep placeholder names identical between both languages.

## Automatic release updates

`assets/github.js` is the data layer. Public GitHub REST API requests read releases from:

- `JoMei9019-real/AirPort-RTW`
- `JoMei9019-real/Feixiao`

The project cards use GitHub's `/releases/latest` designation. The release explorer loads up to 100 releases per page, filters drafts and prereleases, and offers older pages when available. Selecting a version changes its release notes **and its associated download files together**. Release notes remain in the language used on GitHub. No versions, release notes or asset filenames are hardcoded.

To publish a new stable version, publish a GitHub Release in the corresponding project and attach the built files. Mark it as the latest release on GitHub when appropriate. The website discovers the update automatically, with a maximum normal cache interval of ten minutes. The refresh button requests fresh data immediately.

Requests are deduplicated and cached in the browser for ten minutes, and the page checks again while visible or when brought to the foreground. API failures fall back to explicitly labelled cached data or direct GitHub links. Rate-limit responses pause requests until retry time. Browser storage is optional. No GitHub token is embedded or requested.

## Beta builds

`/beta/` reads runs of `.github/workflows/native-build.yml` in AirPort-RTW and joins them to matching `AirPortRTW-*` artifacts. The workflow currently appears on GitHub as **Native AirPort build**. All successful non-PR runs on branches containing `beta` qualify, including `1.0.0-beta` and `beta-2.0.0`; new beta branches are discovered automatically. Main-branch and failed builds are excluded. Artifact name, branch, source commit, run title, size and expiry are read from GitHub. The interface groups each artifact by its actual `major.minor.patch` version, independently of the branch (so `1.0.2` and `1.1.0` stay separate even on `1.0.0-beta`). Version cards show the latest loaded build and count, sort numerically, and discover future series automatically. The most recently updated series opens by default; selecting another series shows only its builds and resets the search. Refresh preserves the selection when available. Unversioned artifact names stay in a separate “Other builds” group, without guessing from a potentially outdated branch name. The first 100 runs and artifacts are loaded initially; older pages are loaded on demand, adding any newly discovered series.

Downloads go to GitHub's artifact download page and **require GitHub sign-in and repository read access**. Expired artifacts have no download button, and deleted artifacts no longer appear. No public mirrors or third-party download proxies are used. Run details link to the matching Actions run; the change summary is the run's actual commit title.

The beta page has no link from the public homepage, uses `noindex, nofollow, noarchive` and is disallowed in `robots.txt`. **This is an unlisted page, not access control.** Anyone who knows `/beta/` can open it, and the source repository is public. If actual confidentiality is needed, use hosting with server-side authentication; a JavaScript password would not protect the content.

## Cache-safe publication

The HTML entry points reference a content-addressed directory under `assets/releases/`. Every module, stylesheet and theme initializer for a page loads from the same immutable directory. This prevents a newly translated page from using an older cached German-only download renderer or date formatter. GitHub API caching stores only data and remains independent of UI language.

After editing top-level asset sources, run `npm run prepare:assets` and commit both the updated HTML references and the generated directory. Earlier directories are retained for visitors with cached HTML. Tests verify the complete deployed asset graph against the source files.

## Local checks

Node.js 22 or newer:

```sh
npm run check
npm test
```

No installation step is required. Tests cover stable-release filtering, binary selection, beta run/artifact association, expiry, unsafe release-note HTML/URLs, caching, deduplication, offline behavior, 404 invalidation and rate limits. GitHub Actions runs these checks on pushes and pull requests.

For a local static preview, serve the repository root using your preferred static HTTP server. `scripts/prepare-preview.mjs` optionally copies public files to `dist/` for preview environments that require a dedicated static directory. `dist/` is not needed for GitHub Pages.

## Editing

- `index.html`: homepage content and layout
- `assets/style.css`: responsive design and theme tokens
- `assets/app.js`: release explorer and downloads
- `assets/github.js`: repositories, API, cache and artifact filtering
- `assets/shared.js`: safe release-note formatting and shared UI
- `beta/index.html`, `assets/beta.js`: test-build interface

Project descriptions are based on the upstream READMEs. Hardware compatibility and installation links lead to the projects' current documentation. Do not present experimental AWDL or AirDrop work as supported functionality in stable releases.
