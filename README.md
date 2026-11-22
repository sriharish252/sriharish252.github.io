# sriharish252.github.io

The portfolio of Sri Harish Jayaram, live at <https://sriharish252.github.io>.

It is hand-written HTML, one stylesheet and a few small scripts in [`site/`](site), with no framework, no build step and no animation library. A push to `main` deploys `site/` to GitHub Pages through [Actions](.github/workflows/pages.yml).

## Design

- **Type:** Big Shoulders Display for the large condensed headings, Hanken Grotesk for everything else. Both are self-hosted Latin subsets under the SIL Open Font License; see [`site/assets/fonts/LICENSE.md`](site/assets/fonts/LICENSE.md).
- **Colour:** a pale sky-blue page with deep navy ink and a sun-yellow highlight, plus a navy dark theme. Light and dark follow the system, and the toggle can pin either.
- **Work:** each project is a row that previews its title, a one-line summary and small images, and opens in place for the full write-up. Clicking a preview image opens its row.
- **Links:** links that leave the site (the live demo, GitHub, the paper, LinkedIn) open in a new tab, so the portfolio stays open where you were. Links between the site's own pages stay in the same tab.
- **Images:** every image in a project write-up opens full size in a viewer, with arrows and swipes to move through a set. The small previews in a closed row open the row instead.
- **Attention Ledger:** the work row links to a full page at [`site/attention-ledger/`](site/attention-ledger) with interactive examples, and to the public design notes at [attention-ledger-overview](https://github.com/sriharish252/attention-ledger-overview).
- **Attention Ledger preview:** the diagram is plain HTML and CSS. The preview window (timeline, totals, distractions, raw log and controls) is drawn by [`assets/attention-ledger.js`](site/assets/attention-ledger.js) from invented sample data, so every view agrees; the project page's examples are in [`assets/attention-ledger-page.js`](site/assets/attention-ledger-page.js). No real tracking data is on the site, and the project's source stays private.
- **Motion:** the headline rises line by line on load, a ticker lists the tools I use, rows slide open, and the theme switch spreads out from the button. All of it is CSS or a few lines of script in [`assets/site.js`](site/assets/site.js), and it switches off for visitors who prefer reduced motion.

Before images, the first view is about 80 KB: HTML, CSS and two fonts. Images load lazily, with smaller versions for phones.

## The demo

[`site/computational-website-generation/`](site/computational-website-generation) is the built demo of Computational Website Generation, copied in from that project's private repository so the demo can be public while its source is not. Don't edit it by hand.

## Preview locally

Run `python -m http.server -d site` and open <http://localhost:8000>.

© Sri Harish Jayaram. All rights reserved.
