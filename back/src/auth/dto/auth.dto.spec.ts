import { validate } from 'class-validator';
import { ClaimGamificationRewardDto } from './auth.dto';

describe('ClaimGamificationRewardDto', () => {
  it('accepts the amount sent by the session reward client', async () => {
    const dto = Object.assign(new ClaimGamificationRewardDto(), {
      rewardKey: 'answer:session-id:core:thought:1',
      amount: 3,
      rewardKind: 'ANSWER',
      sessionId: 'session-id',
    });

    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(errors).toEqual([]);
  });

  it('rejects a non-positive amount', async () => {
    const dto = Object.assign(new ClaimGamificationRewardDto(), {
      rewardKey: 'answer:session-id:core:thought:1',
      amount: 0,
    });

    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(errors.some((error) => error.property === 'amount')).toBe(true);
  });
});
