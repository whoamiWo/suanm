import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { METHOD_MAP, METHODS } from '@/lib/chart/methods-meta';
import { runChart } from '@/lib/chart/registry';
import { ChartError, type BirthInput } from '@/lib/chart/types';
import { BirthForm } from '@/components/chart/BirthForm';

/**
 * 排盘结果页。
 *
 * 这是 SEO 的核心页面：参数在 URL 中，内容由服务端直出（首屏即可见盘面），
 * 每个「出生日期 + 术数」组合都是一个可被索引的长尾页面。
 */


// 本页依赖 searchParams 与运行时排盘，允许阻塞式渲染
export const instant = false;

interface PageProps {
  params: Promise<{ method: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

/**
 * 占卜类方法的占位输入。
 *
 * 占卜不依赖出生信息，但 registry 的统一签名要求提供 BirthInput，
 * 故用不参与计算的占位值填充。
 */
const EMPTY_BIRTH_INPUT: BirthInput = {
  birthYear: 2000,
  birthMonth: 1,
  birthDay: 1,
  gender: 'male',
};

/**
 * 从 query 解析出生信息（命理类方法）。
 */
function parseBirth(sp: Record<string, string | string[] | undefined>): BirthInput | null {
  const y = Number(first(sp.y));
  const m = Number(first(sp.m));
  const d = Number(first(sp.d));

  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) {
    return null;
  }
  const gender = first(sp.g) === 'female' ? 'female' : 'male';
  const unknownHour = first(sp.uh) === '1';
  const hour = unknownHour ? undefined : Number(first(sp.h));

  const input: BirthInput = {
    birthYear: y,
    birthMonth: m,
    birthDay: d,
    gender,
  };
  if (hour !== undefined && Number.isInteger(hour)) {
    input.birthHour = hour;
  }
  const minute = Number(first(sp.min));
  if (input.birthHour !== undefined && Number.isInteger(minute)) {
    input.birthMinute = minute;
  }
  const lon = first(sp.lon);
  if (first(sp.ts) === '1' && lon) {
    const longitude = Number(lon);
    if (Number.isFinite(longitude)) {
      input.longitude = longitude;
    }
  }
  const bp = first(sp.bp);
  if (bp) input.birthPlace = bp;
  const tz = first(sp.tz);
  if (tz) input.timezone = tz;
  const db = first(sp.db);
  if (db === 'midnight' || db === 'zi') input.dayBoundary = db;
  const ct = first(sp.ct);
  if (ct === 'solar' || ct === 'lunar') input.calendarType = ct;
  if (first(sp.leap) === '1') input.isLeapMonth = true;
  return input;
}

/**
 * 从 query 解析问事信息（占卜类方法）。
 *
 * 占卜参数通过 options 传给 registry，避免污染 BirthInput 契约。
 */
function parseDivinationOptions(
  sp: Record<string, string | string[] | undefined>,
): Record<string, unknown> | null {
  const date = first(sp.date);
  const hour = first(sp.hour);
  if (!date || !hour) return null;

  const minute = Number(first(sp.minute));
  const options: Record<string, unknown> = {
    date,
    hour: Number(hour),
  };
  if (Number.isInteger(minute)) options.minute = minute;
  const question = first(sp.question);
  if (question) options.question = question;
  return options;
}

/** 生成页面标题 */
function buildTitle(method: string, sp: Record<string, string | string[] | undefined>): string {
  const meta = METHOD_MAP[method];
  const y = first(sp.y);
  const mo = first(sp.m);
  const d = first(sp.d);
  const h = first(sp.h);
  const g = first(sp.g) === 'female' ? '女' : '男';
  const hour = first(sp.uh) === '1' ? '时辰未知' : `${h}时`;
  if (!y || !mo || !d) {
    return `${meta?.name ?? '排盘'} - 在线排盘`;
  }
  return `${y}年${Number(mo)}月${Number(d)}日${hour}${g} ${meta?.name ?? '排盘'}`;
}

export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const { method } = await params;
  const sp = await searchParams;
  const meta = METHOD_MAP[method];
  if (!meta) return { title: '排盘' };

  const title = buildTitle(method, sp);
  const description = `${meta.description}。${title}，免费在线排盘，支持真太阳时校正与结果分享。`;

  return {
    title,
    description,
    keywords: [meta.name, '排盘', '算命', meta.id],
    alternates: { canonical: `/paipan/${method}` },
    openGraph: { title, description, type: 'website' },
  };
}

