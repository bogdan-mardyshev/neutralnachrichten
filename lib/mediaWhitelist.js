export const GERMAN_MEDIA_WHITELIST = {
  left: [
    'taz.de',
    'nd-aktuell.de',
    'jungewelt.de',
    'freitag.de',
    'neues-deutschland.de'
  ],
  center: [
    'spiegel.de',
    'sueddeutsche.de',
    'zeit.de',
    'tagesspiegel.de',
    'tagesschau.de',
    'dw.com',
    'faz.net',
    'handelsblatt.com',
    'stern.de',
    'ndr.de',
    'br.de',
    'wdr.de'
  ],
  right: [
    'welt.de',
    'bild.de',
    'jungefreiheit.de',
    'nius.de',
    'achgut.com',
    'tichyseinblick.de',
    'cicero.de'
  ]
};

export function isWhitelistedDomain(url, expectedSpectrum) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    const allowed = GERMAN_MEDIA_WHITELIST[expectedSpectrum] || [];
    return allowed.some(
      domain => hostname === domain || hostname.endsWith('.' + domain)
    );
  } catch {
    return false;
  }
}

export function getAllWhitelistedDomains() {
  return [
    ...GERMAN_MEDIA_WHITELIST.left,
    ...GERMAN_MEDIA_WHITELIST.center,
    ...GERMAN_MEDIA_WHITELIST.right
  ];
}

export function formatDomainsForPrompt() {
  return `
APPROVED GERMAN MEDIA DOMAINS (you MUST pick from these only):

LEFT / PROGRESSIVE:
${GERMAN_MEDIA_WHITELIST.left.map(d => `  - ${d}`).join('\n')}

CENTER / MAINSTREAM:
${GERMAN_MEDIA_WHITELIST.center.map(d => `  - ${d}`).join('\n')}

RIGHT / CONSERVATIVE:
${GERMAN_MEDIA_WHITELIST.right.map(d => `  - ${d}`).join('\n')}
`.trim();
}
