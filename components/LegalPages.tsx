import React from 'react';
import { Link } from 'react-router-dom';
import { Language, translations } from '../translations';

interface Props { lang: Language }

// ── Shared newspaper-style wrapper ───────────────────────────────────────────
const LegalShell: React.FC<{ title: string; subtitle: string; lang: Language; children: React.ReactNode }> =
  ({ title, subtitle, lang, children }) => {
  const t = translations[lang];
  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <Link to="/" className="font-sans text-[10px] uppercase tracking-widest text-gray-400 hover:text-[#1a1a1a] transition-colors mb-8 flex items-center gap-1.5">
        ← {t.backToHome}
      </Link>
      <div className="border-b-2 border-[#1a1a1a] pb-6 mb-8">
        <div className="h-[3px] flex mb-5">
          <div className="flex-1 bg-rose-600" /><div className="flex-1 bg-orange-400" />
          <div className="flex-1 bg-slate-400" /><div className="flex-1 bg-sky-500" />
          <div className="flex-1 bg-blue-700" />
        </div>
        <p className="font-sans text-[10px] uppercase tracking-[0.25em] text-gray-400 mb-2">{subtitle}</p>
        <h1 className="font-serif font-black text-3xl text-[#1a1a1a]">{title}</h1>
      </div>
      <div className="space-y-8">{children}</div>
    </div>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="border-2 border-[#1a1a1a] overflow-hidden">
    <div className="bg-[#1a1a1a] px-5 py-3">
      <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">{title}</p>
    </div>
    <div className="px-5 py-5 font-serif text-sm text-[#1a1a1a] leading-relaxed space-y-3">
      {children}
    </div>
  </section>
);

