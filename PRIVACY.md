# Privacy policy

YouTube Live Chat Question Highlighter · Version 1.1.0 · October 30, 2026

The extension processes YouTube live-chat messages on your device to identify likely questions. Question detection uses punctuation and common question starters; it can produce false positives or miss questions.

By default it keeps up to 100 recent detected questions in Chrome's local extension storage. Saved records may include message text, the displayed author name, message ID, source stream URL, detection time, and your answered status. Detection rules, custom starter phrases, appearance, layout, and storage-limit preferences are also saved locally. You can change the saved-question limit; setting it to 0 removes the fixed count limit but remains subject to available Chrome storage. Existing saved questions are retained when updating, subject to your configured queue limit.

The extension does not send these records to the developer or third parties. It contains no analytics, ads, tracking, accounts, remote executable code, or cloud synchronization. Copying a question places it on your system clipboard only when you click Copy. Opening a source link makes an ordinary browser request to YouTube, which has its own privacy policy.

The storage permission saves your queue and settings. The content script adds Questions and Live chat tabs while keeping YouTube’s original chat messages and composer. The native chat is visually hidden while the Questions tab is selected. It runs on YouTube live-chat and chat-replay frames to detect questions and visually highlight messages. It does not scan unrelated websites, watch-page comments, or other page text.

You can remove individual questions or clear the full queue after confirmation. Uninstalling the extension removes its local storage. Clearing the queue does not delete messages from YouTube chat. Replayed or newly rendered messages may be detected again.

Support: https://github.com/martirosianarsen/youtube-livechat-question-highlighter/issues
