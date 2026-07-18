import { BadRequestException } from '@nestjs/common';
import { EventMapService } from './event-map.service';

function makeNode(overrides: Record<string, unknown> = {}) {
  const now = new Date('2026-07-18T12:00:00.000Z');
  return {
    id: 'node',
    userId: 'user',
    eventNumber: null,
    event: null,
    emotion: null,
    idea: null,
    rootBelief: null,
    isCompleted: false,
    nodeType: 'THOUGHT',
    title: 'Мысль',
    description: null,
    parentId: 'parent',
    level: 3,
    displayOrder: 0,
    sourceSessionId: null,
    sourceThoughtScopeId: null,
    isMuted: false,
    metaJson: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createPrismaMock() {
  return {
    eventMap: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    session: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };
}

describe('EventMapService', () => {
  it('rejects a thought without an emotion or parent thought', async () => {
    const prisma = createPrismaMock();
    const service = new EventMapService(prisma as any);

    await expect(
      service.create('user', {
        nodeType: 'THOUGHT',
        title: 'Оторванная мысль',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.eventMap.create).not.toHaveBeenCalled();
  });

  it('supports an arbitrarily deep thought branch and derives its level', async () => {
    const prisma = createPrismaMock();
    const parent = makeNode({
      id: 'parent',
      nodeType: 'THOUGHT',
      level: 347,
    });
    prisma.eventMap.findFirst.mockImplementation(({ where, orderBy }: any) => {
      if (where?.id === 'parent') return parent;
      if (orderBy?.displayOrder) return { displayOrder: 8 };
      return null;
    });
    prisma.eventMap.findMany.mockResolvedValue([]);
    prisma.eventMap.create.mockImplementation(({ data }: any) =>
      makeNode({ id: 'child', ...data }),
    );
    const service = new EventMapService(prisma as any);

    const result = await service.create('user', {
      nodeType: 'THOUGHT',
      title: 'Следующая мысль',
      parentId: 'parent',
    });

    expect(result.level).toBe(348);
    expect(result.parentId).toBe('parent');
    expect(result.displayOrder).toBe(9);
  });

  it('returns the existing sibling instead of creating a duplicate', async () => {
    const prisma = createPrismaMock();
    const parent = makeNode({
      id: 'emotion',
      nodeType: 'EMOTION',
      level: 2,
    });
    const existing = makeNode({
      id: 'existing',
      parentId: 'emotion',
      title: 'Я всё потеряю',
    });
    prisma.eventMap.findFirst.mockResolvedValue(parent);
    prisma.eventMap.findMany.mockResolvedValue([existing]);
    prisma.eventMap.update.mockResolvedValue(existing);
    const service = new EventMapService(prisma as any);

    const result = await service.create('user', {
      nodeType: 'THOUGHT',
      title: '  я всё потеряю! ',
      parentId: 'emotion',
    });

    expect(result.id).toBe('existing');
    expect(prisma.eventMap.update).toHaveBeenCalledWith({
      where: { id: 'existing' },
      data: {},
    });
    expect(prisma.eventMap.create).not.toHaveBeenCalled();
  });

  it('allows separate root situations with the same title', async () => {
    const prisma = createPrismaMock();
    prisma.eventMap.findFirst.mockResolvedValue(null);
    prisma.eventMap.create
      .mockImplementationOnce(({ data }: any) =>
        makeNode({
          id: 'situation-1',
          ...data,
          nodeType: 'SITUATION',
          parentId: null,
        }),
      )
      .mockImplementationOnce(({ data }: any) =>
        makeNode({
          id: 'situation-2',
          ...data,
          nodeType: 'SITUATION',
          parentId: null,
        }),
      );
    const service = new EventMapService(prisma as any);

    const first = await service.create('user', {
      nodeType: 'SITUATION',
      title: 'Разговор с мамой',
    });
    const second = await service.create('user', {
      nodeType: 'SITUATION',
      title: 'Разговор с мамой',
    });

    expect(first.id).toBe('situation-1');
    expect(second.id).toBe('situation-2');
    expect(prisma.eventMap.create).toHaveBeenCalledTimes(2);
    expect(prisma.eventMap.findMany).not.toHaveBeenCalled();
  });

  it('deletes the selected branch without touching neighboring roots', async () => {
    const prisma = createPrismaMock();
    prisma.eventMap.findFirst.mockResolvedValue({ id: 'situation-a' });
    prisma.eventMap.findMany.mockResolvedValue([
      { id: 'situation-a', parentId: null },
      { id: 'emotion-a', parentId: 'situation-a' },
      { id: 'thought-a', parentId: 'emotion-a' },
      { id: 'thought-a-2', parentId: 'thought-a' },
      { id: 'situation-b', parentId: null },
      { id: 'emotion-b', parentId: 'situation-b' },
    ]);
    const service = new EventMapService(prisma as any);

    await service.delete('situation-a', 'user');

    expect(prisma.eventMap.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: 'user',
        id: {
          in: expect.arrayContaining([
            'situation-a',
            'emotion-a',
            'thought-a',
            'thought-a-2',
          ]),
        },
      },
    });
    const ids =
      prisma.eventMap.deleteMany.mock.calls[0][0].where.id.in as string[];
    expect(ids).not.toContain('situation-b');
    expect(ids).not.toContain('emotion-b');
  });
});
