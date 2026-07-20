const baseUrl = process.env.SEEE_API_URL || "https://back-production-c25c.up.railway.app/api/v1";
const email = process.env.SEEE_DIAGNOSTIC_EMAIL;
const password = process.env.SEEE_DIAGNOSTIC_PASSWORD;
const username = process.env.SEEE_DIAGNOSTIC_USERNAME || "codex_production_diagnostic";

if (!email || !password) {
  throw new Error(
    "Set SEEE_DIAGNOSTIC_EMAIL and SEEE_DIAGNOSTIC_PASSWORD before running this script",
  );
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.headers || {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const raw = await response.text();
  let payload = null;
  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = raw;
    }
  }
  if (!response.ok) {
    const error = new Error(`${options.method || "GET"} ${path}: ${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

async function authenticate() {
  try {
    return await request("/auth/login", {
      method: "POST",
      body: { email, password },
    });
  } catch (error) {
    if (error.status !== 401) throw error;
    return request("/auth/register", {
      method: "POST",
      body: {
        email,
        password,
        username,
        name: "Codex Production Diagnostic",
      },
    });
  }
}

async function cleanup(token) {
  const nodes = await request("/event-map", { token });
  const roots = nodes.filter((node) => !node.parentId);
  for (const root of roots) {
    await request(`/event-map/${root.id}`, { method: "DELETE", token });
  }

  const sessions = await request("/sessions", { token });
  for (const session of sessions) {
    await request(`/sessions/${session.id}`, { method: "DELETE", token });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const auth = await authenticate();
const token = auth.accessToken;
await request("/auth/subscription/redeem-promo", {
  method: "POST",
  token,
  body: { promoCode: "SEEEFREEE" },
});
await cleanup(token);

if (process.argv.includes("--cleanup-only")) {
  console.log(JSON.stringify({ ok: true, cleaned: true }));
  process.exit(0);
}

if (process.argv.includes("--reasons-fixture")) {
  const situation = await request("/event-map", {
    method: "POST",
    token,
    body: {
      nodeType: "SITUATION",
      title: "Мобильная диагностика",
      description: "Одноразовая визуальная проверка этапа причин",
    },
  });
  const emotion = await request("/event-map", {
    method: "POST",
    token,
    body: {
      nodeType: "EMOTION",
      title: "Интерес",
      emotion: "Интерес",
      parentId: situation.id,
    },
  });
  const session = await request("/sessions", {
    method: "POST",
    token,
    body: { title: "Я хочу проверить мобильный интерфейс" },
  });
  await request(`/event-map`, {
    method: "POST",
    token,
    body: {
      nodeType: "THOUGHT",
      title: "Я хочу проверить мобильный интерфейс",
      idea: "Я хочу проверить мобильный интерфейс",
      parentId: emotion.id,
      sourceSessionId: session.id,
      sourceThoughtScopeId: "mobile-reasons",
    },
  });
  await request(`/sessions/${session.id}`, {
    method: "PATCH",
    token,
    body: {
      sessionKind: "thought",
      dialogStateJson: {
        v: 3,
        subject: "thought",
        coreStep: 4,
        solveStep: 1,
        situationText: "Я хочу проверить мобильный интерфейс",
        importantText: "",
        answers: {},
        activeThoughtScopeId: "mobile-reasons",
        thoughtScopes: {
          "mobile-reasons": {
            "core:thought:1": "Спокойный интерес",
            "core:thought:2": "Интерес помогает внимательно проверять детали",
            "core:thought:3": "Я хочу проверить мобильный интерфейс",
          },
        },
        stageGuidance: {},
        thoughtScopeLinks: {},
      },
    },
  });
  console.log(JSON.stringify({ ok: true, sessionId: session.id }));
  process.exit(0);
}

const before = await request("/auth/me", { token });
const initialBalance = Number(before.balance || 0);

const situation = await request("/event-map", {
  method: "POST",
  token,
  body: {
    nodeType: "SITUATION",
    title: "Диагностика production",
    description: "Изолированная проверка, данные будут удалены",
  },
});
const emotion = await request("/event-map", {
  method: "POST",
  token,
  body: {
    nodeType: "EMOTION",
    title: "Спокойствие",
    emotion: "Спокойствие",
    parentId: situation.id,
  },
});
const session = await request("/sessions", {
  method: "POST",
  token,
  body: { title: "Диагностическая мысль" },
});
const immediateReward = await request("/auth/gamification/reward", {
  method: "POST",
  token,
  body: {
    rewardKey: `answer:${session.id}:scope:diagnostic-scope:core:thought:1`,
    amount: 3,
    rewardKind: "ANSWER",
    sessionId: session.id,
    description: "Production smoke: награда за ответ",
  },
});
assert(
  immediateReward.awarded && immediateReward.delta === 3,
  `Мгновенная награда не начислена: ${JSON.stringify(immediateReward)}`,
);
await request(`/sessions/${session.id}`, {
  method: "PATCH",
  token,
  body: { title: "Диагностическая мысль", sessionKind: "thought" },
});
const thought = await request("/event-map", {
  method: "POST",
  token,
  body: {
    nodeType: "THOUGHT",
    title: "Диагностическая мысль",
    idea: "Диагностическая мысль",
    parentId: emotion.id,
    sourceSessionId: session.id,
    sourceThoughtScopeId: "diagnostic-scope",
  },
});

let parent = thought;
for (let index = 0; index < 24; index += 1) {
  parent = await request("/event-map", {
    method: "POST",
    token,
    body: {
      nodeType: "THOUGHT",
      title: `Глубокая мысль ${index + 1}`,
      idea: `Глубокая мысль ${index + 1}`,
      parentId: parent.id,
    },
  });
}
assert(parent.level === 27, `Ожидался уровень 27, получен ${parent.level}`);

const renamed = await request(`/event-map/${parent.id}`, {
  method: "PATCH",
  token,
  body: { title: "Глубокая мысль отредактирована", idea: "Глубокая мысль отредактирована" },
});
assert(renamed.title === "Глубокая мысль отредактирована", "Редактирование глубокой мысли не сохранилось");

const dialogStateJson = {
  activeThoughtScopeId: "diagnostic-scope",
  completed: true,
  thoughtScopes: {
    "diagnostic-scope": {
      "core:thought:3": "Диагностическая мысль",
      "core:thought:4": "Первая диагностическая причина\nВторая диагностическая причина",
      "core:thought:5": "Источник мысли",
      "core:thought:6": "Личная выгода источника",
      "core:thought:7": "Эмоциональное последствие",
      "core:thought:8": "Практическое последствие",
      "core:thought:9": "Новый диагностический вывод",
    },
  },
};
await request(`/sessions/${session.id}`, {
  method: "PATCH",
  token,
  body: { dialogStateJson },
});
const synced = await request(`/sessions/${session.id}/add-to-map`, {
  method: "POST",
  token,
});
assert(Array.isArray(synced) && synced.length === 2, `Ожидались 2 причины, получено ${synced?.length}`);

const map = await request("/event-map", { token });
const reasonChildren = map.filter((node) => node.parentId === thought.id);
assert(reasonChildren.length >= 3, "Причины не появились рядом с существующей глубокой веткой");
assert(
  reasonChildren.some((node) => node.title === "Первая диагностическая причина") &&
    reasonChildren.some((node) => node.title === "Вторая диагностическая причина"),
  "Тексты причин не сохранились в нейрокарте",
);

const after = await request("/auth/me", { token });
const finalBalance = Number(after.balance || 0);
const balanceDelta = finalBalance - initialBalance;
assert(balanceDelta === 49, `Ожидалось 49 монет, начислено ${balanceDelta}`);

await cleanup(token);

console.log(JSON.stringify({
  ok: true,
  depthChecked: parent.level,
  reasonsCreated: synced.length,
  immediateRewardDelta: immediateReward.delta,
  balanceDelta,
  nodesBeforeCleanup: map.length,
}));
