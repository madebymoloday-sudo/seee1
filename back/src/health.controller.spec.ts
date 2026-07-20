import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('reports that the API is running', () => {
    const result = new HealthController().check();

    expect(result.status).toBe('ok');
    expect(Number.isNaN(Date.parse(result.timestamp))).toBe(false);
  });
});
