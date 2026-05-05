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
        <li>— HTTP-Statuscode, übertragene Datenmenge</li>
        <li>— Browser-Typ und Betriebssystem (User-Agent)</li>
      </ul>
      <p>Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an IT-Sicherheit).</p>

      <p><strong>2.2 Suchanfragen & Nutzungsstatistiken</strong></p>
      <p>
        Wenn Sie eine Medienanalyse durchführen, werden das Suchthema, Sprache, Zeitstempel
        und ein anonymisierter IP-Hash (SHA-256, gekürzt auf 16 Zeichen) in unserer Datenbank
        gespeichert. Diese dienen ausschließlich der Plattformstatistik (meistgesuchte Themen,
        Cache-Effizienz). Eine Rückführung auf einzelne Personen ist technisch ausgeschlossen.
      </p>
      <p>
        Zur Durchsetzung des täglichen Nutzungslimits wird die IP-Adresse des anfragenden Geräts
        tagesweise (UTC-Kalendertag) in unserer Datenbank gespeichert und danach überschrieben.
      </p>
      <p>Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an Missbrauchsschutz).</p>

      <p><strong>2.3 Nutzerkonten (freiwillige Registrierung)</strong></p>
      <p>
        Wenn Sie ein Konto erstellen, verarbeiten wir folgende Daten:
      </p>
      <ul className="list-none space-y-1 font-sans text-xs text-gray-600">
        <li>— <strong>E-Mail-Adresse</strong> — zur Identifikation und optionalen Kommunikation</li>
        <li>— <strong>Passwort-Hash</strong> — gespeichert als bcrypt-Hash (Klartextpasswort verlässt Ihr Gerät nicht)</li>
        <li>— <strong>Kontoebene</strong> (free / pro / enterprise) und tägliches Nutzungslimit</li>
        <li>— <strong>Erstellungsdatum</strong> und Zeitstempel des letzten Logins</li>
        <li>— <strong>Suchverlauf</strong> — verknüpfte Suchanfragen werden Ihrer Nutzer-ID zugeordnet</li>
      </ul>
      <p>
        Die Registrierung ist freiwillig. Ohne Konto ist die Nutzung der Kernfunktionen
        im Rahmen des täglichen Gratis-Limits weiterhin möglich.
      </p>
      <p>Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung).</p>

      <p><strong>2.4 Authentifizierungstoken (JWT)</strong></p>
      <p>
        Nach dem Login erhalten Sie ein signiertes JSON Web Token (JWT), das in Ihrem
        Browser-localStorage gespeichert wird. Es enthält Ihre Nutzer-ID, E-Mail und
        Kontoebene — verschlüsselt mit einem serverseitigen Schlüssel.
        Das Token ist 30 Tage gültig und verlässt Ihren Browser nur bei API-Anfragen
        an unsere eigene Server-Infrastruktur.
      </p>
      <p>Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung).</p>
    </Section>

    <Section title="3. Google Sign-In (OAuth 2.0)">
      <p>
        Wir bieten die Möglichkeit, sich mit Ihrem Google-Konto anzumelden.
        Wenn Sie diese Funktion nutzen, leiten wir Sie zu Googles OAuth-Dienst weiter.
        Nach Ihrer Zustimmung übermittelt Google uns folgende Daten:
      </p>
      <ul className="list-none space-y-1 font-sans text-xs text-gray-600">
        <li>— <strong>E-Mail-Adresse</strong> des Google-Kontos</li>
        <li>— <strong>Anzeigename</strong> (optional, nur zur Anzeige)</li>
        <li>— Google-interne Nutzer-ID (wird von uns nicht gespeichert)</li>
      </ul>
      <p>
        Wir speichern kein Google-Passwort, keinen Refresh-Token und haben keinen
        dauerhaften Zugriff auf Ihr Google-Konto. Die OAuth-Verbindung dient
        ausschließlich der einmaligen Identitätsverifizierung.
      </p>
      <p>
        Datenschutzerklärung Google: <span className="text-sky-600">policies.google.com/privacy</span>
      </p>
      <p>Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) i.V.m. Art. 6 Abs. 1 lit. a DSGVO (Einwilligung).</p>
    </Section>

    <Section title="4. Drittanbieter & Datenübermittlung">
      <p><strong>4.1 Google Gemini API / Google Search Grounding</strong></p>
      <p>
        Zur Analyse von Medienberichten nutzen wir die Google Gemini API mit aktiviertem
        Search Grounding. Hierbei werden Suchanfragen (Themen) an Googles Server übertragen.
        Weitere Informationen: <span className="text-sky-600">policies.google.com/privacy</span>
      </p>

      <p><strong>4.2 Railway (Hosting) & PostgreSQL (Datenbank)</strong></p>
      <p>
        Unsere Anwendung und Datenbank laufen auf Railway (railway.app) auf Servern in
        den USA (mit EU-Datenschutzgarantien). Nutzerkonten und Analysedaten werden
        in unserer PostgreSQL-Datenbank auf Railway-Infrastruktur gespeichert.
        Weitere Informationen: <span className="text-sky-600">railway.app/legal/privacy</span>
      </p>

      <p><strong>4.3 Sentry (Fehlermonitoring)</strong></p>
      <p>
        Zur Erkennung technischer Fehler setzen wir Sentry ein. Im Fehlerfall können
        technische Informationen (Fehlermeldung, Browser-Typ, anonymisierte IP) übertragen werden.
        Weitere Informationen: <span className="text-sky-600">sentry.io/privacy</span>
      </p>

      <p><strong>4.4 PostHog (Produktanalyse)</strong></p>
      <p>
        Wir nutzen PostHog EU zur Analyse von Nutzungsmustern (Seitenaufrufe, Feature-Nutzung).
        Die Daten werden pseudonymisiert erhoben, IP-Adressen vor der Speicherung gekürzt.
        Weitere Informationen: <span className="text-sky-600">posthog.com/privacy</span>
      </p>
    </Section>

    <Section title="5. Cookies & localStorage">
      <p>
        Diese Website setzt keine Tracking-Cookies ein. Wir nutzen ausschließlich technisch
        notwendige Browser-Mechanismen:
      </p>
      <ul className="list-none space-y-1 font-sans text-xs text-gray-600">
        <li>— <strong>localStorage (authToken):</strong> JWT-Authentifizierungstoken nach Login</li>
        <li>— <strong>localStorage (lang):</strong> Gewählte Sprache (de/en/ru)</li>
        <li>— <strong>localStorage (searchHistory):</strong> Lokale Suchhistorie (verlässt Ihr Gerät nicht)</li>
        <li>— <strong>localStorage (cookie-consent):</strong> Ihre Cookie-Einwilligung</li>
      </ul>
      <p>
        Analysetools (PostHog, Sentry) können technische Cookies setzen.
        Diese dienen ausschließlich der Session-Unterscheidung und enthalten keine personenbezogenen Daten.
      </p>
    </Section>

    <Section title="6. Datenlöschung & Aufbewahrungsfristen">
      <ul className="list-none space-y-1 font-sans text-xs text-gray-600">
        <li>— <strong>Server-Logs:</strong> automatische Löschung nach 7 Tagen</li>
        <li>— <strong>IP-Nutzungszähler:</strong> täglicher Reset (UTC-Mitternacht)</li>
        <li>— <strong>Anonymisierte Suchlogs:</strong> Aufbewahrung bis zu 12 Monate für Statistikzwecke</li>
        <li>— <strong>Nutzerkonten:</strong> bis zur Löschungsanfrage oder 2 Jahre Inaktivität</li>
        <li>— <strong>JWT-Token:</strong> Ablauf nach 30 Tagen; sofortige Invalidierung bei Schlüsseländerung</li>
      </ul>
      <p>
        Zur Löschung Ihres Kontos schreiben Sie an: <strong>feedback@neutralnachrichten.com</strong>
      </p>
    </Section>

    <Section title="7. Ihre Rechte (DSGVO Art. 15–22)">
      <p>Sie haben folgende Rechte gegenüber uns:</p>
      <ul className="list-none space-y-1 font-sans text-xs text-gray-600">
        <li>— <strong>Auskunft (Art. 15):</strong> Welche Daten wir über Sie speichern</li>
        <li>— <strong>Berichtigung (Art. 16):</strong> Korrektur unrichtiger Daten</li>
        <li>— <strong>Löschung (Art. 17):</strong> „Recht auf Vergessenwerden" — Kontolöschung auf Anfrage</li>
        <li>— <strong>Einschränkung (Art. 18):</strong> Einschränkung der Verarbeitung</li>
        <li>— <strong>Datenportabilität (Art. 20):</strong> Export Ihrer Daten in maschinenlesbarem Format</li>
        <li>— <strong>Widerspruch (Art. 21):</strong> Gegen Verarbeitung auf Basis berechtigten Interesses</li>
        <li>— <strong>Widerruf der Einwilligung</strong> (Google Sign-In) jederzeit möglich</li>
        <li>— <strong>Beschwerde:</strong> Bei der Berliner Beauftragten für Datenschutz und Informationsfreiheit</li>
      </ul>
      <p>Kontakt: <strong>feedback@neutralnachrichten.com</strong></p>
    </Section>

    <Section title="8. Datensicherheit">
      <p>
        Alle Übertragungen erfolgen verschlüsselt via HTTPS (TLS 1.3).
        Passwörter werden ausschließlich als bcrypt-Hash (12 Runden) gespeichert.
        JWT-Token werden mit HMAC-SHA256 signiert. Datenbankzugriff erfolgt
        ausschließlich über authentifizierte, verschlüsselte Verbindungen.
      </p>
    </Section>

    <Section title="9. Änderungen dieser Datenschutzerklärung">
      <p>
        Wir passen diese Erklärung bei Änderungen unserer Dienste oder gesetzlichen
        Anforderungen an. Die jeweils aktuelle Version ist auf dieser Seite abrufbar.
      </p>
      <p className="font-sans text-[10px] text-gray-400">Stand: Mai 2025 · Version 2.0</p>
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
        Google Gemini 2.5 Flash und Google Search Grounding aktuelle Medienberichte aus
        fünf politischen Spektren des deutschen Mediensystems analysiert und vergleicht.
      </p>
      <p>
        Die Plattform stellt <strong>keine journalistische Redaktion</strong> dar und gibt
        keine eigenen redaktionellen Meinungen wieder. Alle Analysen sind automatisch
        generiert und geben die Berichterstattung der zitierten Quellen wieder.
      </p>
    </Section>

    <Section title="3. Nutzerkonten">
      <p><strong>3.1 Registrierung</strong></p>
      <p>
        Die Registrierung ist freiwillig und ab 16 Jahren möglich. Sie können sich per
        E-Mail/Passwort oder über Google Sign-In (OAuth 2.0) registrieren.
        Bei der Registrierung akzeptieren Sie diese Nutzungsbedingungen und unsere
        Datenschutzerklärung.
      </p>

      <p><strong>3.2 Kontosicherheit</strong></p>
      <p>
        Sie sind für die Sicherheit Ihrer Zugangsdaten verantwortlich. Wählen Sie ein
        starkes Passwort (min. 8 Zeichen) und geben Sie es nicht weiter.
        Bei Verdacht auf unbefugten Zugriff informieren Sie uns umgehend.
      </p>

      <p><strong>3.3 Kontolöschung</strong></p>
      <p>
        Sie können Ihr Konto jederzeit durch Anfrage an feedback@neutralnachrichten.com löschen.
        Wir löschen alle zugehörigen personenbezogenen Daten binnen 30 Tagen.
        Anonymisierte Nutzungsstatistiken (ohne Personenbezug) können für Analysezwecke erhalten bleiben.
      </p>
    </Section>

    <Section title="4. Nutzungslimits & Zugangsstufen">
      <p>Die Plattform ist in folgenden Stufen verfügbar:</p>
      <ul className="list-none space-y-1 font-sans text-xs text-gray-600">
        <li>— <strong>Free (ohne Konto):</strong> 10 Analysen pro Tag und IP-Adresse</li>
        <li>— <strong>Free (mit Konto):</strong> 10 Analysen pro Tag, geräteübergreifende Suchhistorie</li>
        <li>— <strong>Pro:</strong> erhöhtes Tageslimit, Prioritäts-Analyse (geplant)</li>
        <li>— <strong>Enterprise:</strong> API-Zugang, unbegrenzte Analysen (auf Anfrage)</li>
      </ul>
      <p>
        Das tägliche Limit dient dem Schutz vor Missbrauch und der Sicherstellung der
        Verfügbarkeit für alle Nutzer. Es wird täglich um Mitternacht UTC zurückgesetzt.
      </p>
      <p>Folgende Handlungen sind untersagt:</p>
      <ul className="list-none space-y-1 font-sans text-xs text-gray-600">
        <li>— Automatisierte Massenanfragen (Scraping, Bots) ohne ausdrückliche Genehmigung</li>
        <li>— Umgehung von Nutzungslimits durch IP-Rotation, VPN-Wechsel oder mehrere Konten</li>
        <li>— Weitergabe von Zugangsdaten oder API-Tokens an Dritte</li>
        <li>— Weiterverkauf oder kommerzielle Nutzung der Analyseergebnisse ohne Lizenz</li>
        <li>— Verbreitung der Ergebnisse ohne Quellenangabe (neutralnachrichten.com)</li>
      </ul>
    </Section>

    <Section title="5. Google Sign-In">
      <p>
        Wenn Sie sich über Google anmelden, stimmen Sie zu, dass wir Ihre E-Mail-Adresse
        von Google erhalten und für die Kontoerstellung nutzen.
        Wir erhalten kein Google-Passwort und keinen dauerhaften Zugriff auf Ihr Google-Konto.
        Sie können die Verknüpfung jederzeit in Ihrem Google-Konto unter
        „Drittanbieter-Apps" widerrufen.
      </p>
    </Section>

    <Section title="6. Haftungsausschluss & Genauigkeit der Inhalte">
      <p>
        Die durch KI generierten Analysen sind automatisiert und können Fehler,
        Unvollständigkeiten oder Verzerrungen enthalten.
        <strong> NeutraleNachrichten übernimmt keine Haftung</strong> für die Richtigkeit,
        Vollständigkeit oder Aktualität der dargestellten Informationen.
      </p>
      <p>
        Die Plattform dient ausschließlich zur allgemeinen Information und Medienkompetenz-Förderung.
        Sie ersetzt keine professionelle journalistische, rechtliche oder politische Beratung.
        Für externe Links und die Inhalte verlinkter Websites übernehmen wir keine Haftung.
      </p>
    </Section>

    <Section title="7. Urheberrecht & Nutzungsrechte">
      <p>
        Das Design, die Software und die Strukturierung der Plattform sind urheberrechtlich
        geschützt. Nutzer dürfen Analyseergebnisse für private und nicht-kommerzielle Zwecke
        verwenden und teilen, sofern die Quelle (neutralnachrichten.com) angegeben wird.
      </p>
    </Section>

    <Section title="8. Verfügbarkeit & Änderungen">
      <p>
        Wir bemühen uns um hohe Verfügbarkeit, übernehmen jedoch keine Garantie für
        ununterbrochenen Zugang. Wir behalten uns vor, das Angebot oder Nutzungsbedingungen
        jederzeit zu ändern. Registrierte Nutzer werden über wesentliche Änderungen
        per E-Mail informiert.
      </p>
    </Section>

    <Section title="9. Anwendbares Recht">
      <p>
        Es gilt das Recht der Bundesrepublik Deutschland.
        Gerichtsstand für alle Streitigkeiten ist, soweit gesetzlich zulässig, Berlin.
      </p>
    </Section>

    <Section title="10. Kontakt">
      <p>
        Fragen zu diesen Nutzungsbedingungen richten Sie bitte an:<br />
        <strong>feedback@neutralnachrichten.com</strong>
      </p>
      <p className="font-sans text-[10px] text-gray-400">Stand: Mai 2025 · Version 2.0</p>
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
