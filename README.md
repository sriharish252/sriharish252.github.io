# sriharish252.github.io

The portfolio of Sri Harish Jayaram, live at <https://sriharish252.github.io>.

It is one hand-written HTML page and one stylesheet in [`site/`](site), with self-hosted fonts and no build step. Light and dark follow the system, and a toggle can pin either. A push to `main` deploys `site/` to GitHub Pages through [Actions](.github/workflows/pages.yml).

[`site/computational-website-generation/`](site/computational-website-generation) is the built demo of Computational Website Generation, copied in from that project's private repository so the demo can be public while its source is not. Don't edit it by hand.

To preview it locally, run `python -m http.server -d site` and open <http://localhost:8000>.

© Sri Harish Jayaram. All rights reserved.
