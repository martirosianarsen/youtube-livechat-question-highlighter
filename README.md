# YouTube Live Chat Question Highlighter

A tabbed live-chat interface and compact question queue for streamers, moderators, and live Q&A sessions.

[Chrome Web Store](https://chromewebstore.google.com/detail/fkebfbgodophecikemcooilgpfafnmpi)

Version 1.1.0 adds a new speech-bubble logo, compact question cards, light/dark themes, search by text or viewer, unanswered/answered/all filters, copying, safe stream links, and confirmed queue clearing. Existing saved questions and read flags are retained, with the same `highlightedQuestions` storage key and a default 100-question limit that can be changed in Settings (0 means no fixed count limit, subject to available Chrome storage). Previously read questions appear as answered.

## Use

The live-chat area has two tabs: **Questions** lists detected questions from the current stream; **Live chat** displays YouTube’s original chat, including its native message composer. Native messages and the composer are kept in place rather than cloned. Switch off Tabbed live chat in Settings to restore the normal YouTube layout. The toolbar popup shows the queue across all captured streams.

Open a YouTube live stream with live chat or a chat replay. Likely questions are highlighted in chat and saved in the question queue. Choose **Mark answered** to move a question to Answered, or mark it unanswered to return it to the active queue. Search by question or viewer, copy text, reopen a source stream, or delete a saved question. The Settings page controls capture, embedded chat tabs, theme, chat highlighting and color, question starters, custom starter phrases, replay detection, queue capacity, and maximum message length. Restore defaults resets the form; Save applies changes to open tabs. Reducing the queue below its current size requires confirmation before older records are removed.

Detection is heuristic: question marks and common question starters, including Armenian punctuation. It may miss questions or include messages that are not questions. Only currently rendered text-message renderers in YouTube live-chat and replay frames are scanned; paid-message formats, comments, old chat history, and arbitrary chat platforms are not indexed. Newly rendered/replayed messages may be detected again after queue clearing. Opening a stream does not jump to an exact chat timestamp. Refresh live-chat tabs after installing an update.

No account, telemetry, external libraries, or remote executable code at runtime. All queue data and the theme preference are saved locally. [Privacy policy](PRIVACY.md).

## Develop

```sh
npm ci
npx playwright install chromium
npm test
python3 scripts/package.py
```

Load this folder using Chrome Extensions → Developer mode → Load unpacked. Tests run the real extension in an isolated Chromium profile with intercepted YouTube-shaped chat fixtures; they do not connect to a real live stream. Validate against a current live stream before production rollout, since YouTube may change its DOM.

For the standalone sample-data design preview:

```sh
python3 -m http.server 8766 --bind 127.0.0.1
```

Open `http://127.0.0.1:8766/preview.html`. This uses separate demo storage and does not access the installed extension's queue.

Storage changes are serialized by the service worker to avoid lost writes during bursts. Stream and message IDs distinguish questions across broadcasts. Legacy string records are converted to objects without discarding their text or read status. Detection reads the message body separately from author names.

## Release

Upload the built runtime ZIP as an update to the existing item `fkebfbgodophecikemcooilgpfafnmpi`. The package excludes tests, preview pages, development dependencies, and source artwork. Confirm the dashboard's current version is below 1.1.0; otherwise increment the manifest and package versions before rebuilding. Submission has not been performed by these scripts.

The original README referenced MIT licensing but no LICENSE file was present in the repository; no new license terms are introduced here.
