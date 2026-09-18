import { prisma } from '../db.js';

export class NoHouseholdError extends Error {}

export async function getPrimaryHouseholdId(userId: string): Promise<string> {
  const membership = await prisma.householdMember.findFirst({
    where: { userId },
    orderBy: { joinedAt: 'asc' },
  });
  if (!membership) throw new NoHouseholdError();
  return membership.householdId;
}
