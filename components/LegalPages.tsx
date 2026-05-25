import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { Language, translations } from '../translations';

interface Props { lang: Language }

// ── Shared newspaper-style wrapper ───────────────────────────────────────────
const LegalShell: React.FC<{ title: string; subtitle: string; lang: Language; children: React.ReactNode }> =
  ({ title, subtitle, lang, children }) => {
  const t = translations[lang];
  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <Link to="/" className="group inline-flex items-center gap-2.5 font-sans text-[11px] font-bold uppercase tracking-widest bg-[#1a1a1a] dark:bg-gray-800 text-white px-5 py-3 hover:bg-rose-600 transition-colors duration-200 mb-8">
        <span className="inline-block group-hover:-translate-x-1 transition-transform duration-200">←</span>
        {t.backToHome}
      </Link>
      <div className="border-b-2 border-[#1a1a1a] dark:border-gray-700 pb-6 mb-8">
        <div className="h-[3px] flex mb-5">
          <div className="flex-1 bg-rose-600" /><div className="flex-1 bg-orange-400" />
          <div className="flex-1 bg-slate-400" /><div className="flex-1 bg-sky-500" />
          <div className="flex-1 bg-blue-700" />
        </div>
        <p className="font-sans text-[10px] uppercase tracking-[0.25em] text-gray-400 dark:text-gray-500 mb-2">{subtitle}</p>
        <h1 className="font-serif font-black text-3xl text-[#1a1a1a] dark:text-white">{title}</h1>
      </div>
      <div className="space-y-8">{children}</div>
    </div>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="border-2 border-[#1a1a1a] dark:border-gray-700 overflow-hidden">
    <div className="bg-[#1a1a1a] dark:bg-gray-900 px-5 py-3">
      <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white">{title}</p>
    </div>
    <div className="px-5 py-5 dark:bg-[#141414] font-serif text-sm text-[#1a1a1a] dark:text-[#f0ece4] leading-relaxed space-y-3">
      {children}
    </div>
  </section>
);

