export interface NotionPropNames {
  permalink: string;
  tag: string;
  category: string;
  exclude_checkbox: string;
  include_checkbox: string;
}

export interface NotionConfig {
  props: NotionPropNames;
}

export interface NotionPageData {
  id: string;
  title: string;
  category: string;
  permalink: string;
  date: string;
  tags: string[];
}
