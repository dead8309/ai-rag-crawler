export type Links = {
  url: string;
  text: string;
  hostname: string;
  pathname: string;
};

export type SiteData = {
  cleanedText: string;
  title: string;
};

export type ProxyScraperResponse = {
  total: number;
  links: Links[];
  data: SiteData;
};
