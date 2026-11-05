/**
 * 排盘引擎测试。
 *
 * 覆盖：
 * 1. 八字四柱与独立实现 lunar-javascript 对拍一致
 * 2. 时辰未知时降级为三柱
 * 3. 入参校验边界
 * 4. 方法注册表行为
 */
import { describe, expect, it } from 'vitest';
import { Solar } from 'lunar-javascript';
import { runBazi } from '@/lib/chart/bazi';
import { runZiwei } from '@/lib/chart/ziwei';
import { runChart, listMethods } from '@/lib/chart/registry';
import { parseBirthInput } from '@/lib/chart/validate';
import { ChartError } from '@/lib/chart/types';

describe('八字排盘', () => {
  const cases = [
    { birthYear: 1990, birthMonth: 5, birthDay: 15, birthHour: 9, gender: 'male' as const },
    { birthYear: 1984, birthMonth: 2, birthDay: 4, birthHour: 12, gender: 'female' as const },
    { birthYear: 2000, birthMonth: 1, birthDay: 1, birthHour: 0, gender: 'male' as const },
    { birthYear: 1976, birthMonth: 8, birthDay: 8, birthHour: 20, gender: 'female' as const },
    { birthYear: 2024, birthMonth: 2, birthDay: 4, birthHour: 23, gender: 'male' as const },
  ];

  it.each(cases)('四柱与 lunar-javascript 一致', async (input) => {
    const lunar = Solar.fromYmdHms(
      input.birthYear,
      input.birthMonth,
      input.birthDay,
      input.birthHour,
      0,
      0,
    ).getLunar();
    const ec = lunar.getEightChar();
    const expected = [ec.getYear(), ec.getMonth(), ec.getDay(), ec.getTime()].join(' ');

    const result = await runBazi(input);
    const actual = (result.pillars ?? [])
      .map((p) => (p ? p.ganZhi : '--'))
      .join(' ');

    expect(actual).toBe(expected);
  });

  it('时辰未知时只排三柱', async () => {
    const result = await runBazi({
      birthYear: 1990,
      birthMonth: 5,
      birthDay: 15,
      gender: 'male',
    });
    expect(result.text).toContain('出生时辰: 未知');
    // 结构化结果只含三柱
    expect(result.pillars).toHaveLength(3);
    expect((result.pillars ?? []).map((p) => p?.position)).toEqual(['年柱', '月柱', '日柱']);
  });

  it('文本含十神与藏干，结构化数据含纳音', async () => {
    const result = await runBazi({
      birthYear: 1990,
      birthMonth: 5,
      birthDay: 15,
      birthHour: 9,
      gender: 'male',
    });
    // 文本主表含日主与藏干十神
    expect(result.text).toContain('日主');
    expect(result.text).toContain('藏干');
    expect(result.text).toContain('比肩');
    // 纳音在结构化数据中提供
    const pillars = result.pillars ?? [];
    expect(pillars).toHaveLength(4);
    expect(pillars[0]?.naYin).toBeTruthy();
    expect(pillars[0]?.diShi).toBeTruthy();
  });

  it('提供真太阳时校正信息', async () => {
    const result = await runBazi({
      birthYear: 1990,
      birthMonth: 5,
      birthDay: 15,
      birthHour: 9,
      gender: 'male',
      longitude: 121.47,
    });
    expect(result.trueSolarTime).toBeDefined();
    expect(typeof result.trueSolarTime!.correctionMinutes).toBe('number');
  });
});

describe('紫微斗数', () => {
  it('输出十二宫与四化', () => {
    const result = runZiwei({
      birthYear: 1990,
      birthMonth: 5,
      birthDay: 15,
      birthHour: 9,
      gender: 'male',
    });
    expect(result.text).toContain('十二宫位全盘');
    expect(result.text).toContain('命宫');
    expect(result.text).toContain('身主');
  });

  it('缺出生时抛 VALIDATION', () => {
    expect(() =>
      runZiwei({ birthYear: 1990, birthMonth: 5, birthDay: 15, gender: 'male' }),
    ).toThrow(ChartError);
  });
});

describe('入参校验', () => {
  it('年份下界', () => {
    expect(() =>
      parseBirthInput({
        birthYear: 1899,
        birthMonth: 1,
        birthDay: 1,
        birthHour: 1,
        gender: 'male',
      }),
    ).toThrow(ChartError);
  });

  it('年份上界', () => {
    expect(() =>
      parseBirthInput({
        birthYear: 2101,
        birthMonth: 1,
        birthDay: 1,
        birthHour: 1,
        gender: 'male',
      }),
    ).toThrow(ChartError);
  });

  it('时辰未知时忽略分钟', () => {
    const r = parseBirthInput({
      birthYear: 1990,
      birthMonth: 5,
      birthDay: 15,
      birthMinute: 30,
      gender: 'male',
    });
    expect(r.birthHour).toBeUndefined();
    expect(r.birthMinute).toBeUndefined();
  });

  it('性别非法时报错', () => {
    expect(() =>
      parseBirthInput({
        birthYear: 1990,
        birthMonth: 5,
        birthDay: 15,
        birthHour: 1,
        gender: 'x',
      }),
    ).toThrow(ChartError);
  });
});

describe('方法注册表', () => {
  it('列出已注册方法', () => {
    const ids = listMethods().map((m) => m.id);
    expect(ids).toContain('bazi');
    expect(ids).toContain('ziwei');
    expect(ids).toContain('bazi-dayun');
  });

  it('未知方法抛 UNSUPPORTED', async () => {
    await expect(
      runChart('not-exist', {
        birthYear: 1990,
        birthMonth: 5,
        birthDay: 15,
        birthHour: 9,
        gender: 'male',
      }),
    ).rejects.toThrow(ChartError);
  });

  it('可通过注册表执行', async () => {
    const r = await runChart('bazi', {
      birthYear: 1990,
      birthMonth: 5,
      birthDay: 15,
      birthHour: 9,
      gender: 'male',
    });
    expect(r.method).toBe('bazi');
    expect(r.text.length).toBeGreaterThan(0);
  });
});