// ════════════════════════════════════════════════════════════════════════════
// DATENSCHUTZERKLÄRUNG
// ════════════════════════════════════════════════════════════════════════════
export const PrivacyPage: React.FC<Props> = ({ lang }) => (
  <LegalShell title="Datenschutzerklärung" subtitle="Rechtliches · NeutraleNachrichten" lang={lang}>

    <Section title="1. Verantwortlicher">
      <p>Verantwortlicher im Sinne der DSGVO für die Verarbeitung personenbezogener Daten auf dieser Website:</p>
      <p className="font-sans text-xs text-gray-600">
        NeutraleNachrichten<br />
        vertreten durch: Bogdan Mardyshev, Romeo Giorgio Spadaro, Frederic Hallier<br />
        E-Mail: feedback@neutralnachrichten.com<br />
        Website: neutralnachrichten.com
      </p>
    </Section>

    <Section title="2. Erhobene Daten & Zweck der Verarbeitung">
      <p><strong>2.1 Serverprotokolle (Log-Daten)</strong></p>
      <p>Bei jedem Aufruf unserer Website speichert der Webserver automatisch folgende Daten:</p>
      <ul className="list-none space-y-1 font-sans text-xs text-gray-600">
        <li>— IP-Adresse des anfragenden Geräts (anonymisiert nach 7 Tagen)</li>
        <li>— Datum und Uhrzeit des Zugriffs</li>
        <li>— Name und URL der abgerufenen Datei</li>
        <li>— HTTP-Statuscode</li>
        <li>— Übertragene Datenmenge</li>
        <li>— Browser-Typ und Betriebssystem (User-Agent)</li>
      </ul>
      <p>Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an IT-Sicherheit).</p>

      <p><strong>2.2 Suchanfragen & Nutzungsstatistiken</strong></p>
      <p>
        Wenn Sie eine Medienanalyse durchführen, wird das eingegebene Thema sowie die Uhrzeit
        der Anfrage serverseitig in aggregierter Form erfasst, um Plattformstatistiken zu erstellen
        (z.B. meistgesuchte Themen). Personenbezogene Daten werden dabei nicht gespeichert.
      </p>
      <p>
        Zur Durchsetzung des täglichen Nutzungslimits wird die IP-Adresse des anfragenden Geräts
        im Arbeitsspeicher des Servers für die Dauer eines Kalendertages (UTC) gespeichert.
        Diese Daten werden nicht dauerhaft persistiert und bei Neustart des Servers gelöscht.
      </p>
      <p>Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an Missbrauchsschutz).</p>

      <p><strong>2.3 Kein Nutzerkonto, keine dauerhafte Profilbildung</strong></p>
      <p>
        Wir erstellen keine dauerhaften Nutzerprofile. Der lokale Suchverlauf wird ausschließlich
        im localStorage Ihres Browsers gespeichert und verlässt Ihr Gerät nicht.
      </p>
    </Section>

    <Section title="3. Drittanbieter & Datenübermittlung">
      <p><strong>3.1 Google Gemini API / Google Search Grounding</strong></p>
      <p>
        Zur Analyse von Medienberichten nutzen wir die Google Gemini API mit aktiviertem
        Search Grounding. Hierbei werden Suchanfragen (Themen) an Googles Server übertragen.
        Die Verarbeitung erfolgt gemäß Googles Datenschutzrichtlinien.
        Weitere Informationen: <span className="text-sky-600">policies.google.com/privacy</span>
      </p>

      <p><strong>3.2 Railway (Hosting)</strong></p>
      <p>
        Unsere Anwendung wird auf Railway (railway.app) gehostet. Server-Logs können
        vorübergehend durch Railway verarbeitet werden.
        Weitere Informationen: <span className="text-sky-600">railway.app/legal/privacy</span>
      </p>

      <p><strong>3.3 Sentry (Fehlermonitoring)</strong></p>
      <p>
        Zur Erkennung technischer Fehler setzen wir Sentry ein. Im Fehlerfall können
        technische Informationen (Fehlermeldung, Browser-Typ, anonymisierte IP) übertragen werden.
        Keine dauerhaften Nutzerprofile werden erstellt.
        Weitere Informationen: <span className="text-sky-600">sentry.io/privacy</span>
      </p>

      <p><strong>3.4 PostHog (Produktanalyse)</strong></p>
      <p>
        Wir nutzen PostHog zur Analyse von Nutzungsmustern (Seitenaufrufe, Feature-Nutzung).
        Die Daten werden pseudonymisiert erhoben. IP-Adressen werden vor der Speicherung gekürzt.
        Weitere Informationen: <span className="text-sky-600">posthog.com/privacy</span>
      </p>
    </Section>

    <Section title="4. Cookies & localStorage">
      <p>
        Diese Website setzt keine Tracking-Cookies ein. Wir nutzen ausschließlich technisch
        notwendige Browser-Mechanismen:
      </p>
      <ul className="list-none space-y-1 font-sans text-xs text-gray-600">
        <li>— <strong>localStorage:</strong> Speicherung des Suchverlaufs und der Spracheinstellung (lokal auf Ihrem Gerät)</li>
        <li>— <strong>sessionStorage:</strong> Temporäre Session-Daten</li>
      </ul>
      <p>
        Analysetools (PostHog, Sentry) können technische Cookies setzen. Diese dienen
        ausschließlich der Unterscheidung von Sessions und enthalten keine personenbezogenen Daten.
      </p>
    </Section>

    <Section title="5. Ihre Rechte (DSGVO Art. 15–22)">
      <p>Sie haben folgende Rechte gegenüber uns:</p>
      <ul className="list-none space-y-1 font-sans text-xs text-gray-600">
        <li>— <strong>Auskunft (Art. 15):</strong> Recht auf Information über gespeicherte Daten</li>
        <li>— <strong>Berichtigung (Art. 16):</strong> Korrektur unrichtiger Daten</li>
        <li>— <strong>Löschung (Art. 17):</strong> Recht auf Löschung ("Recht auf Vergessenwerden")</li>
        <li>— <strong>Einschränkung (Art. 18):</strong> Einschränkung der Verarbeitung</li>
        <li>— <strong>Widerspruch (Art. 21):</strong> Widerspruch gegen Verarbeitung auf Basis von berechtigtem Interesse</li>
        <li>— <strong>Beschwerde:</strong> Recht auf Beschwerde bei der zuständigen Datenschutzaufsichtsbehörde</li>
      </ul>
      <p>
        Zur Ausübung Ihrer Rechte wenden Sie sich bitte an:
        <strong> feedback@neutralnachrichten.com</strong>
      </p>
    </Section>

    <Section title="6. Datensicherheit">
      <p>
        Wir setzen technische und organisatorische Maßnahmen zum Schutz Ihrer Daten ein.
        Die Übertragung erfolgt verschlüsselt via HTTPS (TLS).
        Unsere Server befinden sich in EU-Rechenzentren.
      </p>
    </Section>

    <Section title="7. Änderungen dieser Datenschutzerklärung">
      <p>
        Wir behalten uns vor, diese Datenschutzerklärung bei Änderungen unserer Dienste
        oder gesetzlichen Anforderungen anzupassen. Die jeweils aktuelle Version ist auf
        dieser Seite abrufbar. Stand: Mai 2025.
      </p>
    </Section>

  </LegalShell>
);