// ════════════════════════════════════════════════════════════════════════════
// DATENSCHUTZERKLÄRUNG
// ════════════════════════════════════════════════════════════════════════════
export const PrivacyPage: React.FC<Props> = ({ lang }) => (
  <LegalShell title="Datenschutzerklärung" subtitle="Rechtliches · NeutralNachrichten" lang={lang}>

    <Section title="1. Verantwortlicher">
      <p>
        Verantwortlicher im Sinne der Datenschutz-Grundverordnung (DSGVO) und anderer nationaler
        Datenschutzgesetze sowie sonstiger datenschutzrechtlicher Bestimmungen ist:
      </p>
      <p className="font-sans text-xs leading-6 text-gray-700 dark:text-gray-300">
        <strong>Bogdan Mardyshev</strong><br />
        [Anschrift — bitte vor Veröffentlichung eintragen]<br />
        Deutschland<br />
        E-Mail: <strong>bogdan.mardyshev@gmail.com</strong><br />
        Website: <strong>www.neutralenachrichten.com</strong>
      </p>
    </Section>

    <Section title="2. Erhobene Daten und Zweck der Verarbeitung">
      <p><strong>2.1 Server-Protokolldaten</strong></p>
      <p>
        Bei jedem Aufruf unserer Website erfasst der Webserver automatisch technische
        Verbindungsdaten. Diese umfassen die IP-Adresse des anfragenden Geräts (wird nach
        spätestens 7 Tagen anonymisiert oder gelöscht), Datum und Uhrzeit des Zugriffs,
        Name und URL der abgerufenen Ressource, HTTP-Statuscode, übertragene Datenmenge
        sowie Angaben zu Browser-Typ und Betriebssystem (User-Agent-String). Diese Daten
        sind technisch für den sicheren Betrieb der Website erforderlich und werden nicht
        mit anderen Datenquellen zusammengeführt.
      </p>
      <p>
        <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse
        an IT-Sicherheit und technischem Betrieb).
      </p>

      <p><strong>2.2 Suchanfragen und anonymisierte Nutzungsstatistiken</strong></p>
      <p>
        Wenn Sie eine Medienanalyse durchführen, speichern wir das eingegebene Suchthema,
        den Sprachcode, den Zeitstempel der Anfrage sowie einen gekürzten SHA-256-Hash der
        IP-Adresse (16 Zeichen) in unserer Datenbank. Der Hash dient ausschließlich der
        Durchsetzung des täglichen Nutzungslimits und der Aggregation von Plattformstatistiken
        (meistgesuchte Themen, Cache-Effizienz). Eine Rückführung auf einzelne natürliche
        Personen ist auf Basis dieses Hashs allein technisch nicht möglich.
      </p>
      <p>
        Zur Durchsetzung des täglichen Nutzungslimits für nicht angemeldete Nutzer wird
        die vollständige IP-Adresse kalendertagsweise (UTC) gespeichert und nach Ablauf
        des Tages überschrieben.
      </p>
      <p>
        <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse
        an Missbrauchsschutz und Serviceverbesserung).
      </p>

      <p><strong>2.3 Nutzerkonten (freiwillige Registrierung)</strong></p>
      <p>
        Wenn Sie freiwillig ein Konto erstellen, verarbeiten wir folgende Daten:
      </p>
      <ul className="list-none space-y-1 font-sans text-xs text-gray-600 dark:text-gray-400">
        <li>— <strong>E-Mail-Adresse</strong> — zur Identifikation, Anmeldung und optionalen Kommunikation</li>
        <li>— <strong>Passwort-Hash</strong> — gespeichert ausschließlich als bcrypt-Hash (12 Runden); das Klartextpasswort verlässt Ihr Gerät nicht und wird von uns niemals gespeichert</li>
        <li>— <strong>Kontoebene</strong> (free / pro / enterprise) und tägliches Nutzungslimit</li>
        <li>— <strong>Erstellungsdatum</strong> des Kontos und Zeitstempel der letzten Anmeldung</li>
        <li>— <strong>Suchverlauf</strong> — durchgeführte Suchanfragen werden Ihrer Nutzer-ID zugeordnet, sofern Sie eingeloggt sind</li>
        <li>— <strong>Täglicher Nutzungszähler</strong> — Anzahl der genutzten Analysen am aktuellen Kalendertag</li>
      </ul>
      <p>
        Die Registrierung ist vollständig freiwillig. Ohne Konto steht die Kernfunktion
        der Plattform im Rahmen des täglichen Gratis-Limits uneingeschränkt zur Verfügung.
      </p>
      <p>
        <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. b DSGVO (Verarbeitung zur
        Erfüllung des Nutzungsvertrags).
      </p>

      <p><strong>2.4 Authentifizierungstoken (JWT)</strong></p>
      <p>
        Nach erfolgreichem Login erhalten Sie ein signiertes JSON Web Token (JWT), das im
        localStorage Ihres Browsers gespeichert wird. Das Token enthält Ihre Nutzer-ID,
        E-Mail-Adresse und Kontoebene und ist mit HMAC-SHA256 und einem serverseitigen
        Geheimschlüssel signiert. Es ist 30 Tage gültig und wird ausschließlich bei
        API-Anfragen an unsere eigene Infrastruktur übertragen.
      </p>
      <p>
        <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung).
      </p>
    </Section>

    <Section title="3. Google Sign-In (OAuth 2.0)">
      <p>
        Wir bieten die Möglichkeit, sich mit einem bestehenden Google-Konto anzumelden
        (Google OAuth 2.0). Wenn Sie diese Funktion nutzen, werden Sie zu Googles
        Authentifizierungsdienst weitergeleitet. Nach Ihrer ausdrücklichen Zustimmung
        übermittelt Google uns folgende Daten:
      </p>
      <ul className="list-none space-y-1 font-sans text-xs text-gray-600 dark:text-gray-400">
        <li>— <strong>E-Mail-Adresse</strong> des Google-Kontos</li>
        <li>— <strong>Anzeigename</strong> (optional, sofern von Google bereitgestellt)</li>
      </ul>
      <p>
        Wir speichern weder Ihr Google-Passwort noch einen dauerhaften Refresh-Token und
        haben keinen fortlaufenden Zugriff auf Ihr Google-Konto. Die OAuth-Verbindung dient
        ausschließlich der einmaligen Identitätsverifizierung zur Kontoerstellung oder
        -anmeldung. Die Google-interne Nutzer-ID wird von uns nicht persistent gespeichert.
      </p>
      <p>
        Datenschutzerklärung Google:
        <span className="text-sky-600"> policies.google.com/privacy</span>
      </p>
      <p>
        <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung)
        i.V.m. Art. 6 Abs. 1 lit. a DSGVO (Einwilligung durch aktive Nutzung von Google Sign-In).
      </p>
    </Section>

    <Section title="4. Drittanbieter und Auftragsverarbeitung">
      <p>
        Wir geben Ihre personenbezogenen Daten nicht an Dritte weiter, es sei denn,
        dies ist zur Vertragserfüllung erforderlich oder gesetzlich vorgeschrieben.
        Folgende Auftragsverarbeiter werden eingesetzt:
      </p>

      <p><strong>4.1 Google LLC — Gemini API</strong></p>
      <p>
        Zur automatisierten Analyse von Medienberichten nutzen wir die Google Gemini API.
        Suchanfragen (Thementexte) werden zur Verarbeitung an Google-Server übertragen.
        Google verarbeitet diese Daten gemäß seinen eigenen Datenschutzbestimmungen.
        Serverstandort: USA (mit Standardvertragsklauseln gemäß Art. 46 DSGVO).
        Datenschutz: <span className="text-sky-600">policies.google.com/privacy</span>
      </p>

      <p><strong>4.2 Railway Inc. — Hosting und Datenbank</strong></p>
      <p>
        Unsere Webanwendung, API-Server und PostgreSQL-Datenbank werden auf der
        Infrastruktur von Railway (railway.app) betrieben. Der aktive Serverstandort
        ist EU West (Westeuropa). Alle Nutzerdaten, Analysecaches und Serverprotokolle
        liegen auf Railway-Infrastruktur.
        Datenschutz: <span className="text-sky-600">railway.app/legal/privacy</span>
      </p>

      <p><strong>4.3 PostHog Inc. — Produktanalyse</strong></p>
      <p>
        Wir nutzen PostHog EU zur Analyse von Nutzungsmustern (Seitenaufrufe, Feature-Nutzung,
        Fehlerquoten). Daten werden pseudonymisiert erhoben; IP-Adressen werden vor der
        Speicherung auf zwei Oktette gekürzt. PostHog-Daten werden auf EU-Servern gespeichert.
        <strong> Diese Verarbeitung erfolgt nur mit Ihrer Einwilligung</strong> (Cookie-Banner).
        Sie können Ihre Einwilligung jederzeit widerrufen.
        Datenschutz: <span className="text-sky-600">posthog.com/privacy</span>
      </p>

      <p><strong>4.4 Resend Inc. — E-Mail-Versand</strong></p>
      <p>
        Für den Versand transaktionaler E-Mails (Bestätigungen, Passwort-Reset) nutzen
        wir den Dienst Resend. Dabei wird Ihre E-Mail-Adresse an Resend übermittelt.
        Datenschutz: <span className="text-sky-600">resend.com/legal/privacy-policy</span>
      </p>

      <p><strong>4.5 Sentry Inc. — Fehlermonitoring</strong></p>
      <p>
        Zur automatischen Erkennung technischer Fehler setzen wir Sentry ein. Im Fehlerfall
        können technische Diagnosedaten (Fehlermeldung, Browser-Typ, Seiten-URL, anonymisierte
        IP-Adresse) an Sentry übertragen werden. Personenbezogene Nutzerdaten werden dabei
        nicht an Sentry weitergegeben.
        Datenschutz: <span className="text-sky-600">sentry.io/privacy</span>
      </p>
    </Section>

    <Section title="5. Cookies und Browser-Speicher">
      <p>
        Wir setzen keine Tracking-Cookies ein, die personenbezogene Daten dauerhaft
        über Sitzungen hinweg nachverfolgen. Wir nutzen folgende Browser-Mechanismen:
      </p>
      <p><strong>Technisch notwendig (keine Einwilligung erforderlich, § 25 Abs. 2 TDDDG):</strong></p>
      <ul className="list-none space-y-1 font-sans text-xs text-gray-600 dark:text-gray-400">
        <li>— <strong>localStorage „authToken":</strong> JWT-Authentifizierungstoken nach Login — erforderlich für die Sitzungsverwaltung</li>
        <li>— <strong>localStorage „lang":</strong> Gewählte Anzeigesprache (de/en/ru)</li>
        <li>— <strong>localStorage „cookie-consent":</strong> Speicherung Ihrer Einwilligungsentscheidung</li>
        <li>— <strong>localStorage „searchHistory":</strong> Lokale Suchhistorie für nicht angemeldete Nutzer — verlässt Ihr Gerät nicht</li>
      </ul>
      <p><strong>Nur mit Einwilligung (Analytics, Art. 6 Abs. 1 lit. a DSGVO):</strong></p>
      <ul className="list-none space-y-1 font-sans text-xs text-gray-600 dark:text-gray-400">
        <li>— <strong>PostHog-Cookies:</strong> Pseudonyme Session-ID zur Unterscheidung von Sitzungen für Analysezwecke</li>
        <li>— <strong>Sentry-Session-Cookie:</strong> Technische Sitzungs-ID für Fehlerkorrelation</li>
      </ul>
      <p>
        Sie können Ihre Einwilligung für Analytics-Cookies jederzeit über unser Cookie-Banner
        widerrufen, ohne dass die Rechtmäßigkeit der bisherigen Verarbeitung berührt wird.
      </p>
    </Section>

    <Section title="6. Speicherdauer und Löschfristen">
      <ul className="list-none space-y-1 font-sans text-xs text-gray-600 dark:text-gray-400">
        <li>— <strong>Server-Zugriffsprotokolle:</strong> Automatische Löschung nach 7 Tagen</li>
        <li>— <strong>IP-Nutzungszähler (Rate-Limiting):</strong> Automatischer Reset täglich um 00:00 Uhr UTC</li>
        <li>— <strong>Analyse-Cache:</strong> Zwischengespeicherte KI-Analysen werden nach 24 Stunden automatisch invalidiert</li>
        <li>— <strong>Anonymisierte Suchlogs:</strong> Aufbewahrung für bis zu 12 Monate für Statistikzwecke, danach Löschung</li>
        <li>— <strong>Nutzerkonten:</strong> Bis zur Löschungsanfrage des Nutzers oder nach 2 Jahren vollständiger Inaktivität</li>
        <li>— <strong>JWT-Token:</strong> Automatischer Ablauf nach 30 Tagen; sofortige Invalidierung aller Token bei Schlüsselrotation</li>
        <li>— <strong>E-Mail-Adressen:</strong> Bis zur Kontolöschung; keine Verwendung für Marketingzwecke ohne gesonderte Einwilligung</li>
      </ul>
      <p>
        Zur Löschung Ihres Kontos und aller zugehörigen personenbezogenen Daten wenden Sie
        sich bitte an: <strong>bogdan.mardyshev@gmail.com</strong>. Löschungsanfragen werden
        innerhalb von 30 Tagen bearbeitet.
      </p>
    </Section>

    <Section title="7. Ihre Rechte nach der DSGVO (Art. 15–22)">
      <p>
        Sie haben gegenüber uns jederzeit folgende Rechte bezüglich Ihrer
        personenbezogenen Daten:
      </p>
      <ul className="list-none space-y-1 font-sans text-xs text-gray-600 dark:text-gray-400">
        <li>— <strong>Auskunft (Art. 15 DSGVO):</strong> Bestätigung, ob und welche personenbezogenen Daten wir über Sie verarbeiten, sowie Auskunft über Verarbeitungszweck, Empfänger und Speicherdauer</li>
        <li>— <strong>Berichtigung (Art. 16 DSGVO):</strong> Unverzügliche Berichtigung unrichtiger oder Vervollständigung unvollständiger Daten</li>
        <li>— <strong>Löschung (Art. 17 DSGVO):</strong> Löschung Ihrer personenbezogenen Daten, sofern kein gesetzlicher Aufbewahrungsgrund entgegensteht („Recht auf Vergessenwerden")</li>
        <li>— <strong>Einschränkung der Verarbeitung (Art. 18 DSGVO):</strong> Einschränkung der Verarbeitung unter den gesetzlichen Voraussetzungen</li>
        <li>— <strong>Datenübertragbarkeit (Art. 20 DSGVO):</strong> Erhalt Ihrer Daten in einem strukturierten, gängigen, maschinenlesbaren Format</li>
        <li>— <strong>Widerspruch (Art. 21 DSGVO):</strong> Widerspruch gegen die Verarbeitung auf Basis unseres berechtigten Interesses aus Gründen Ihrer besonderen Situation</li>
        <li>— <strong>Widerruf der Einwilligung:</strong> Widerruf einer erteilten Einwilligung jederzeit mit Wirkung für die Zukunft</li>
      </ul>
      <p>
        Zur Ausübung Ihrer Rechte wenden Sie sich bitte an:
        <strong> bogdan.mardyshev@gmail.com</strong>
      </p>
      <p>
        <strong>Beschwerderecht:</strong> Sie haben das Recht, sich bei einer zuständigen
        Datenschutzaufsichtsbehörde zu beschweren. Die nationale Aufsichtsbehörde ist der
        Bundesbeauftragte für den Datenschutz und die Informationsfreiheit (BfDI):
        <span className="text-sky-600"> bfdi.bund.de</span>
      </p>
    </Section>

    <Section title="8. Datensicherheit">
      <p>
        Wir setzen technische und organisatorische Sicherheitsmaßnahmen ein, um Ihre
        Daten gegen unberechtigten Zugriff, Verlust oder Manipulation zu schützen:
      </p>
      <ul className="list-none space-y-1 font-sans text-xs text-gray-600 dark:text-gray-400">
        <li>— Alle Datenübertragungen erfolgen ausschließlich verschlüsselt via HTTPS (TLS 1.2 oder höher)</li>
        <li>— Passwörter werden ausschließlich als bcrypt-Hash mit 12 Runden gespeichert; Klartextpasswörter werden weder übertragen noch gespeichert</li>
        <li>— JWT-Token werden mit HMAC-SHA256 signiert und serverseitig validiert</li>
        <li>— Datenbankzugriffe erfolgen ausschließlich über authentifizierte, verschlüsselte Verbindungen</li>
        <li>— Zugangsdaten zur Infrastruktur werden nicht im Quellcode versioniert</li>
      </ul>
      <p>
        Bei einem Datenschutzvorfall, der voraussichtlich ein Risiko für Ihre Rechte und
        Freiheiten darstellt, werden Sie gemäß Art. 34 DSGVO unverzüglich informiert.
      </p>
    </Section>

    <Section title="9. Änderungen dieser Datenschutzerklärung">
      <p>
        Wir behalten uns vor, diese Datenschutzerklärung bei Änderungen unserer Dienste,
        der eingesetzten Technologien oder der gesetzlichen Anforderungen anzupassen.
        Die jeweils gültige Version ist stets unter www.neutralenachrichten.com/privacy
        abrufbar. Bei wesentlichen Änderungen werden registrierte Nutzer per E-Mail informiert.
      </p>
      <p className="font-sans text-[10px] text-gray-400">Stand: Mai 2025 · Version 3.0</p>
    </Section>

  </LegalShell>
);

