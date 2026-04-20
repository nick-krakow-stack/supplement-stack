import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Search,
  Star,
  Layers,
  FlaskConical,
  TrendingDown,
  ShoppingBag,
  PlusCircle,
  CheckCircle,
  ArrowRight,
  Zap,
  Shield,
  BarChart3,
  Users,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Hero Section
// ---------------------------------------------------------------------------
function HeroSection({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-slate-50 to-indigo-50/40 pt-16 pb-20 md:pt-24 md:pb-28">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-100/60 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-purple-100/50 rounded-full blur-3xl -translate-x-1/3 translate-y-1/3" />
      </div>

      <div className="relative max-w-4xl mx-auto px-6 text-center">
        {/* Badge */}
        {!isLoggedIn && (
          <div className="inline-flex items-center gap-2 bg-white border border-indigo-100 rounded-full px-4 py-1.5 mb-8 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm font-medium text-indigo-700">Demo verfügbar – keine Registrierung nötig</span>
          </div>
        )}

        {/* Headline */}
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight tracking-tight mb-6">
          Dein personalisierter{' '}
          <span className="bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
            Supplement-Stack.
          </span>
          <br />
          <span className="text-3xl md:text-4xl lg:text-5xl font-semibold text-gray-700">
            Wissenschaftlich. Einfach. Kosteneffizient.
          </span>
        </h1>

        {/* Subheadline */}
        <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto mb-10 leading-relaxed">
          Finde die richtigen Wirkstoffe, erhalte evidenzbasierte Dosierungsempfehlungen von DGE, EFSA und NIH –
          und baue deinen optimalen Stack mit transparentem Preisvergleich.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14">
          {!isLoggedIn && (
            <Link
              to="/demo"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold rounded-2xl px-8 py-4 text-base shadow-lg hover:shadow-xl transition-all duration-200 w-full sm:w-auto justify-center"
            >
              <Zap size={18} />
              Demo starten
            </Link>
          )}
          {!isLoggedIn && (
            <Link
              to="/register"
              className="inline-flex items-center gap-2 border-2 border-indigo-200 bg-white hover:bg-indigo-50 text-indigo-700 font-semibold rounded-2xl px-8 py-4 text-base transition-all duration-200 w-full sm:w-auto justify-center"
            >
              Kostenlos registrieren
              <ArrowRight size={18} />
            </Link>
          )}
          {isLoggedIn && (
            <Link
              to="/search"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold rounded-2xl px-8 py-4 text-base shadow-lg hover:shadow-xl transition-all duration-200 w-full sm:w-auto justify-center"
            >
              <Zap size={18} />
              Wirkstoff suchen
            </Link>
          )}
        </div>

        {/* Feature chips */}
        <div className="flex flex-wrap justify-center gap-3">
          {[
            { icon: <FlaskConical size={14} />, label: 'DGE · EFSA · NIH Quellen' },
            { icon: <TrendingDown size={14} />, label: 'Preis-pro-Portion Vergleich' },
            { icon: <Shield size={14} />, label: 'Kostenlos & ohne Konto nutzbar' },
            { icon: <BarChart3 size={14} />, label: 'Monatliche Kostenübersicht' },
          ].map(({ icon, label }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 bg-white border border-gray-100 rounded-full px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm"
            >
              <span className="text-indigo-500">{icon}</span>
              {label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// How it works
// ---------------------------------------------------------------------------
const steps = [
  {
    icon: <Search size={28} className="text-indigo-500" />,
    step: '01',
    title: 'Wirkstoff suchen',
    description:
      'Gib einen Wirkstoff ein – zum Beispiel Magnesium, Vitamin D oder Omega-3. Unsere Datenbank liefert dir sofort evidenzbasierte Informationen.',
  },
  {
    icon: <Star size={28} className="text-purple-500" />,
    step: '02',
    title: 'Empfehlung erhalten',
    description:
      'Sieh auf einen Blick, wie viele Milligramm du täglich brauchst, wie viele Kapseln oder Tropfen das entspricht – und welche Produkte am besten passen.',
  },
  {
    icon: <Layers size={28} className="text-emerald-500" />,
    step: '03',
    title: 'Stack aufbauen',
    description:
      'Füge Produkte deinem persönlichen Stack hinzu, beobachte die monatlichen Gesamtkosten und optimiere deinen Stack in Echtzeit.',
  },
];

function HowItWorksSection() {
  return (
    <section className="py-20 md:py-28 bg-white">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-14">
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-500 mb-3">So funktioniert's</p>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            In drei Schritten zu deinem Stack
          </h2>
          <p className="text-gray-500 max-w-xl mx-auto">
            Keine Vorkenntnisse nötig. Supplement Stack führt dich Schritt für Schritt zu einem wissenschaftlich fundierten Ergebnis.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 md:gap-8">
          {steps.map(({ icon, step, title, description }) => (
            <div
              key={step}
              className="relative bg-gradient-to-br from-slate-50 to-indigo-50/30 rounded-2xl border border-gray-100 p-7 shadow-sm hover:shadow-md transition-shadow duration-200"
            >
              <div className="absolute top-5 right-6 text-5xl font-black text-gray-100 select-none leading-none">
                {step}
              </div>
              <div className="mb-4">{icon}</div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Features 2x2 grid
// ---------------------------------------------------------------------------
const features = [
  {
    icon: <FlaskConical size={24} className="text-indigo-500" />,
    title: 'Evidenzbasierte Dosierungen',
    description:
      'Jede Empfehlung basiert auf anerkannten wissenschaftlichen Quellen: Deutsche Gesellschaft für Ernährung (DGE), European Food Safety Authority (EFSA) und den National Institutes of Health (NIH).',
    tag: 'DGE · EFSA · NIH',
    tagColor: 'bg-indigo-50 text-indigo-600',
  },
  {
    icon: <TrendingDown size={24} className="text-emerald-500" />,
    title: 'Transparenter Kostenvergleich',
    description:
      'Vergleiche Produkte anhand des Preises pro Portion – nicht anhand des Packungspreises. Sieh sofort, was dein Stack dich pro Monat kostet.',
    tag: 'Preis pro Portion',
    tagColor: 'bg-emerald-50 text-emerald-600',
  },
  {
    icon: <ShoppingBag size={24} className="text-purple-500" />,
    title: 'Passende Produktauswahl',
    description:
      'Filtere Produkte nach Wirkstoff, Gehalt und Eignung. Die Sortierung nach Preis-Leistung hilft dir, das beste Produkt für deinen Bedarf zu finden.',
    tag: 'Automatisch gefiltert',
    tagColor: 'bg-purple-50 text-purple-600',
  },
  {
    icon: <PlusCircle size={24} className="text-orange-500" />,
    title: 'Eigene Produkte hinzufügen',
    description:
      'Du verwendest bereits ein Produkt, das nicht in unserer Datenbank ist? Füge es einfach selbst hinzu und integriere es nahtlos in deinen Stack.',
    tag: 'Vollständig anpassbar',
    tagColor: 'bg-orange-50 text-orange-600',
  },
];

function FeaturesSection() {
  return (
    <section className="py-20 md:py-28 bg-gradient-to-br from-slate-50 to-indigo-50/30">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-14">
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-500 mb-3">Features</p>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Alles, was du für deinen Stack brauchst
          </h2>
          <p className="text-gray-500 max-w-xl mx-auto">
            Supplement Stack vereint wissenschaftliche Grundlagen mit praktischer Nutzbarkeit – kostenlos und ohne Anmeldung.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {features.map(({ icon, title, description, tag, tagColor }) => (
            <div
              key={title}
              className="bg-white rounded-2xl border border-gray-100 p-7 shadow-sm hover:shadow-md transition-shadow duration-200"
            >
              <div className="flex items-start gap-4">
                <div className="p-2.5 bg-gray-50 rounded-xl shrink-0">{icon}</div>
                <div>
                  <span className={`inline-block text-xs font-semibold rounded-full px-2.5 py-0.5 mb-2 ${tagColor}`}>
                    {tag}
                  </span>
                  <h3 className="text-base font-bold text-gray-900 mb-2">{title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Trust / Social Proof
// ---------------------------------------------------------------------------
const trustStats = [
  { value: '500+', label: 'Wirkstoffe in der Datenbank' },
  { value: '3', label: 'Wissenschaftliche Quellen (DGE, EFSA, NIH)' },
  { value: '100 %', label: 'Kostenlos & datenschutzfreundlich' },
  { value: '< 30 s', label: 'Bis zum ersten Ergebnis' },
];

const trustPoints = [
  'Empfehlungen ausschließlich aus wissenschaftlich anerkannten Quellen',
  'Transparente Preisvergleiche ohne versteckte Kosten',
  'Keine Werbung, keine Affiliate-Intransparenz – klar gekennzeichnet',
  'DSGVO-konform, keine Datenweitergabe an Dritte',
];

function TrustSection() {
  return (
    <section className="py-20 md:py-28 bg-white">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-14">
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-500 mb-3">Vertrauen & Transparenz</p>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Wissenschaft statt Marketing-Versprechen
          </h2>
          <p className="text-gray-500 max-w-xl mx-auto">
            Supplement Stack verzichtet bewusst auf Übertreibungen. Nur was belegt ist, wird empfohlen.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {trustStats.map(({ value, label }) => (
            <div
              key={label}
              className="bg-gradient-to-br from-slate-50 to-indigo-50/40 rounded-2xl border border-gray-100 p-5 text-center shadow-sm"
            >
              <div className="text-3xl font-black bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent mb-1">
                {value}
              </div>
              <div className="text-xs text-gray-500 leading-snug">{label}</div>
            </div>
          ))}
        </div>

        {/* Trust checkmarks */}
        <div className="bg-gradient-to-br from-slate-50 to-indigo-50/30 rounded-2xl border border-gray-100 p-8 shadow-sm">
          <div className="grid md:grid-cols-2 gap-4">
            {trustPoints.map((point) => (
              <div key={point} className="flex items-start gap-3">
                <CheckCircle size={18} className="text-emerald-500 shrink-0 mt-0.5" />
                <span className="text-sm text-gray-700 leading-relaxed">{point}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Demo CTA Section
// ---------------------------------------------------------------------------
function DemoCtaSection({ isLoggedIn }: { isLoggedIn: boolean }) {
  if (isLoggedIn) return null;

  return (
    <section className="py-16 md:py-20">
      <div className="max-w-4xl mx-auto px-6">
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-3xl p-10 md:p-14 text-center shadow-xl relative overflow-hidden">
          {/* Background blobs */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-2xl translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full blur-2xl -translate-x-1/3 translate-y-1/3" />

          <div className="relative">
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm text-white text-sm font-semibold rounded-full px-4 py-1.5 mb-6">
              <Zap size={14} />
              Keine Registrierung nötig
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">
              Starte jetzt mit deinem persönlichen Stack
            </h2>
            <p className="text-indigo-100 text-base md:text-lg mb-8 max-w-xl mx-auto">
              Im Demo-Modus kannst du Supplement Stack vollständig ausprobieren –
              ohne Anmeldung, ohne Kreditkarte, ohne Risiko.
            </p>
            <Link
              to="/demo"
              className="inline-flex items-center gap-2 bg-white text-indigo-700 font-bold rounded-2xl px-8 py-4 text-base shadow-lg hover:shadow-xl hover:bg-indigo-50 transition-all duration-200"
            >
              <Zap size={18} />
              Demo jetzt starten
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Final Register CTA
// ---------------------------------------------------------------------------
function RegisterCtaSection({ isLoggedIn }: { isLoggedIn: boolean }) {
  if (isLoggedIn) return null;

  return (
    <section className="py-16 md:py-20 bg-gradient-to-br from-slate-50 to-indigo-50/30">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <div className="inline-flex items-center gap-2 bg-white border border-indigo-100 rounded-full px-4 py-1.5 mb-8 shadow-sm">
          <Users size={14} className="text-indigo-500" />
          <span className="text-sm font-medium text-indigo-700">Kostenloser Account – jetzt verfügbar</span>
        </div>

        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 leading-tight">
          Bereit für deinen optimalen Stack?
        </h2>
        <p className="text-gray-500 text-base md:text-lg max-w-xl mx-auto mb-10">
          Registriere dich kostenlos, um deinen Stack zu speichern, Produkte zu verwalten und jederzeit auf deine Daten zuzugreifen.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/register"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold rounded-2xl px-8 py-4 text-base shadow-lg hover:shadow-xl transition-all duration-200 w-full sm:w-auto justify-center"
          >
            Kostenlos registrieren
            <ArrowRight size={18} />
          </Link>
          <Link
            to="/demo"
            className="inline-flex items-center gap-2 border-2 border-gray-200 bg-white hover:bg-gray-50 text-gray-600 font-semibold rounded-2xl px-8 py-4 text-base transition-all duration-200 w-full sm:w-auto justify-center"
          >
            Erst Demo ausprobieren
          </Link>
        </div>

        <p className="mt-6 text-xs text-gray-400">
          Keine Kreditkarte · Kein Abo · Jederzeit löschbar
        </p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function LandingPage() {
  const { user } = useAuth();
  const isLoggedIn = user !== null;

  return (
    <div className="overflow-x-hidden">
      <HeroSection isLoggedIn={isLoggedIn} />
      <HowItWorksSection />
      <FeaturesSection />
      <TrustSection />
      <DemoCtaSection isLoggedIn={isLoggedIn} />
      <RegisterCtaSection isLoggedIn={isLoggedIn} />
    </div>
  );
}
