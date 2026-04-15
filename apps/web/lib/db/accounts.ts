import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "./client";
import { accounts } from "./schema";

type AccountProvider = "github" | "openai-codex";

interface BaseAccountUpsertInput {
  userId: string;
  externalUserId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scope?: string;
  username: string;
  metadata?: Record<string, unknown>;
}

interface BaseAccountRecord {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  username: string;
  externalUserId: string;
  metadata: Record<string, unknown> | null;
}

export interface CodexAccountMetadata extends Record<string, unknown> {
  email?: string;
  chatgptAccountId?: string;
  chatgptPlanType?: string;
  chatgptUserId?: string;
}

export interface CodexAccountRecord extends BaseAccountRecord {
  metadata: CodexAccountMetadata | null;
}

async function upsertAccount(
  provider: AccountProvider,
  data: BaseAccountUpsertInput,
): Promise<string> {
  const existing = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(
      and(eq(accounts.userId, data.userId), eq(accounts.provider, provider)),
    )
    .limit(1);

  if (existing[0]) {
    await db
      .update(accounts)
      .set({
        externalUserId: data.externalUserId,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken ?? null,
        expiresAt: data.expiresAt ?? null,
        scope: data.scope,
        username: data.username,
        metadata: data.metadata,
        updatedAt: new Date(),
      })
      .where(eq(accounts.id, existing[0].id));
    return existing[0].id;
  }

  const id = nanoid();
  const now = new Date();
  await db.insert(accounts).values({
    id,
    userId: data.userId,
    provider,
    externalUserId: data.externalUserId,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    expiresAt: data.expiresAt,
    scope: data.scope,
    username: data.username,
    metadata: data.metadata,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

async function getAccount(
  userId: string,
  provider: AccountProvider,
): Promise<BaseAccountRecord | null> {
  const result = await db
    .select({
      accessToken: accounts.accessToken,
      refreshToken: accounts.refreshToken,
      expiresAt: accounts.expiresAt,
      username: accounts.username,
      externalUserId: accounts.externalUserId,
      metadata: accounts.metadata,
    })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.provider, provider)))
    .limit(1);

  return result[0] ?? null;
}

async function updateAccountTokens(
  userId: string,
  provider: AccountProvider,
  data: {
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await db
    .update(accounts)
    .set({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken ?? null,
      expiresAt: data.expiresAt ?? null,
      ...(data.metadata ? { metadata: data.metadata } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(accounts.userId, userId), eq(accounts.provider, provider)));
}

async function deleteAccount(
  userId: string,
  provider: AccountProvider,
): Promise<void> {
  await db
    .delete(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.provider, provider)));
}

export async function upsertGitHubAccount(
  data: Omit<BaseAccountUpsertInput, "metadata">,
): Promise<string> {
  return upsertAccount("github", data);
}

export async function getGitHubAccount(
  userId: string,
): Promise<BaseAccountRecord | null> {
  return getAccount(userId, "github");
}

export async function updateGitHubAccountTokens(
  userId: string,
  data: {
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
  },
): Promise<void> {
  return updateAccountTokens(userId, "github", data);
}

export async function deleteGitHubAccount(userId: string): Promise<void> {
  return deleteAccount(userId, "github");
}

export async function upsertCodexAccount(
  data: BaseAccountUpsertInput & {
    metadata?: CodexAccountMetadata;
  },
): Promise<string> {
  return upsertAccount("openai-codex", data);
}

export async function getCodexAccount(
  userId: string,
): Promise<CodexAccountRecord | null> {
  const account = await getAccount(userId, "openai-codex");
  if (!account) {
    return null;
  }

  return {
    ...account,
    metadata: (account.metadata as CodexAccountMetadata | null) ?? null,
  };
}

export async function updateCodexAccountTokens(
  userId: string,
  data: {
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
    metadata?: CodexAccountMetadata;
  },
): Promise<void> {
  return updateAccountTokens(userId, "openai-codex", data);
}

export async function deleteCodexAccount(userId: string): Promise<void> {
  return deleteAccount(userId, "openai-codex");
}
