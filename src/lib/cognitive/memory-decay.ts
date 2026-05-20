export interface DecayableMemory {
  id: string;
  importance: number;
  confidence: number;
  accessCount: number;
  decayRate: number;
  createdAt: Date;
  lastAccessedAt: Date | null;
}

const EBINGHAUS_BASE_RETENTION = 0.85;
const ACCESS_BOOST = 0.05;
const MIN_CONFIDENCE = 0.1;
const DECAY_THRESHOLD = 0.15;

export function calculateDecayedConfidence(memory: DecayableMemory, now: Date = new Date()): number {
  const createdAt = new Date(memory.createdAt).getTime();
  const lastAccessedAt = memory.lastAccessedAt
    ? new Date(memory.lastAccessedAt).getTime()
    : createdAt;
  const nowMs = now.getTime();

  const daysSinceLastAccess = Math.max(0, (nowMs - lastAccessedAt) / (1000 * 60 * 60 * 24));
  const totalDaysSinceCreation = Math.max(0.1, (nowMs - createdAt) / (1000 * 60 * 60 * 24));

  const decayFactor = Math.exp(-memory.decayRate * daysSinceLastAccess);

  const accessBoost = Math.min(memory.accessCount * ACCESS_BOOST, 0.3);

  const importanceMultiplier = 0.5 + (memory.importance * 0.5);

  const baseRetention = EBINGHAUS_BASE_RETENTION ** (totalDaysSinceCreation / 7);

  const decayed = baseRetention * decayFactor * importanceMultiplier + accessBoost;

  return Math.max(MIN_CONFIDENCE, Math.min(1.0, decayed));
}

export function shouldPrune(memory: DecayableMemory, now?: Date): boolean {
  const confidence = calculateDecayedConfidence(memory, now);
  return confidence <= DECAY_THRESHOLD;
}

export function getDecayBatch(memories: DecayableMemory[], now?: Date): {
  toUpdate: Array<{ id: string; newConfidence: number }>;
  toPrune: string[];
} {
  const toUpdate: Array<{ id: string; newConfidence: number }> = [];
  const toPrune: string[] = [];

  for (const memory of memories) {
    const newConfidence = calculateDecayedConfidence(memory, now);
    if (newConfidence <= DECAY_THRESHOLD) {
      toPrune.push(memory.id);
    } else if (Math.abs(newConfidence - memory.confidence) > 0.01) {
      toUpdate.push({ id: memory.id, newConfidence });
    }
  }

  return { toUpdate, toPrune };
}
