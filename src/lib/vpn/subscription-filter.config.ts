export const WHITELIST_DOMAINS = [
  "2gis.com",
  "2gis.ru",
  "alfabank.ru",
  "avito.ru",
  "avito.st",
  "auto.ru",
  "dzen.ru",
  "gosuslugi.ru",
  "government.ru",
  "hh.ru",
  "kinopoisk.ru",
  "kp.ru",
  "kremlin.ru",
  "mail.ru",
  "max.ru",
  "mts.ru",
  "ok.ru",
  "ozon.ru",
  "pochta.ru",
  "rzd.ru",
  "ria.ru",
  "rutube.ru",
  "sber.ru",
  "sberbank.ru",
  "tbank.ru",
  "tinkoff.ru",
  "vk.com",
  "vk.ru",
  "wb.ru",
  "wildberries.ru",
  "yandex.com",
  "yandex.net",
  "yandex.ru",
] as const;

// Kept as a static list on purpose: it can be expanded without changing filter logic.
export const WHITELIST_CIDRS: readonly string[] = [];

// Starts empty. Users can add custom CIDRs/domains through the Export panel.
export const DEFAULT_BLACKLIST: readonly string[] = [];
