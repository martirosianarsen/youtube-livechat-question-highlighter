(() => {
  ChatQuestions.createPanel = function ({
    onAction,
    getSettings,
    getRecords,
    streamUrl = location.href,
  }) {
    const { source } = ChatQuestions;
    let tab = "questions",
      filter = "unread";
    const host = document.createElement("div");
    host.setAttribute("data-question-queue-panel", "");
    host.style.cssText =
      "position:fixed;inset:0;z-index:2147483646;pointer-events:none;display:block";
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `<style>
      :host{--bg:#f9fafb;--surface:#fff;--ink:#242833;--muted:#818796;--line:#e6e8ef;--soft:#f0f2f6;--accent:#d75f48;--tint:#fcefe9;color-scheme:light;font:12px/1.5 system-ui,sans-serif;color:var(--ink)}
      :host(.dark){--bg:#16171d;--surface:#202128;--ink:#f0f0f3;--muted:#9a9dab;--line:#30313a;--soft:#25262f;--accent:#f4937b;--tint:#352721;color-scheme:dark}*{box-sizing:border-box}button,input{font:inherit}button{cursor:pointer}button:focus-visible,input:focus-visible{outline:2px solid var(--accent);outline-offset:2px}button{color:var(--muted);background:transparent;border:0}header{height:54px;display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--surface);border-bottom:1px solid var(--line);pointer-events:auto}header svg{width:26px;height:26px;flex-shrink:0}.tabs{display:flex;flex:1;gap:3px;padding:3px;background:var(--soft);border-radius:9px}.tabs button{flex:1;border-radius:6px;padding:7px 5px;font-size:11px;font-weight:600;white-space:nowrap}.tabs button[aria-selected=true]{background:var(--surface);color:var(--ink);box-shadow:0 1px 4px #0001}.badge{color:var(--accent);font-size:10px;margin-left:4px}.settings{font-size:19px;padding:4px;border-radius:6px;line-height:1}.pane{position:absolute;inset:54px 0 0;background:var(--bg);pointer-events:auto;display:flex;flex-direction:column;padding:12px;gap:10px}input[type=search]{width:100%;border:1px solid var(--line);border-radius:8px;padding:9px 10px;background:var(--surface);color:var(--ink);font-size:11px;flex-shrink:0}.filters{display:flex;gap:5px;flex-shrink:0}.filters button{font-size:10px;border:1px solid var(--line);border-radius:7px;padding:5px 9px}.filters button[aria-pressed=true]{color:var(--accent);background:var(--tint);border-color:transparent}.list{overflow:auto;flex:1;min-height:0;scrollbar-width:thin;scrollbar-color:var(--line) transparent}.card{padding:12px;background:var(--surface);border:1px solid var(--line);border-radius:10px;margin-bottom:9px}.author{font-size:10px;font-weight:650;margin:0 0 7px;display:flex;gap:7px;align-items:center}.avatar{display:grid;place-items:center;width:24px;height:24px;background:var(--tint);color:var(--accent);border-radius:7px;font-size:9px}.text{white-space:pre-wrap;overflow-wrap:anywhere;margin:0;font-size:12px;line-height:1.7}.actions{display:flex;justify-content:space-between;align-items:center;margin-top:10px}.actions button{font-size:10px;padding:3px 0}.actions .answered{color:#579e81}.tools{display:flex;gap:12px}.empty{color:var(--muted);font-size:11px;text-align:center;padding:35px 14px;line-height:1.9}.notice{font-size:10px;color:var(--muted);margin:0}.footer{font-size:9px;color:var(--muted);flex-shrink:0;text-align:center}[hidden]{display:none!important}
    </style><header><svg viewBox="0 0 64 64" aria-hidden="true"><rect x="1" y="1" width="62" height="62" rx="18" fill="#e86c55"/><path d="M19 14h26a7 7 0 0 1 7 7v19a7 7 0 0 1-7 7H31L19 54v-7a7 7 0 0 1-7-7V21a7 7 0 0 1 7-7Z" fill="white"/><path d="M26 25a6 6 0 0 1 12 0c0 4-6 4-6 8" fill="none" stroke="#d94c45" stroke-width="4" stroke-linecap="round"/><circle cx="32" cy="40" r="2.3" fill="#d94c45"/></svg><div class="tabs" role="tablist" aria-label="Chat view"><button id="questionsTab" role="tab" aria-selected="true">Questions <span class="badge"></span></button><button id="chatTab" role="tab" aria-selected="false">Live chat</button></div><button class="settings" aria-label="Open settings" title="Settings">⚙</button></header><section class="pane" role="tabpanel" aria-labelledby="questionsTab"><input type="search" placeholder="Search questions or viewers…" aria-label="Search stream questions"><div class="filters"><button data-filter="unread" aria-pressed="true">Unanswered</button><button data-filter="answered" aria-pressed="false">Answered</button><button data-filter="all" aria-pressed="false">All</button></div><p class="notice" role="status" hidden></p><div class="list" aria-live="polite"></div><div class="footer">This stream’s questions · saved on your device</div></section>`;
    const nativeStyle = document.createElement("style");
    nativeStyle.textContent =
      'body[data-question-queue-tab] yt-live-chat-app{position:fixed!important;inset:54px 0 0!important;width:100%!important;height:calc(100% - 54px)!important;box-sizing:border-box!important}body[data-question-queue-tab="questions"] yt-live-chat-app{visibility:hidden!important}';
    document.documentElement.append(nativeStyle, host);
    const $ = (selector) => root.querySelector(selector);
    function notice(text) {
      $(".notice").textContent = text;
      $(".notice").hidden = !text;
    }
    async function action(name, extra = {}) {
      try {
        const result = await onAction(name, extra);
        if (!result?.ok) throw new Error();
        update();
      } catch {
        notice("Could not save. Please refresh the chat and try again.");
      }
    }
    function setTab(value) {
      tab = value;
      $("#questionsTab").setAttribute(
        "aria-selected",
        String(tab === "questions"),
      );
      $("#chatTab").setAttribute("aria-selected", String(tab === "chat"));
      $("#questionsTab").tabIndex = tab === "questions" ? 0 : -1;
      $("#chatTab").tabIndex = tab === "chat" ? 0 : -1;
      $(".pane").hidden = tab !== "questions";
      document.body.setAttribute("data-question-queue-tab", tab);
    }
    $("#questionsTab").onclick = () => setTab("questions");
    $("#chatTab").onclick = () => setTab("chat");
    for (const id of ["#questionsTab", "#chatTab"])
      $(id).onkeydown = (event) => {
        if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
          event.preventDefault();
          setTab(
            event.key === "Home"
              ? "questions"
              : event.key === "End"
                ? "chat"
                : tab === "chat"
                  ? "questions"
                  : "chat",
          );
          $(tab === "chat" ? "#chatTab" : "#questionsTab").focus();
        }
      };
    $(".settings").onclick = () => action("openSettings");
    $("input").oninput = render;
    root.querySelectorAll("[data-filter]").forEach((button) => {
      button.onclick = () => {
        filter = button.dataset.filter;
        root
          .querySelectorAll("[data-filter]")
          .forEach((node) =>
            node.setAttribute("aria-pressed", String(node === button)),
          );
        render();
      };
    });
    function render() {
      const all = getRecords().filter(
        (q) => source(q.url) === source(streamUrl),
      );
      $(".badge").textContent = all.filter((q) => !q.isRead).length;
      const query = $("input").value.trim().toLocaleLowerCase();
      const shown = all
        .filter(
          (q) =>
            (filter === "all" ||
              (filter === "answered" ? q.isRead : !q.isRead)) &&
            `${q.text} ${q.author || ""}`.toLocaleLowerCase().includes(query),
        )
        .slice()
        .reverse();
      $(".list").replaceChildren();
      if (!shown.length) {
        const empty = document.createElement("div");
        empty.className = "empty";
        empty.textContent = query
          ? "No matching questions. Try another search."
          : "Questions from this stream will appear here. Switch to Live chat to see every message and send your own.";
        $(".list").append(empty);
      }
      for (const q of shown) {
        const card = document.createElement("article");
        card.className = "card";
        const author = document.createElement("p");
        author.className = "author";
        const avatar = document.createElement("span");
        avatar.className = "avatar";
        avatar.textContent = (q.author || "?").slice(0, 2).toUpperCase();
        author.append(
          avatar,
          document.createTextNode(q.author || "Viewer question"),
        );
        const text = document.createElement("p");
        text.className = "text";
        text.textContent = q.text;
        const actions = document.createElement("div");
        actions.className = "actions";
        const toggle = document.createElement("button");
        toggle.textContent = q.isRead ? "✓ Answered" : "✓ Mark answered";
        toggle.className = q.isRead ? "answered" : "";
        toggle.setAttribute(
          "aria-label",
          `${q.isRead ? "Mark unanswered" : "Mark answered"}: ${q.text}`,
        );
        toggle.onclick = () => action("toggle", { id: q.id });
        const tools = document.createElement("div");
        tools.className = "tools";
        const copy = document.createElement("button");
        copy.textContent = "Copy";
        copy.setAttribute("aria-label", `Copy question: ${q.text}`);
        copy.onclick = async () => {
          try {
            await ChatQuestions.copy(q.text);
            notice("Question copied.");
          } catch {
            notice("Could not copy. Try the extension popup.");
          }
        };
        const remove = document.createElement("button");
        remove.textContent = "Remove";
        remove.setAttribute("aria-label", `Delete question: ${q.text}`);
        remove.onclick = () => action("delete", { id: q.id });
        tools.append(copy, remove);
        actions.append(toggle, tools);
        card.append(author, text, actions);
        $(".list").append(card);
      }
    }
    function update() {
      const settings = getSettings();
      host.hidden = !settings.embedded;
      host.style.display = settings.embedded ? "block" : "none";
      if (!settings.embedded)
        document.body.removeAttribute("data-question-queue-tab");
      else setTab(tab);
      host.classList.toggle(
        "dark",
        settings.theme === "dark" ||
          (settings.theme === "system" &&
            matchMedia("(prefers-color-scheme: dark)").matches),
      );
      if (!settings.enabled)
        notice("Detection paused. Your saved questions are still available.");
      else if ($(".notice").textContent.startsWith("Detection paused"))
        notice("");
      render();
    }
    matchMedia("(prefers-color-scheme: dark)").addEventListener(
      "change",
      update,
    );
    update();
    return { update };
  };
})();
