import { StageAssistService } from './stage-assist.service';

function createService() {
  return new StageAssistService(
    {
      get: jest.fn().mockReturnValue(undefined),
    } as never,
    {} as never,
  );
}

describe('StageAssistService fallback flow', () => {
  it('uses a neutral transition after repeated unknown source-benefit answers', async () => {
    const service = createService();

    const result = await service.analyzeStage({
      subject: 'thought',
      step: 6,
      answer: 'Не знаю',
      clarificationCount: 2,
      answers: {
        'core:thought:3': 'Я всё потеряю',
        'core:thought:5': 'мама',
      },
    });

    expect(result.decision).toBe('advance');
    expect(result.reaction).toBe(
      'Ничего страшного, если сейчас не получается понять цели или выгоду источника. Это нормально.',
    );
  });

  it('does not split one natural reason into several thoughts by commas', async () => {
    const service = createService();
    const reason =
      'Мне страшно ошибиться, потерять доверие команды и начинать всё заново';

    const result = await service.analyzeStage({
      subject: 'thought',
      step: 4,
      answer: reason,
      clarificationCount: 0,
      answers: {
        'core:thought:3': 'Я всё потеряю',
      },
    });

    expect(result.decision).toBe('advance');
    expect(result.normalizedAnswer).toBe(reason);
  });
});
