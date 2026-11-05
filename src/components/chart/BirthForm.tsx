'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { METHODS } from '@/lib/chart/methods-meta';

/**
 * 出生信息表单。
 *
 * 表单状态同步到 URL query，使排盘结果页可被搜索引擎索引与分享。
 * 支持命理类（需要出生时间）与占卜类（不需要出生时间）两种模式。
 */

export interface BirthFormProps {
  defaultMethod?: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const TIMEZONES = [
  { value: 'Asia/Shanghai', label: '东八区（北京/上海）' },
  { value: 'Asia/Hong_Kong', label: '东八区（香港）' },
  { value: 'Asia/Taipei', label: '东八区（台北）' },
  { value: 'Asia/Tokyo', label: '东九区（东京）' },
  { value: 'Asia/Singapore', label: '东八区（新加坡）' },
];

// 方法分组：命理类 vs 占卜类
const DIVINATION_METHODS = METHODS.filter((m) => !m.requiresBirth);

export function BirthForm({ defaultMethod = 'bazi' }: BirthFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [method, setMethod] = useState(
    searchParams.get('method') ?? defaultMethod,
  );
  const isDivination = DIVINATION_METHODS.some((m) => m.id === method);

  // 出生日期字段（仅命理类需要）
  const [year, setYear] = useState(searchParams.get('y') ?? '1990');
  const [month, setMonth] = useState(searchParams.get('m') ?? '5');
  const [day, setDay] = useState(searchParams.get('d') ?? '15');
  const [hour, setHour] = useState(searchParams.get('h') ?? '9');
  const [minute, setMinute] = useState(searchParams.get('min') ?? '0');
  const [gender, setGender] = useState(searchParams.get('g') ?? 'male');
  const [unknownHour, setUnknownHour] = useState(searchParams.get('uh') === '1');

  // 历法与校正字段
  const [calendarType, setCalendarType] = useState(
    searchParams.get('ct') ?? 'solar',
  );
  const [isLeapMonth, setIsLeapMonth] = useState(searchParams.get('leap') === '1');
  const [birthPlace, setBirthPlace] = useState(searchParams.get('bp') ?? '');
  const [timezone, setTimezone] = useState(searchParams.get('tz') ?? 'Asia/Shanghai');
  const [dayBoundary, setDayBoundary] = useState(searchParams.get('db') ?? 'midnight');
  const [disambiguation, setDisambiguation] = useState(
    searchParams.get('dis') ?? 'compatible',
  );

  // 真太阳时校正
  const [useTrueSolar, setUseTrueSolar] = useState(searchParams.get('ts') === '1');
  const [longitude, setLongitude] = useState(searchParams.get('lon') ?? '');

  useEffect(() => {
    // 方法切换后重置占卜标志
    setUnknownHour(false);
  }, [method]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    params.set('method', method);
    params.set('ct', calendarType);
    params.set('leap', isLeapMonth ? '1' : '0');
    params.set('bp', birthPlace);
    params.set('tz', timezone);
    params.set('db', dayBoundary);
    params.set('dis', disambiguation);

    // 占卜类方法：不需要出生时间，直接跳转
    if (isDivination) {
      router.push(`/paipan/${method}?${params.toString()}`);
      return;
    }

    // 命理类：需要出生年月日
    if (!year || !month || !day) return;
    params.set('y', year);
    params.set('m', month);
    params.set('d', day);
    params.set('g', gender);

    if (unknownHour) {
      params.set('uh', '1');
    } else {
      params.set('h', hour);
      params.set('min', minute);
    }

    if (useTrueSolar && longitude) {
      params.set('ts', '1');
      params.set('lon', longitude);
    }

    router.push(`/paipan/${method}?${params.toString()}`);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm"
    >
      <div className="mb-5">
        <label className="mb-1.5 block text-sm font-medium text-neutral-700">
          排盘类型
        </label>
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
        >
          {METHODS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      {/* 占卜类方法：问事表单 */}
      {isDivination && (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                出生年份（用于本命与行年）
              </label>
              <input
                type="number"
                min={1900}
                max={2100}
                value={year}
                onChange={(e) => setYear(e.target.value)}
                required
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                性别
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
              >
                <option value="male">男</option>
                <option value="female">女</option>
              </select>
            </div>
          </div>
          <div className="mb-5 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                问事月份
              </label>
              <input
                type="number"
                min={1}
                max={12}
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                required
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                问事日期
              </label>
              <input
                type="number"
                min={1}
                max={31}
                value={day}
                onChange={(e) => setDay(e.target.value)}
                required
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
              />
            </div>
          </div>
          <div className="mb-5 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                问事时辰
              </label>
              <select
                value={hour}
                onChange={(e) => setHour(e.target.value)}
                disabled={unknownHour}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm disabled:bg-neutral-100 disabled:text-neutral-400 focus:border-neutral-900 focus:outline-none"
              >
                {HOURS.map((h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, '0')} 时
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                分钟
              </label>
              <select
                value={minute}
                onChange={(e) => setMinute(e.target.value)}
                disabled={unknownHour}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm disabled:bg-neutral-100 disabled:text-neutral-400 focus:border-neutral-900 focus:outline-none"
              >
                {MINUTES.map((m) => (
                  <option key={m} value={m}>
                    {String(m).padStart(2, '0')} 分
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mb-5">
            <div className="flex items-center gap-2 text-sm text-neutral-700">
              <label className="text-sm font-medium text-neutral-700 mb-1.5 block">
                时辰未知
              </label>
              <input
                type="checkbox"
                checked={unknownHour}
                onChange={(e) => setUnknownHour(e.target.checked)}
                className="h-4 w-4 rounded border-neutral-300"
              />
            </div>
          </div>

          <div className="mb-5 border-t border-neutral-200 pt-4">
            <div className="flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={useTrueSolar}
                onChange={(e) => setUseTrueSolar(e.target.checked)}
                className="h-4 w-4 rounded border-neutral-300"
              />
              <label className="text-sm font-medium text-neutral-700">
                使用真太阳时校正
              </label>
            </div>
          </div>

          {useTrueSolar && (
            <div className="mb-5">
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                出生地经度（东经为正，如北京 116.4）
              </label>
              <input
                type="number"
                step="0.1"
                min={-180}
                max={180}
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                placeholder="116.4"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
              />
            </div>
          )}
        </>
      )}

      {/* 命理类方法：完整出生信息表单 */}
      {!isDivination && (
        <>
          <div className="mb-5 grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                年
              </label>
              <input
                type="number"
                min={1900}
                max={2100}
                value={year}
                onChange={(e) => setYear(e.target.value)}
                required
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                月
              </label>
              <input
                type="number"
                min={1}
                max={12}
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                required
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                日
              </label>
              <input
                type="number"
                min={1}
                max={31}
                value={day}
                onChange={(e) => setDay(e.target.value)}
                required
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
              />
            </div>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                时辰
              </label>
              <select
                value={hour}
                onChange={(e) => setHour(e.target.value)}
                disabled={unknownHour}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm disabled:bg-neutral-100 disabled:text-neutral-400 focus:border-neutral-900 focus:outline-none"
              >
                {HOURS.map((h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, '0')} 时
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                分钟
              </label>
              <select
                value={minute}
                onChange={(e) => setMinute(e.target.value)}
                disabled={unknownHour}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm disabled:bg-neutral-100 disabled:text-neutral-400 focus:border-neutral-900 focus:outline-none"
              >
                {MINUTES.map((m) => (
                  <option key={m} value={m}>
                    {String(m).padStart(2, '0')} 分
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                性别
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
              >
                <option value="male">男</option>
                <option value="female">女</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                历法类型
              </label>
              <select
                value={calendarType}
                onChange={(e) => setCalendarType(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
              >
                <option value="solar">公历</option>
                <option value="lunar">农历</option>
              </select>
            </div>
          </div>

          {calendarType === 'lunar' && (
            <div className="mb-5">
              <div className="flex items-center gap-2 text-sm text-neutral-700">
                <label className="text-sm font-medium text-neutral-700 mb-1.5 block">
                  闰月
                </label>
                <input
                  type="checkbox"
                  checked={isLeapMonth}
                  onChange={(e) => setIsLeapMonth(e.target.checked)}
                  className="h-4 w-4 rounded border-neutral-300"
                />
              </div>
            </div>
          )}

          <div className="mb-5">
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              日界口径
            </label>
            <select
              value={dayBoundary}
              onChange={(e) => setDayBoundary(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
            >
              <option value="midnight">午夜换日</option>
              <option value="zi">子时（23点）换日</option>
            </select>
          </div>

          <div className="mb-5">
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              歧义消解策略
            </label>
            <select
              value={disambiguation}
              onChange={(e) => setDisambiguation(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
            >
              <option value="compatible">兼容模式</option>
              <option value="reject">拒绝</option>
              <option value="earlier">取更早</option>
              <option value="later">取更晚</option>
            </select>
          </div>

          <div className="mb-5">
            <div className="flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={unknownHour}
                onChange={(e) => setUnknownHour(e.target.checked)}
                className="h-4 w-4 rounded border-neutral-300"
              />
              <label className="text-sm font-medium text-neutral-700">
                不知道出生时辰（只排年月日三柱）
              </label>
            </div>
          </div>

          <div className="mb-5">
            <div className="flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={useTrueSolar}
                onChange={(e) => setUseTrueSolar(e.target.checked)}
                className="h-4 w-4 rounded border-neutral-300"
              />
              <label className="text-sm font-medium text-neutral-700">
                使用真太阳时校正
              </label>
            </div>
          </div>

          {useTrueSolar && (
            <div className="mb-5">
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                出生地经度（东经为正，如北京 116.4）
              </label>
              <input
                type="number"
                step="0.1"
                min={-180}
                max={180}
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                placeholder="116.4"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
              />
              <p className="mt-1.5 text-xs text-neutral-500">
                提供经度后将按经度差与均时差校正钟表时间，可能影响时柱判断
              </p>
            </div>
          )}

          <div className="mb-5">
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              出生地（用于经度推算与真太阳时校正）
            </label>
            <input
              type="text"
              value={birthPlace}
              onChange={(e) => setBirthPlace(e.target.value)}
              placeholder="如：北京"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
            />
          </div>

          <div className="mb-5">
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              时区
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      <button
        type="submit"
        className="w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white transition:hover:hover:bg-neutral-700"
      >
        {isDivination ? '开始占卜' : '开始排盘'}
      </button>
    </form>
  );
}