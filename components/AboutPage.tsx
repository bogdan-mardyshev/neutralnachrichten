import React from 'react';
import { Link } from 'react-router-dom';
import { translations, Language } from '../translations';

interface Props { lang: Language }

const TEAM = [
  {
    name: 'Bogdan Mardyshev',
    role: { de: 'CTO', en: 'CTO', ru: 'CTO' },
    bio: {
      de: 'Informatikstudent an der SRH Berlin',
      en: 'Computer Science student at SRH Berlin',
      ru: 'Студент факультета информатики SRH Berlin',
    },
  },
  {
    name: 'Romeo Giorgio Spadaro',
    role: { de: 'CEO', en: 'CEO', ru: 'CEO' },
    bio: {
      de: 'BWL-Student an der SRH Berlin',
      en: 'Business student at SRH Berlin',
      ru: 'Студент бизнес-факультета SRH Berlin',
    },
  },
  {
    name: 'Frederic Hallier',
    role: { de: 'CMO', en: 'CMO', ru: 'CMO' },
    bio: {
      de: 'BWL-Student an der SRH Berlin',
      en: 'Business student at SRH Berlin',
      ru: 'Студент бизнес-факультета SRH Berlin',
    },
  },
];

export const AboutPage: React.FC<Props> = ({ lang }) => {
  const t = translations[lang];
  const a = t.about;

  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      <Link to="/" className="text-slate-500 hover:text-slate-800 mb-8 flex items-center gap-2 text-sm">
        ← {t.backToHome}
      </Link>

      {/* Hero */}
      <div className="mb-12">
        <h1 className="text-4xl font-bold text-slate-900 mb-4">{a.title}</h1>
        <p className="text-2xl font-semibold text-slate-700 leading-snug mb-4">{a.missionHero}</p>
        <p className="text-lg text-gray-600 leading-relaxed">{a.missionSub}</p>
      </div>

      {/* Why */}
      <section className="mb-10">
        <h2 className="text-xl font-bold text-slate-900 mb-3">{a.whyTitle}</h2>
        <p className="text-gray-600 leading-relaxed">{a.whyBody}</p>
      </section>

      {/* Team */}
      <section className="mb-10">
        <h2 className="text-xl font-bold text-slate-900 mb-6">{a.teamTitle}</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {TEAM.map((member) => (
            <div key={member.name} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-200 mx-auto mb-3 flex items-center justify-center text-slate-400 text-2xl font-bold">
                {member.name.charAt(0)}
              </div>
              <p className="font-bold text-slate-900 text-sm">{member.name}</p>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mt-0.5">
                {member.role[lang]}
              </p>
              <p className="text-xs text-gray-400 mt-1">{member.bio[lang]}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Independence */}
      <section className="mb-10 bg-slate-50 rounded-xl p-6 border border-slate-100">
        <h2 className="text-xl font-bold text-slate-900 mb-3">{a.independenceTitle}</h2>
        <p className="text-gray-600 leading-relaxed">{a.independenceBody}</p>
      </section>

      {/* Contact */}
      <section>
        <h2 className="text-xl font-bold text-slate-900 mb-3">{a.contactTitle}</h2>
        <p className="text-gray-600 mb-2">{a.contactBody}</p>
        <a
          href={`mailto:${a.contactEmail}`}
          className="text-slate-800 font-semibold hover:underline"
        >
          {a.contactEmail}
        </a>
        <div className="mt-4">
          <Link to="/suggest" className="text-slate-600 hover:text-slate-900 font-medium">
            {a.suggestLink}
          </Link>
        </div>
      </section>
    </div>
  );
};