export default async function PaipanPage({ params, searchParams }: PageProps) {
  const { method } = await params;
  const sp = await searchParams;
  const meta = METHOD_MAP[method];
  if (!meta) notFound();

  const isDivination = meta.requiresBirth === false;
  const input = isDivination ? null : parseBirth(sp);
  const divinationOptions = isDivination ? parseDivinationOptions(sp) : null;

  let result: { text: string; json: unknown; warnings?: string[] } | null = null;
  let errorMessage: string | null = null;

  // 占卜类需要问事时间，命理类需要出生信息；两者缺一不可
  const missingInput = isDivination ? divinationOptions === null : input === null;

  if (!missingInput) {
    try {
      // 统一经 registry 调度：命理类传 input，占卜类传 options
      const r = isDivination
        ? await runChart(method, EMPTY_BIRTH_INPUT, divinationOptions ?? {})
        : await runChart(method, input!, undefined);
      result = { text: r.text, json: r.json, warnings: r.warnings };
    } catch (err) {
      if (err instanceof ChartError) {
        errorMessage = err.message;
      } else {
        errorMessage = isDivination ? '占卜失败，请检查输入信息' : '排盘失败，请检查输入信息';
      }
    }
  }

  // 结构化数据，便于搜索引擎理解
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: `${meta.name} - 元亨利贞`,
    description: meta.description,
    applicationCategory: 'LifestyleApplication',
    operatingSystem: 'Web',
  };

  return (
    <main className="min-h-screen bg-neutral-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="mx-auto max-w-4xl px-4 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-neutral-900">
            {meta.name}
          </h1>
          <p className="mt-1 text-sm text-neutral-600">
            {isDivination
              ? '基于问事时间与方法的排盘结果，仅供传统文化研究与学习参考'
              : meta.description}
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <aside className="lg:sticky lg:top-6 lg:self-start">
            {isDivination ? (
              // 占卜类使用问事表单，暂时复用 BirthForm（或后续新增 DivinationForm）
              <BirthForm defaultMethod={method} />
            ) : (
              <BirthForm defaultMethod={method} />
            )}
          </aside>

          <section>
            {isDivination && !input && (
              <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-500">
                请填写左侧问事信息后开始排盘
              </div>
            )}
            {!isDivination && !input && (
              <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-500">
                请填写左侧出生信息后开始排盘
              </div>
            )}

            {input && errorMessage && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-6">
                <p className="text-sm text-red-700">{errorMessage}</p>
              </div>
            )}

            {input && result && (
              <div className="rounded-xl border border-neutral-200 bg-white">
                <div className="border-b border-neutral-100 px-5 py-3">
                  <h2 className="text-sm font-medium text-neutral-900">
                    {isDivination ? `${meta.name} - 问事排盘` : buildTitle(method, sp)}
                  </h2>
                </div>
                <div className="px-5 py-4">
                  <MarkdownTable text={result.text} />
                </div>
                {result.warnings && result.warnings.length > 0 && (
                  <div className="border-t border-neutral-100 px-5 py-3">
                    {result.warnings.map((w, i) => (
                      <p key={i} className="text-xs text-amber-700">
                        ⚠ {w}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!input && !result && (
              <p className="mt-4 text-sm text-neutral-500">
                {isDivination
                  ? '请在左侧填写问事日期、小时与问事内容，然后点击开始占卜'
                  : '请在左侧填写出生年月日时分，然后点击开始排盘'}
              </p>
            )}

            <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-5">
              <h3 className="mb-2 text-sm font-medium text-neutral-900">
                其他排盘工具
              </h3>
              <div className="flex flex-wrap gap-2">
                {METHODS.filter((m) => m.id !== method).map((m) => (
                  <a
                    key={m.id}
                    href={`/paipan/${m.id}`}
                    className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-50"
                  >
                    {m.name}
                  </a>
                ))}
              </div>
            </div>

            <p className="mt-6 text-xs leading-relaxed text-neutral-400">
              本站提供中国传统术数的算法排盘工具，结果基于所选规则推演，
              仅供传统文化研究与学习参考，不构成任何医疗、法律、投资或人生决策建议。
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

/**
 * 极简 Markdown 渲染。
 *
 * canonical text 为稳定的规范格式（标题 + 表格 + 列表），
 * 这里只解析这三类结构，避免引入完整 Markdown 依赖。
 */
function MarkdownTable({ text }: { text: string }) {
  const lines = text.split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 标题
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const content = heading[2];
      const cls =
        level === 1
          ? 'text-lg font-semibold text-neutral-900 mt-4 mb-2'
          : level === 2
            ? 'text-base font-semibold text-neutral-900 mt-5 mb-2'
            : 'text-sm font-medium text-neutral-800 mt-3 mb-1.5';
      blocks.push(
        <h3 key={key++} className={cls}>
          {content}
        </h3>,
      );
      i++;
      continue;
    }

    // 表格
    if (line.trim().startsWith('|') && lines[i + 1]?.trim().startsWith('|')) {
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(
          lines[i]
            .trim()
            .replace(/^\||\|$/g, '')
            .split('|')
            .map((c) => c.trim()),
        );
        i++;
      }
      const header = rows.shift() ?? [];
      blocks.push(
        <div key={key++} className="my-3 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-200">
                {header.map((h, hi) => (
                  <th
                    key={hi}
                    className="px-2 py-2 text-left font-medium text-neutral-700"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} className="border-b border-neutral-100 last:border-0">
                  {r.map((c, ci) => (
                    <td key={ci} className="px-2 py-2 text-neutral-700">
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // 列表
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i++;
      }
      blocks.push(
        <ul key={key++} className="my-2 space-y-1 pl-4">
          {items.map((it, ii) => (
            <li key={ii} className="list-disc text-sm text-neutral-700">
              {it}
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    // 空行
    if (line.trim() === '') {
      i++;
      continue;
    }

    // 普通段落
    blocks.push(
      <p key={key++} className="my-1.5 text-sm leading-relaxed text-neutral-700">
        {line.replace(/\*\*/g, '')}
      </p>,
    );
    i++;
  }

  return <div className="space-y-1">{blocks}</div>;
}
