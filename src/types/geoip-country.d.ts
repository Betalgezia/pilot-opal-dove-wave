declare module "geoip-country" {
  interface GeoIpCountryResult {
    country?: string;
  }

  interface GeoIpCountryModule {
    lookup(ip: string): GeoIpCountryResult | null;
  }

  const geoip: GeoIpCountryModule;
  export = geoip;
}
