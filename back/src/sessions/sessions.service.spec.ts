import { SessionsService } from './sessions.service';

describe('SessionsService map and reward helpers', () => {
  const service = new SessionsService({} as never);

  const callPrivate = <T>(method: string, ...args: unknown[]): T => {
    const target = service as unknown as Record<
      string,
      (...values: unknown[]) => T
    >;
    return target[method](...args);
  };

  it('collects root and scoped answers with the same keys used by the client', () => {
    const answers = callPrivate<
      Array<{ rewardKeyPart: string; value: string }>
    >('collectRewardableAnswers', {
      answers: {
        'core:situation:1': 'Ситуация',
        'core:situation:2': '—',
      },
      thoughtScopes: {
        'scope-1': {
          'core:thought:3': 'Я не справлюсь',
          'core:thought:4': 'Потому что я устал',
        },
      },
    });

    expect(answers).toEqual([
      {
        rewardKeyPart: 'core:situation:1',
        value: 'Ситуация',
      },
      {
        rewardKeyPart: 'scope:scope-1:core:thought:3',
        value: 'Я не справлюсь',
      },
      {
        rewardKeyPart: 'scope:scope-1:core:thought:4',
        value: 'Потому что я устал',
      },
    ]);
  });

  it('does not award skipped, unknown, or test answers', () => {
    const answers = callPrivate<
      Array<{ rewardKeyPart: string; value: string }>
    >('collectRewardableAnswers', {
      answers: {
        'core:situation:1': 'Не знаю',
        'core:situation:2': '—',
        'core:situation:3': 'тест',
        'core:situation:4': 'Мне важно чувствовать опору',
      },
    });

    expect(answers).toEqual([
      {
        rewardKeyPart: 'core:situation:4',
        value: 'Мне важно чувствовать опору',
      },
    ]);
  });

  it('recognizes completion inside any thought scope', () => {
    const completed = callPrivate<boolean>('hasCompletionAnswer', {
      answers: {},
      thoughtScopes: {
        'scope-17': {
          'core:thought:9': 'Теперь я вижу эту мысль иначе',
        },
      },
    });

    expect(completed).toBe(true);
  });

  it('awards all new answers and completion in one atomic balance update', async () => {
    const tx = {
      balance: {
        upsert: jest.fn().mockResolvedValue({ amount: 0 }),
        update: jest.fn().mockResolvedValue({ amount: 31 }),
      },
      gamificationReward: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }),
        createMany: jest
          .fn()
          .mockResolvedValueOnce({ count: 2 })
          .mockResolvedValueOnce({ count: 1 }),
      },
      transaction: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const rewardingService = new SessionsService(prisma as never);
    const target = rewardingService as unknown as {
      syncGamificationRewardsForState: (
        userId: string,
        sessionId: string,
        state: unknown,
      ) => Promise<void>;
    };

    await target.syncGamificationRewardsForState('user', 'session', {
      answers: {
        'core:situation:1': 'Разговор с мамой',
        'core:situation:9': 'Теперь я вижу ситуацию иначе',
      },
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.gamificationReward.createMany).toHaveBeenCalledTimes(2);
    expect(tx.balance.update).toHaveBeenLastCalledWith({
      where: { userId: 'user' },
      data: { amount: { increment: 31 } },
    });
    expect(tx.transaction.create).toHaveBeenCalledTimes(2);
  });

  it('maps reasons only to the matching thought scope', () => {
    const entries = callPrivate<
      Array<{
        reason: string;
        linkedScopeId: string | null;
        displayOrder: number;
      }>
    >(
      'getReasonEntriesForNode',
      {
        thoughtScopes: {
          owner: {
            'core:thought:3': 'Я не справлюсь',
            'core:thought:4': 'Я устал\nМне не хватает поддержки',
          },
          child: {
            'core:thought:3': 'Я устал',
          },
          unrelated: {
            'core:thought:3': 'Другая мысль',
            'core:thought:4': 'Не должна попасть в эту ветку',
          },
        },
        thoughtScopeLinks: {
          child: {
            parentSubject: 'thought',
            parentScopeId: 'owner',
            parentReason: 'Я устал',
          },
        },
      },
      {
        title: 'Я не справлюсь',
        sourceThoughtScopeId: 'owner',
      },
    );

    expect(entries).toEqual([
      {
        reason: 'Я устал',
        linkedScopeId: 'child',
        displayOrder: 0,
      },
      {
        reason: 'Мне не хватает поддержки',
        linkedScopeId: null,
        displayOrder: 1,
      },
    ]);
  });

  it('persists every important reason one level below its thought', async () => {
    const ownerNode = {
      id: 'owner-node',
      userId: 'user',
      nodeType: 'THOUGHT',
      title: 'Я не справлюсь',
      idea: 'Я не справлюсь',
      parentId: 'emotion-node',
      level: 16,
      displayOrder: 0,
      sourceSessionId: 'session',
      sourceThoughtScopeId: 'owner-scope',
      isMuted: false,
      isCompleted: false,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    const createdNodes: Array<Record<string, unknown>> = [];
    const prisma = {
      session: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'session',
          userId: 'user',
          title: 'Я не справлюсь',
          dialogStateJson: {
            thoughtScopes: {
              'owner-scope': {
                'core:thought:3': 'Я не справлюсь',
                'core:thought:4':
                  'Потому что я устал\nМне не хватает поддержки',
              },
            },
            thoughtScopeLinks: {},
          },
          messages: [],
          conceptHierarchies: [],
        }),
        create: jest
          .fn()
          .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
            Promise.resolve({
              id: `child-session-${String(data.title)}`,
              ...data,
            }),
          ),
      },
      eventMap: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([ownerNode])
          .mockResolvedValueOnce([]),
        update: jest.fn(),
        create: jest
          .fn()
          .mockImplementation(({ data }: { data: Record<string, unknown> }) => {
            const created = {
              id: `node-${createdNodes.length + 1}`,
              isCompleted: false,
              createdAt: new Date('2026-01-01T00:00:00.000Z'),
              updatedAt: new Date('2026-01-01T00:00:00.000Z'),
              ...data,
            };
            createdNodes.push(created);
            return Promise.resolve(created);
          }),
      },
    };
    const mapService = new SessionsService(prisma as never);

    await mapService.addSessionToMap('session', 'user');

    expect(createdNodes).toHaveLength(2);
    expect(createdNodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Потому что я устал',
          parentId: 'owner-node',
          level: 17,
        }),
        expect.objectContaining({
          title: 'Мне не хватает поддержки',
          parentId: 'owner-node',
          level: 17,
        }),
      ]),
    );
  });
});