// ════════════════════════════════════════════════════════════════════════════
// AGB / NUTZUNGSBEDINGUNGEN
// ════════════════════════════════════════════════════════════════════════════
export const TermsPage: React.FC<Props> = ({ lang }) => (
  <LegalShell title="Nutzungsbedingungen" subtitle="Rechtliches · NeutraleNachrichten" lang={lang}>

    <Section title="1. Geltungsbereich">
      <p>
        Diese Nutzungsbedingungen gelten für die Nutzung der Plattform NeutraleNachrichten
        unter neutralnachrichten.com sowie aller zugehörigen APIs und Dienste.
        Mit der Nutzung der Plattform erklären Sie sich mit diesen Bedingungen einverstanden.
      </p>
    </Section>

    <Section title="2. Leistungsbeschreibung">
      <p>
        NeutraleNachrichten ist eine KI-gestützte Informationsplattform, die mithilfe von
        Google Gemini und Google Search Grounding aktuelle Medienberichte aus verschiedenen
        politischen Spektren des deutschen Mediensystems analysiert und vergleicht.
      </p>
      <p>
        Die Plattform stellt <strong>keine journalistische Redaktion</strong> dar und gibt
        keine eigenen redaktionellen Meinungen wieder. Alle Analysen sind automatisch
        generiert und geben die Berichterstattung der zitierten Quellen wieder.
      </p>
    </Section>

    <Section title="3. Nutzungslimits & Zugangsbeschränkungen">
      <p>
        Die kostenlose Nutzung ist auf <strong>10 Analysen pro Tag und IP-Adresse</strong> begrenzt.
        Dieses Limit dient dem Schutz vor Missbrauch und der Sicherstellung der Verfügbarkeit
        für alle Nutzer.
      </p>
      <p>Folgende Handlungen sind untersagt:</p>
      <ul className="list-none space-y-1 font-sans text-xs text-gray-600">
        <li>— Automatisierte Massenanfragen (Scraping, Bots) ohne ausdrückliche Genehmigung</li>
        <li>— Umgehung von Nutzungslimits durch IP-Rotation oder ähnliche Methoden</li>
        <li>— Weiterverkauf oder kommerzielle Nutzung der Analyseergebnisse ohne Lizenz</li>
        <li>— Verbreitung der Ergebnisse ohne Quellenangabe (neutralnachrichten.com)</li>
      </ul>
    </Section>

    <Section title="4. Haftungsausschluss & Genauigkeit der Inhalte">
      <p>
        Die durch KI generierten Analysen sind automatisiert und können Fehler,
        Unvollständigkeiten oder Verzerrungen enthalten.
        <strong> NeutraleNachrichten übernimmt keine Haftung</strong> für die Richtigkeit,
        Vollständigkeit oder Aktualität der dargestellten Informationen.
      </p>
      <p>
        Die Plattform dient ausschließlich zur allgemeinen Information und Medienkompetenz-Förderung.
        Sie ersetzt keine professionelle journalistische, rechtliche oder politische Beratung.
      </p>
      <p>
        Für externe Links und die Inhalte verlinkter Websites übernehmen wir keine Haftung.
      </p>
    </Section>

    <Section title="5. Urheberrecht & Nutzungsrechte">
      <p>
        Das Design, die Software und die Strukturierung der Plattform sind urheberrechtlich
        geschützt. Die durch Gemini generierten Analysetexte basieren auf öffentlich
        zugänglichen Medieninhalten und werden im Rahmen des Zitatrechts und der
        automatisierten Informationsverarbeitung genutzt.
      </p>
      <p>
        Nutzer dürfen Analyseergebnisse für private und nicht-kommerzielle Zwecke verwenden
        und teilen, sofern die Quelle (neutralnachrichten.com) angegeben wird.
      </p>
    </Section>

    <Section title="6. Verfügbarkeit & Änderungen">
      <p>
        Wir bemühen uns um eine hohe Verfügbarkeit der Plattform, übernehmen jedoch
        keine Garantie für ununterbrochenen Zugang. Wartungsarbeiten und Updates
        können zu temporären Einschränkungen führen.
      </p>
      <p>
        Wir behalten uns vor, das Angebot jederzeit zu ändern, zu erweitern oder einzustellen.
      </p>
    </Section>

    <Section title="7. Anwendbares Recht">
      <p>
        Es gilt das Recht der Bundesrepublik Deutschland.
        Gerichtsstand für alle Streitigkeiten aus diesem Vertragsverhältnis ist,
        soweit gesetzlich zulässig, Berlin.
      </p>
    </Section>

    <Section title="8. Kontakt">
      <p>
        Fragen zu diesen Nutzungsbedingungen richten Sie bitte an:<br />
        <strong>feedback@neutralnachrichten.com</strong>
      </p>
      <p className="font-sans text-[10px] text-gray-400">Stand: Mai 2025</p>
    </Section>

  </LegalShell>
);

