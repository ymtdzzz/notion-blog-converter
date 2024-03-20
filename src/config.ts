export interface Config {
  notion: {
    token: string;
    database_id: string;
  };
  property_names: {
    permalink: string;
    tag: string;
    category: string;
    exclude_checkbox: string;
    include_checkbox: string;
  };
  github: {
    repo: string;
    pat: string;
  };
  blog: {
    asset_dir: string;
    post_dir: string;
  };
}

export function initConfig(): Config {
  return {
    notion: {
      database_id: process.env.DATABASE_ID ?? '',
      token: process.env.NOTION_TOKEN ?? '',
    },
    property_names: {
      permalink: process.env.PROP_NAME_PERMALINK ?? '',
      tag: process.env.PROP_NAME_TAG ?? '',
      category: process.env.PROP_NAME_CATEGORY ?? '',
      exclude_checkbox: process.env.PROP_NAME_EXCLUDE ?? '',
      include_checkbox: process.env.PROP_NAME_INCLUDE ?? '',
    },
    github: {
      repo: process.env.GITHUB_REPO ?? '',
      pat: process.env.GITHUB_PAT ?? '',
    },
    blog: {
      asset_dir: process.env.BLOG_ASSET_DIR ?? '',
      post_dir: process.env.BLOG_POST_DIR ?? '',
    },
  };
}

/*
 * getRepoName returns repositoy name from github repository url.
 * ex.)
 *   input: https://github.com/username/repo.git
 *   output: repo
 */
export function getRepoName(config: Config): string {
  const elems = config.github.repo.split('/');
  if (elems.length <= 1) {
    return '';
  }
  return elems[elems.length - 1].replace('.git', '');
}