// ════════════════════════════════════════════════════════════════════════════
// AGB / NUTZUNGSBEDINGUNGEN
// ════════════════════════════════════════════════════════════════════════════
export const TermsPage: React.FC<Props> = ({ lang }) => (
  <LegalShell title="Nutzungsbedingungen" subtitle="Rechtliches · NeutralNachrichten" lang={lang}>

    <Section title="§ 1 Geltungsbereich und Vertragspartner">
      <p>
        Diese Nutzungsbedingungen gelten für die Nutzung der Plattform NeutralNachrichten
        unter <strong>www.neutralenachrichten.com</strong> sowie aller zugehörigen APIs und
        Dienste (nachfolgend „Plattform"). Vertragspartner ist Bogdan Mardyshev
        (bogdan.mardyshev@gmail.com).
      </p>
      <p>
        Mit dem Zugriff auf die Plattform oder der Erstellung eines Nutzerkontos erklären
        Sie sich mit diesen Nutzungsbedingungen und unserer Datenschutzerklärung
        einverstanden. Falls Sie diesen Bedingungen nicht zustimmen, nutzen Sie die
        Plattform bitte nicht.
      </p>
    </Section>

    <Section title="§ 2 Leistungsbeschreibung">
      <p>
        NeutralNachrichten ist eine KI-gestützte Informationsplattform, die mithilfe von
        Google Gemini und Google Search Grounding aktuelle Medienberichte aus verschiedenen
        politischen Spektren des deutschen Mediensystems automatisiert analysiert und
        gegenüberstellt.
      </p>
      <p>
        Die Plattform stellt <strong>keine journalistische Redaktion</strong> dar und gibt
        keine eigenen redaktionellen Meinungen wieder. Alle dargestellten Analysen sind
        automatisch durch KI-Systeme generiert und geben die Berichterstattung der jeweils
        zitierten Quellen wieder. Die Analysen dienen ausschließlich der allgemeinen
        Information und der Förderung von Medienkompetenz. Sie ersetzen keine professionelle
        journalistische, rechtliche oder politische Beratung.
      </p>
      <p>
        Der Betreiber behält sich vor, Funktionen der Plattform jederzeit zu ändern,
        zu erweitern oder einzustellen.
      </p>
    </Section>

    <Section title="§ 3 Nutzerkonten">
      <p><strong>3.1 Registrierung</strong></p>
      <p>
        Die Registrierung ist freiwillig und setzt ein Mindestalter von 16 Jahren voraus.
        Sie können sich mit E-Mail-Adresse und Passwort oder über Google Sign-In (OAuth 2.0)
        registrieren. Bei der Registrierung verpflichten Sie sich, korrekte und vollständige
        Angaben zu machen und diese aktuell zu halten.
      </p>

      <p><strong>3.2 Kontosicherheit</strong></p>
      <p>
        Sie sind für die Vertraulichkeit Ihrer Zugangsdaten verantwortlich und haften für
        alle Aktivitäten, die unter Ihrem Konto vorgenommen werden. Wählen Sie ein
        hinreichend starkes Passwort (mindestens 8 Zeichen) und geben Sie es nicht an Dritte
        weiter. Bei Verdacht auf unbefugten Zugriff sind Sie verpflichtet, uns unverzüglich
        unter bogdan.mardyshev@gmail.com zu informieren.
      </p>

      <p><strong>3.3 Kontolöschung</strong></p>
      <p>
        Sie können Ihr Konto jederzeit und ohne Angabe von Gründen durch eine formlose
        E-Mail an bogdan.mardyshev@gmail.com löschen lassen. Wir löschen alle zugehörigen
        personenbezogenen Daten binnen 30 Tagen. Anonymisierte Nutzungsstatistiken ohne
        Personenbezug können für Analysezwecke erhalten bleiben.
      </p>
    </Section>

    <Section title="§ 4 Nutzungslimits und zulässige Nutzung">
      <p>Die Plattform ist in folgenden Zugangsstufen verfügbar:</p>
      <ul className="list-none space-y-1 font-sans text-xs text-gray-600 dark:text-gray-400">
        <li>— <strong>Ohne Konto:</strong> begrenzte Anzahl Analysen pro Tag und IP-Adresse</li>
        <li>— <strong>Free-Konto:</strong> gleiches Tageslimit, jedoch geräteübergreifende Suchhistorie</li>
        <li>— <strong>Pro-Konto:</strong> erhöhtes Tageslimit und Prioritäts-Analyse (geplant)</li>
      </ul>
      <p>
        Das tägliche Limit dient dem Schutz vor Missbrauch und der Sicherstellung der
        Verfügbarkeit für alle Nutzer. Es wird täglich um 00:00 Uhr UTC zurückgesetzt.
      </p>
      <p>Folgende Handlungen sind ausdrücklich untersagt:</p>
      <ul className="list-none space-y-1 font-sans text-xs text-gray-600 dark:text-gray-400">
        <li>— Automatisierte Massenanfragen durch Skripte, Bots oder Crawler ohne vorherige schriftliche Genehmigung</li>
        <li>— Umgehung von Nutzungslimits durch IP-Rotation, VPN-Wechsel, mehrere Konten oder andere technische Mittel</li>
        <li>— Weitergabe von Zugangsdaten oder API-Tokens an Dritte</li>
        <li>— Gewerbliche Weiterveräußerung oder Lizenzierung von Analyseergebnissen ohne ausdrückliche schriftliche Genehmigung</li>
        <li>— Verbreitung von Analyseergebnissen ohne Quellenangabe (www.neutralenachrichten.com)</li>
        <li>— Jede Nutzung, die gegen geltendes Recht, insbesondere deutsches Urheber-, Presse- oder Datenschutzrecht, verstößt</li>
      </ul>
    </Section>

    <Section title="§ 5 Haftungsausschluss und Genauigkeit der Inhalte">
      <p>
        Die durch KI-Systeme generierten Analysen sind automatisiert erstellt und können
        Fehler, Unvollständigkeiten, veraltete Informationen oder inhaltliche Verzerrungen
        enthalten. <strong>Der Betreiber übernimmt keine Haftung</strong> für die Richtigkeit,
        Vollständigkeit oder Aktualität der dargestellten Informationen.
      </p>
      <p>
        Die Haftung für Schäden, die durch die Nutzung oder Nichtnutzbarkeit der Plattform
        entstehen, ist — soweit gesetzlich zulässig — ausgeschlossen. Dies gilt nicht für
        Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit sowie für
        vorsätzlich oder grob fahrlässig verursachte Schäden.
      </p>
      <p>
        Für externe Links und die Inhalte verlinkter Drittseiten übernehmen wir keine
        Haftung. Die verlinkten Seiten wurden zum Zeitpunkt der Verlinkung auf mögliche
        Rechtsverstöße überprüft.
      </p>
    </Section>

    <Section title="§ 6 Urheberrecht und Nutzungsrechte">
      <p>
        Das Design, der Quellcode und die Struktur der Plattform NeutralNachrichten sind
        urheberrechtlich geschützt und Eigentum von Bogdan Mardyshev. Alle Rechte vorbehalten.
      </p>
      <p>
        Nutzer erhalten das nicht-exklusive, nicht-übertragbare Recht, die Plattform
        für private und nicht-kommerzielle Zwecke zu nutzen. Die Weitergabe von
        Analyseergebnissen ist unter Angabe der Quelle (www.neutralenachrichten.com)
        für private Zwecke gestattet.
      </p>
      <p>
        RSS-Inhalte und Nachrichtenartikel, die als Basis für Analysen dienen, sind
        Eigentum der jeweiligen Verlage und Medienanbieter. Wir beanspruchen kein
        Eigentum an diesen Inhalten.
      </p>
    </Section>

    <Section title="§ 7 Verfügbarkeit des Dienstes">
      <p>
        Wir bemühen uns nach Kräften um eine hohe Verfügbarkeit der Plattform, übernehmen
        jedoch keine Garantie für einen ununterbrochenen, fehlerfreien Betrieb. Geplante
        Wartungsarbeiten oder unvorhergesehene technische Störungen können zu vorübergehenden
        Einschränkungen führen. Ein Anspruch auf eine bestimmte Verfügbarkeit oder auf
        Schadenersatz bei Nichtverfügbarkeit besteht nicht.
      </p>
    </Section>

    <Section title="§ 8 Änderungen der Nutzungsbedingungen">
      <p>
        Wir behalten uns vor, diese Nutzungsbedingungen jederzeit zu ändern. Registrierte
        Nutzer werden über wesentliche Änderungen per E-Mail informiert. Die weitere
        Nutzung der Plattform nach dem Inkrafttreten geänderter Bedingungen gilt als
        Zustimmung zu den geänderten Bedingungen.
      </p>
    </Section>

    <Section title="§ 9 Anwendbares Recht und Gerichtsstand">
      <p>
        Es gilt ausschließlich das Recht der Bundesrepublik Deutschland unter Ausschluss
        des UN-Kaufrechts (CISG). Gerichtsstand für alle Streitigkeiten aus oder im
        Zusammenhang mit diesen Nutzungsbedingungen ist, soweit gesetzlich zulässig,
        der Wohnort des Betreibers.
      </p>
      <p>
        Sollten einzelne Bestimmungen dieser Nutzungsbedingungen unwirksam oder
        undurchführbar sein oder werden, bleibt die Wirksamkeit der übrigen Bestimmungen
        hiervon unberührt (Salvatorische Klausel).
      </p>
    </Section>

    <Section title="§ 10 Kontakt">
      <p>
        Für Fragen zu diesen Nutzungsbedingungen oder zur Plattform wenden Sie sich bitte an:
      </p>
      <p className="font-sans text-xs text-gray-700 dark:text-gray-300">
        Bogdan Mardyshev<br />
        E-Mail: <strong>bogdan.mardyshev@gmail.com</strong>
      </p>
      <p className="font-sans text-[10px] text-gray-400">Stand: Mai 2025 · Version 3.0</p>
    </Section>

  </LegalShell>
);

// ════════════════════════════════════════════════════════════════════════════
// IMPRESSUM
// ════════════════════════════════════════════════════════════════════════════
export const ImprintPage: React.FC<Props> = ({ lang }) => (
  <LegalShell title="Impressum" subtitle="Rechtliches · NeutralNachrichten" lang={lang}>

    <Section title="Angaben gemäß § 5 TMG">
      <p className="font-sans text-xs leading-7 text-gray-700 dark:text-gray-300">
        <strong>Bogdan Mardyshev</strong><br />
        [Anschrift — bitte vor Veröffentlichung eintragen]<br />
        Deutschland<br />
        <br />
        E-Mail: <strong>bogdan.mardyshev@gmail.com</strong><br />
        Website: <strong>www.neutralenachrichten.com</strong>
      </p>
    </Section>

    <Section title="Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV">
      <p className="font-sans text-xs leading-6 text-gray-700 dark:text-gray-300">
        Bogdan Mardyshev<br />
        Anschrift wie oben
      </p>
    </Section>

    <Section title="Hinweis zur Nutzung von KI-Systemen">
      <p>
        Diese Plattform nutzt KI-Systeme (Google Gemini) zur automatisierten Analyse von
        Nachrichteninhalten. Die Analyseergebnisse werden vollständig maschinell generiert
        und spiegeln nicht die Meinung des Betreibers wider. Der Betreiber übernimmt keine
        redaktionelle Verantwortung für automatisch generierte Analyse-Texte.
      </p>
      <p>
        Für Hinweise auf fehlerhafte oder rechtlich bedenkliche Inhalte wenden Sie sich
        bitte an bogdan.mardyshev@gmail.com. Wir prüfen Hinweise zeitnah und ergreifen
        bei berechtigten Beanstandungen umgehend Maßnahmen.
      </p>
    </Section>

    <Section title="Inhalt und Haftungsausschluss">
      <p>
        Die Inhalte dieser Website wurden mit größtmöglicher Sorgfalt erstellt.
        Für die Richtigkeit, Vollständigkeit und Aktualität der Inhalte — insbesondere
        der automatisch generierten Analysen — können wir jedoch keine Gewähr übernehmen.
      </p>
      <p>
        Als Diensteanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene Inhalte auf
        diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG
        sind wir als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder
        gespeicherte fremde Informationen zu überwachen oder nach Umständen zu forschen,
        die auf eine rechtswidrige Tätigkeit hinweisen.
      </p>
    </Section>

    <Section title="Urheberrecht">
      <p>
        Die durch den Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten
        unterliegen dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung,
        Verbreitung und jede Art der Verwertung außerhalb der Grenzen des Urheberrechtes
        bedürfen der schriftlichen Zustimmung des Betreibers. Downloads und Kopien dieser
        Seite sind nur für den privaten, nicht kommerziellen Gebrauch gestattet.
      </p>
      <p>
        Soweit die Inhalte auf dieser Seite nicht vom Betreiber erstellt wurden (insbesondere
        RSS-Inhalte und Nachrichtenartikel Dritter), werden die Urheberrechte Dritter beachtet
        und entsprechend gekennzeichnet. Sollten Sie trotzdem auf eine Urheberrechtsverletzung
        aufmerksam werden, bitten wir um einen entsprechenden Hinweis.
      </p>
    </Section>

    <Section title="Streitschlichtung (ODR)">
      <p>
        Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit,
        die unter folgendem Link erreichbar ist:
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
  const metaMap: Record<string, { title: string; desc: string; canonical: string }> = {
    privacy: {
      title: 'Datenschutzerklärung – NeutralNachrichten',
      desc: 'Datenschutzerklärung von NeutralNachrichten. Informationen zur Verarbeitung personenbezogener Daten gemäß DSGVO.',
      canonical: 'https://www.neutralenachrichten.com/privacy',
    },
    terms: {
      title: 'Nutzungsbedingungen – NeutralNachrichten',
      desc: 'Nutzungsbedingungen für NeutralNachrichten. Bitte lesen Sie diese vor der Nutzung unserer Dienste.',
      canonical: 'https://www.neutralenachrichten.com/terms',
    },
    imprint: {
      title: 'Impressum – NeutralNachrichten',
      desc: 'Impressum von NeutralNachrichten gemäß § 5 TMG.',
      canonical: 'https://www.neutralenachrichten.com/imprint',
    },
  };
  const meta = metaMap[type] || metaMap.imprint;
  return (
    <>
      <Helmet>
        <title>{meta.title}</title>
        <meta name="description" content={meta.desc} />
        <link rel="canonical" href={meta.canonical} />
        <meta property="og:title" content={meta.title} />
        <meta property="og:description" content={meta.desc} />
        <meta property="og:url" content={meta.canonical} />
        <meta name="robots" content="noindex, follow" />
      </Helmet>
      {type === 'privacy' ? <PrivacyPage lang={lang} /> : type === 'terms' ? <TermsPage lang={lang} /> : <ImprintPage lang={lang} />}
    </>
  );
};