// ════════════════════════════════════════════════════════════════════════════
// IMPRESSUM
// ════════════════════════════════════════════════════════════════════════════
export const ImprintPage: React.FC<Props> = ({ lang }) => (
  <LegalShell title="Impressum" subtitle="Rechtliches · NeutraleNachrichten" lang={lang}>

    <Section title="Angaben gemäß § 5 TMG">
      <p className="font-sans text-xs leading-6 text-gray-700">
        <strong>NeutraleNachrichten</strong><br />
        Bogdan Mardyshev, Romeo Giorgio Spadaro, Frederic Hallier<br />
        Berlin, Deutschland<br />
        <br />
        E-Mail: <strong>feedback@neutralnachrichten.com</strong><br />
        Website: <strong>neutralnachrichten.com</strong>
      </p>
    </Section>

    <Section title="Redaktionell verantwortlich">
      <p className="font-sans text-xs text-gray-700">
        Bogdan Mardyshev (CTO)<br />
        Romeo Giorgio Spadaro (CEO)<br />
        Anschrift wie oben
      </p>
    </Section>

    <Section title="Inhalt & Haftungsausschluss">
      <p>
        Die Inhalte dieser Website wurden mit größtmöglicher Sorgfalt erstellt.
        Für die Richtigkeit, Vollständigkeit und Aktualität der Inhalte können wir
        jedoch keine Gewähr übernehmen.
      </p>
      <p>
        Als Diensteanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene Inhalte auf
        diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG
        sind wir als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder
        gespeicherte fremde Informationen zu überwachen.
      </p>
      <p>
        <strong>KI-generierte Inhalte:</strong> Die Medienanalysen auf dieser Plattform
        werden automatisiert durch Google Gemini erstellt und geben die Berichterstattung
        der zitierten Quellen wieder. Wir übernehmen keine redaktionelle Verantwortung
        für die automatisch generierten Analyse-Texte.
      </p>
    </Section>

    <Section title="Urheberrecht">
      <p>
        Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten
        unterliegen dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung,
        Verbreitung und jede Art der Verwertung außerhalb der Grenzen des Urheberrechtes
        bedürfen der schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers.
      </p>
    </Section>

    <Section title="Streitschlichtung">
      <p>
        Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:
        <span className="text-sky-600"> ec.europa.eu/consumers/odr</span>
      </p>
      <p>
        Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
        Verbraucherschlichtungsstelle teilzunehmen.
      </p>
    </Section>

  </LegalShell>
);

// ════════════════════════════════════════════════════════════════════════════
// Legacy export for backward compatibility
// ════════════════════════════════════════════════════════════════════════════
export const LegalPage: React.FC<Props & { type: 'imprint' | 'privacy' | 'terms' }> = ({ lang, type }) => {
  if (type === 'privacy') return <PrivacyPage lang={lang} />;
  if (type === 'terms')   return <TermsPage lang={lang} />;
  return <ImprintPage lang={lang} />;
};
