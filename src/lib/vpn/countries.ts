const NAME_TO_CC: Array<[RegExp, string]> = [
  [/\b(netherlands|нидерланды|holland|\bnl\b)/i, "NL"],
  [/\b(germany|германия|\bde\b|frankfurt|berlin)/i, "DE"],
  [/\b(russia|россия|\bru\b|moscow|москва)/i, "RU"],
  [/\b(finland|финляндия|\bfi\b)/i, "FI"],
  [/\b(france|франция|\bfr\b)/i, "FR"],
  [/\b(poland|польша|\bpl\b)/i, "PL"],
  [/\b(switzerland|швейцария|\bch\b)/i, "CH"],
  [/\b(sweden|швеция|\bse\b)/i, "SE"],
  [/\b(norway|норвегия|\bno\b)/i, "NO"],
  [/\b(austria|австрия|\bat\b)/i, "AT"],
  [/\b(italy|италия|\bit\b)/i, "IT"],
  [/\b(spain|испания|\bes\b)/i, "ES"],
  [/\b(uk|united kingdom|britain|великобритан|\bgb\b)/i, "GB"],
  [/\b(usa|united states|america|\bus\b)/i, "US"],
  [/\b(canada|\bca\b)/i, "CA"],
  [/\b(japan|япония|\bjp\b)/i, "JP"],
  [/\b(korea|корея|\bkr\b)/i, "KR"],
  [/\b(singapore|сингапур|\bsg\b)/i, "SG"],
  [/\b(hong.?kong|гонконг|\bhk\b)/i, "HK"],
  [/\b(taiwan|тайвань|\btw\b)/i, "TW"],
  [/\b(turkey|турция|\btr\b)/i, "TR"],
  [/\b(uae|emirates|дубай|\bae\b)/i, "AE"],
  [/\b(latvia|латвия|\blv\b)/i, "LV"],
  [/\b(lithuania|литва|\blt\b)/i, "LT"],
  [/\b(estonia|эстония|\bee\b)/i, "EE"],
  [/\b(ukraine|украина|\bua\b)/i, "UA"],
  [/\b(kazakhstan|казахстан|\bkz\b)/i, "KZ"],
  [/\b(czech|чехия|\bcz\b)/i, "CZ"],
  [/\b(romania|румыния|\bro\b)/i, "RO"],
  [/\b(bulgaria|болгария|\bbg\b)/i, "BG"],
  [/\b(hungary|венгрия|\bhu\b)/i, "HU"],
  [/\b(portugal|португалия|\bpt\b)/i, "PT"],
  [/\b(ireland|ирландия|\bie\b)/i, "IE"],
  [/\b(belgium|бельгия|\bbe\b)/i, "BE"],
  [/\b(denmark|дания|\bdk\b)/i, "DK"],
  [/\b(australia|\bau\b)/i, "AU"],
  [/\b(brazil|бразилия|\bbr\b)/i, "BR"],
  [/\b(india|индия|\bin\b)/i, "IN"],
  [/\b(moldova|молдова|\bmd\b)/i, "MD"],
  [/\b(iran|иран|\bir\b)/i, "IR"],
  [/\b(china|китай|\bcn\b)/i, "CN"],
  [/\b(vietnam|вьетнам|\bvn\b)/i, "VN"],
];

const VALID_CC = new Set(NAME_TO_CC.map(([, cc]) => cc));

function decode(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export function countryFromRemark(remark: string): string | null {
  const text = decode(remark);
  const flag = flagToCc(text);
  if (flag && VALID_CC.has(flag)) return flag;
  for (const [re, cc] of NAME_TO_CC) {
    if (re.test(text)) return cc;
  }
  const tagged = text.match(/(?:^|[^\w])([A-Z]{2})(?:[^\w]|$)/);
  if (tagged && tagged[1] && VALID_CC.has(tagged[1])) return tagged[1];
  return null;
}

export function flagToCc(text: string): string | null {
  const match = text.match(/[\u{1F1E6}-\u{1F1FF}]{2}/u);
  if (!match) return null;
  const a = match[0].codePointAt(0);
  const b = match[0].codePointAt(1);
  if (a === undefined || b === undefined) return null;
  return String.fromCharCode(a - 0x1f1e6 + 65, b - 0x1f1e6 + 65);
}

export function cleanRemark(raw: string): string {
  let s = decode(raw);
  s = s.replace(/[\u{1F1E6}-\u{1F1FF}]/gu, " ");
  s = s.replace(
    /[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE0F}\u{200D}]/gu,
    " ",
  );
  s = s.replace(/\s+/g, " ").replace(/[|┃·]+/g, " · ").trim();
  s = s.replace(/t\.me\/\S+/gi, "").trim();
  s = s.replace(/join\s*\+?\s*telegram:@\S+/gi, "").trim();
  s = s.replace(/@\w+/g, "").trim();
  if (s.length > 48) s = s.slice(0, 46).trim() + "…";
  return s || "node";
}
