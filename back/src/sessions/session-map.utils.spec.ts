import { normalizeMapText, parseImportantOptions } from './session-map.utils';

describe('session map utilities', () => {
  describe('parseImportantOptions', () => {
    it('keeps a natural sentence with commas and conjunctions as one thought', () => {
      expect(
        parseImportantOptions(
          'Я устану, потеряю концентрацию и не закончу задачу вовремя',
        ),
      ).toEqual([
        'Я устану, потеряю концентрацию и не закончу задачу вовремя',
      ]);
    });

    it('splits explicit lines, bullets, numbered items and semicolons', () => {
      expect(
        parseImportantOptions(
          '1. Я устану\n2) Не успею закончить; • Подведу команду',
        ),
      ).toEqual(['Я устану', 'Не успею закончить', 'Подведу команду']);
    });

    it('deduplicates options without changing the first spelling', () => {
      expect(
        parseImportantOptions('Тревога\nтревога\nТРЕВОГА; Спешка'),
      ).toEqual(['Тревога', 'Спешка']);
    });
  });

  describe('normalizeMapText', () => {
    it('normalizes ё, punctuation and whitespace', () => {
      expect(normalizeMapText('  Всё — плохо!  ')).toBe('все плохо');
    });
  });
});
