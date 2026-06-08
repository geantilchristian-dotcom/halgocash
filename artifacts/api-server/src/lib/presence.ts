const presenceMap = new Map<string, { name: string; lastSeen: Date }>();

export function updatePresence(clerkId: string, name: string): void {
  presenceMap.set(clerkId, { name: name.slice(0, 80), lastSeen: new Date() });
}

export function getOnlineUsers(maxAgeMs = 5 * 60 * 1000): Array<{ clerkId: string; name: string; lastSeen: string }> {
  const threshold = new Date(Date.now() - maxAgeMs);
  const result: Array<{ clerkId: string; name: string; lastSeen: string }> = [];
  for (const [clerkId, data] of presenceMap) {
    if (data.lastSeen >= threshold) {
      result.push({ clerkId, name: data.name, lastSeen: data.lastSeen.toISOString() });
    }
  }
  return result.sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
}
