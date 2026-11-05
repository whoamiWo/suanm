/**
 * lunar-javascript 的最小类型声明。
 *
 * 该库未提供官方类型；此处只声明本项目实际使用的 API 面（用于交叉验证排盘结果）。
 */
declare module 'lunar-javascript' {
  export interface EightChar {
    getYear(): string;
    getMonth(): string;
    getDay(): string;
    getTime(): string;
  }

  export class Lunar {
    getEightChar(): EightChar;
  }

  export class Solar {
    static fromYmdHms(
      year: number,
      month: number,
      day: number,
      hour: number,
      minute: number,
      second: number,
    ): Solar;
    getLunar(): Lunar;
  }
}
