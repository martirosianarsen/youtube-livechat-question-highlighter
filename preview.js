(() => {
  const { KEY, THEME, SETTINGS, settingsFrom } = ChatQuestions,
    storage = "livechat-questions-design-preview";
  const initial = [
    {
      id: "1",
      author: "Anna M.",
      text: "Can you share the resources from today’s stream?",
      timestamp: Date.now() - 420000,
      isRead: true,
      url: "https://www.youtube.com/watch?v=demo",
    },
    {
      id: "2",
      author: "David K.",
      text: "What would you recommend for someone just getting started?",
      timestamp: Date.now() - 210000,
      isRead: false,
      url: "https://www.youtube.com/watch?v=demo",
    },
    {
      id: "3",
      author: "Lilit",
      text: "Հնարավո՞ր է սա օգտագործել նաև հայերեն հարցերի համար։",
      timestamp: Date.now() - 110000,
      isRead: false,
      url: "https://www.youtube.com/watch?v=demo",
    },
    {
      id: "4",
      author: "Aram",
      text: "How do you keep track of questions during a busy live stream?",
      timestamp: Date.now() - 40000,
      isRead: false,
      url: "https://www.youtube.com/watch?v=demo",
    },
  ];
  if (!localStorage.getItem(storage))
    localStorage.setItem(
      storage,
      JSON.stringify({ [KEY]: initial, [THEME]: "light" }),
    );
  const read = () => JSON.parse(localStorage.getItem(storage)),
    listeners = [];
  const notify = () => {
    const data = read();
    listeners.forEach((fn) =>
      fn(
        {
          [KEY]: { newValue: data[KEY] },
          [THEME]: { newValue: data[THEME] },
          [SETTINGS]: { newValue: settingsFrom(data[SETTINGS], data[THEME]) },
        },
        "local",
      ),
    );
  };
  const save = (data) => {
    localStorage.setItem(storage, JSON.stringify(data));
    notify();
  };
  window.addEventListener("storage", notify);
  window.chrome = {
    storage: {
      local: {
        async get() {
          return read();
        },
        async set(value) {
          save({ ...read(), ...value });
        },
      },
      onChanged: {
        addListener(fn) {
          listeners.push(fn);
        },
      },
    },
    runtime: {
      async openOptionsPage() {
        window.open("preview-settings.html", "_blank");
      },
      async sendMessage(message) {
        const data = read();
        let settings = settingsFrom(data[SETTINGS], data[THEME]);
        if (message.action === "openSettings") {
          window.open("preview-settings.html", "_blank");
          return { ok: true };
        }
        let list = data[KEY] || [];
        if (message.action === "settings") {
          settings = settingsFrom(message.settings);
          data[SETTINGS] = settings;
          if (settings.maxQuestions) list = list.slice(-settings.maxQuestions);
        }
        if (message.action === "toggle")
          list = list.map((q) =>
            q.id === message.id ? { ...q, isRead: !q.isRead } : q,
          );
        if (message.action === "delete")
          list = list.filter((q) => q.id !== message.id);
        if (message.action === "clear") list = [];
        if (message.action !== "get") save({ ...data, [KEY]: list });
        return { ok: true, questions: list, settings };
      },
    },
  };
})();
