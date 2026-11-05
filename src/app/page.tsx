import Link from 'next/link';
import { METHODS } from '@/lib/chart/methods-meta';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-4xl px-4 py-12">
        <section className="mb-10">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">
            元亨利贞
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-neutral-600">
            综合八字、紫微斗数、六爻、奇门遁甲、大六壬等中国传统术数的在线排盘工具。
            支持真太阳时校正，流派口径公开透明，结果可分享。
          </p>
        </section>

        <section className="mb-10">
          <h2 className="mb-4 text-lg font-semibold text-neutral-900">开始排盘</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {METHODS.map((m) => (
              <Link
                key={m.id}
                href={`/paipan/${m.id}`}
                className="group rounded-xl border border-neutral-200 bg-white p-5 transition hover:border-neutral-400 hover:shadow-sm"
              >
                <h3 className="font-medium text-neutral-900 group-hover:text-black">
                  {m.name}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">
                  {m.description}
                </p>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-neutral-200 bg-white p-6">
          <h2 className="mb-3 text-base font-semibold text-neutral-900">
            关于本站
          </h2>
          <ul className="space-y-2 text-sm leading-relaxed text-neutral-600">
            <li>
              <strong className="font-medium text-neutral-800">算法透明</strong>
              ：排盘口径（真太阳时、日界、流派算法）均可显式选择，
              不做静默默认，结果可复现。
            </li>
            <li>
              <strong className="font-medium text-neutral-800">免费排盘</strong>
              ：所有基础排盘永久免费，无需注册。
            </li>
            <li>
              <strong className="font-medium text-neutral-800">隐私友好</strong>
              ：出生信息仅保存在你自己的账号中，可随时导出与删除。
            </li>
          </ul>
        </section>

        <p className="mt-8 text-xs leading-relaxed text-neutral-400">
          本站提供中国传统术数的算法排盘工具，结果基于所选规则推演，
          仅供传统文化研究与学习参考，不构成任何医疗、法律、投资或人生决策建议。
        </p>
      </div>
    </main>
  );
}
