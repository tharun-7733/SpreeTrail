type FetchOptions = Omit<RequestInit, "body"> & { body?: any };

async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { body, ...rest } = options;
  const res = await fetch(path, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(rest.headers || {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export const api = {
  // Auth
  auth: {
    register: (data: { email: string; name: string; password: string }) =>
      apiFetch("/api/auth/register", { method: "POST", body: data }),
    login: (data: { email: string; password: string }) =>
      apiFetch("/api/auth/login", { method: "POST", body: data }),
    me: () => apiFetch("/api/auth/me"),
    logout: () => apiFetch("/api/auth/logout", { method: "POST" }),
  },

  // Groups
  groups: {
    list: () => apiFetch("/api/groups"),
    create: (data: { name: string; description?: string }) =>
      apiFetch("/api/groups", { method: "POST", body: data }),
    get: (groupId: string) => apiFetch(`/api/groups/${groupId}`),
    update: (groupId: string, data: { name?: string; description?: string }) =>
      apiFetch(`/api/groups/${groupId}`, { method: "PATCH", body: data }),
    delete: (groupId: string) =>
      apiFetch(`/api/groups/${groupId}`, { method: "DELETE" }),
  },

  // Members
  members: {
    list: (groupId: string) => apiFetch(`/api/groups/${groupId}/members`),
    add: (groupId: string, data: { email: string }) =>
      apiFetch(`/api/groups/${groupId}/members`, { method: "POST", body: data }),
    remove: (groupId: string, userId: string) =>
      apiFetch(`/api/groups/${groupId}/members/${userId}`, { method: "DELETE" }),
  },

  // Expenses
  expenses: {
    list: (groupId: string) => apiFetch(`/api/groups/${groupId}/expenses`),
    create: (groupId: string, data: any) =>
      apiFetch(`/api/groups/${groupId}/expenses`, { method: "POST", body: data }),
    get: (groupId: string, expenseId: string) =>
      apiFetch(`/api/groups/${groupId}/expenses/${expenseId}`),
    getById: (expenseId: string) =>
      apiFetch(`/api/expenses/${expenseId}`),
    update: (groupId: string, expenseId: string, data: any) =>
      apiFetch(`/api/groups/${groupId}/expenses/${expenseId}`, { method: "PATCH", body: data }),
    delete: (groupId: string, expenseId: string) =>
      apiFetch(`/api/groups/${groupId}/expenses/${expenseId}`, { method: "DELETE" }),
  },

  // Balances
  balances: {
    get: (groupId: string) => apiFetch(`/api/groups/${groupId}/balances`),
  },

  // Settlements
  settlements: {
    list: (groupId: string) => apiFetch(`/api/groups/${groupId}/settlements`),
    create: (groupId: string, data: { payerId: string; receiverId: string; amount: number; note?: string }) =>
      apiFetch(`/api/groups/${groupId}/settlements`, { method: "POST", body: data }),
    delete: (groupId: string, settlementId: string) =>
      apiFetch(`/api/groups/${groupId}/settlements/${settlementId}`, { method: "DELETE" }),
  },

  // Comments
  comments: {
    list: (groupId: string, expenseId: string) =>
      apiFetch(`/api/groups/${groupId}/expenses/${expenseId}/comments`),
    create: (groupId: string, expenseId: string, data: { content: string }) =>
      apiFetch(`/api/groups/${groupId}/expenses/${expenseId}/comments`, { method: "POST", body: data }),
  },
};
