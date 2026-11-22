# Abbreviations, a Markooj add-in

Abbreviations finds the abbreviations you define in a document, such as "sediment delivery ratio (SDR)", and lists
them for you. It is also the starting point for anyone who wants to make an add-in for
[Markooj](https://datakeen.github.io/markooj/).

## What it does

- **Insert a list:** the **Abbreviations** button on the **Add-ins** tab inserts a table of every abbreviation and its
  meaning at the cursor. The command search (**Alt+Q**) finds it as "Insert list of abbreviations".
- **Count:** the status bar shows how many abbreviations the document defines, such as "4 abbr.".
- **Save as CSV:** **File → Save As → From add-ins → Abbreviations (CSV)** saves the list for Excel.
- **Sort:** **File → Options → Abbreviations** chooses whether the list is sorted from A to Z (on by default).

An abbreviation is found when it is written in capitals inside parentheses right after the words it stands for:
"the Water Resources Board (WRB)". Abbreviations is made by the Markooj team, so it shows a check mark next to its name.

## Install

1. In Markooj, click **File → Add-ins → Browse**.
2. Search for **Abbreviations**, and click **Install**.
3. The first time you install an add-in, Markooj asks you to turn on community add-ins. Click **Turn on**.

It works with Markooj 1.1.0 or later and does not use the internet.

## Make your own add-in

This repository is a GitHub template, so it is the quickest way to start.

1. Click **Use this template → Create a new repository** at the top of this page, and give it a name.
2. In `manifest.json`, change `id`, `name`, `author`, `authorUrl`, `description`, `icon`, `color` and `category`.
   The `id` is 3 to 40 lowercase letters, digits and hyphens, and never changes later.
3. Write your add-in in `main.js`. Markooj runs it once when it starts, with `app`, `markooj` and `addin` ready to use.
   The API is in [docs/ADDINS.md](https://github.com/datakeen/markooj/blob/main/docs/ADDINS.md).
   `styles.css` is optional; delete it if you do not need it.
4. Try it: in Markooj, click **File → Add-ins → Open add-ins folder**, make a folder there named after your add-in's
   id (such as `word-goals`), copy `manifest.json`, `main.js` and `styles.css` into it, and click **Reload add-ins**.
   Delete that folder when you are done.
5. Check it: `node tools/check.js` (with [Node.js](https://nodejs.org) 18 or later). The release workflow runs the
   same check.
6. Publish: on the **Releases** page, create a release with the tag `v` + your version, such as `v1.0.0`. The
   **Release** workflow attaches `manifest.json`, `main.js` and `styles.css` to it.
7. List it in Markooj: follow
   [SUBMITTING.md](https://github.com/datakeen/markooj-addins/blob/main/SUBMITTING.md) to add one entry to the add-in
   list with a pull request.

**Updates:** raise `version` in `manifest.json` and publish a release with the matching tag. Markooj offers the update
to everyone who installed your add-in within a day.

### Files

| File | What it is |
| --- | --- |
| `manifest.json` | The add-in's id, name, version, the oldest Markooj it needs (`minMarkooj`), author and description. |
| `main.js` | The add-in's code. |
| `styles.css` | Optional styles. Start every selector with your add-in's id. |
| `tools/check.js` | Checks `manifest.json` and `main.js` before a release. |
| `.github/workflows/release.yml` | Publishes a release when you add a tag such as `v1.0.0`. |

Extra data files, such as a word list, go next to `manifest.json` and are listed under `"files"` in it, for example
`"files": [{ "name": "words.json" }]`. The whole add-in may be up to 50 MB, and `main.js` up to 2 MB.

## Questions

Stuck while making your add-in? [Send a message](https://tally.so/r/Dq7D5p?from=template-readme). It is a short form,
and you will get a reply.

## License

This template and the Abbreviations add-in are under the [MIT License](LICENSE), so you can reuse any part of them in
your own add-in, under any license you choose. Change the copyright line in `LICENSE` to your own name, or replace
the file with the license you want.
