import { Link } from 'react-router-dom';
import { INTAKE_PLAN_INTRO } from '../../../functions/lib/public-page-copy.mjs';

export default function IntakePlanIntroPage() {
  return (
    <section className="mx-auto max-w-3xl space-y-6 py-8 sm:py-12">
      <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">{INTAKE_PLAN_INTRO.heading}</h1>
      <p className="text-lg leading-8 text-slate-700">{INTAKE_PLAN_INTRO.description}</p>
      <p className="rounded-2xl bg-slate-50 p-5 leading-7 text-slate-600">{INTAKE_PLAN_INTRO.boundary}</p>
      <div className="flex flex-wrap gap-3">
        {INTAKE_PLAN_INTRO.links.map((link, index) => (
          <Link key={link.href} to={link.href} className={`inline-flex min-h-11 items-center rounded-xl px-5 py-3 font-bold ${index === 0 ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-slate-100 text-slate-800 hover:bg-slate-200'}`}>{link.label}</Link>
        ))}
      </div>
      <Link to="/demo" className="inline-flex min-h-11 items-center font-bold text-blue-700 underline underline-offset-4">Erst die Demo ausprobieren</Link>
    </section>
  );
}
