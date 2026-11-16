import { randomBytes, createHash } from "node:crypto";

export async function findPasswordResetUser(prisma, phone) {
  const select = { id: true };
  const exact = await prisma.webUser.findUnique({ where: { phone }, select });
  if (exact) return exact;

  const national = /^(?:0|\+?234)([789]\d{9})$/.exec(phone)?.[1];
  if (!national) return null;

  const matches = await prisma.webUser.findMany({
    where: { phone: { in: [`0${national}`, `234${national}`, `+234${national}`] } },
    select,
    take: 2,
  });
  return matches.length === 1 ? matches[0] : null;
}

export function requestPasswordReset(prisma, webUserId) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "WebUser" WHERE "id" = ${webUserId} FOR UPDATE`;
    const now = new Date();
    const active = await tx.passwordReset.findFirst({
      where: { webUserId, usedAt: null, expiresAt: { gt: now } },
      select: { id: true },
    });
    // Repeating a request must not remove it from the queue or invalidate an approved code.
    if (active) return false;

    await tx.passwordReset.create({
      data: {
        webUserId,
        requestTokenHash: createHash("sha256").update(randomBytes(32)).digest("hex"),
        expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      },
    });
    return true;
  });
}
