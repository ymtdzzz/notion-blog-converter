import { type Client } from '@notionhq/client';
import {
  type PageObjectResponse,
  type PartialPageObjectResponse,
  type QueryDatabaseResponse,
} from '@notionhq/client/build/src/api-endpoints';
import { format } from 'date-fns';
import type { NotionConfig, NotionPageData } from './types';

export class NotionClient {
  constructor(
    private readonly _config: NotionConfig,
    private readonly client: Client,
  ) {
    this._config = _config;
    this.client = client;
  }

  /**
   * getByDatabaseID retrieves list of page data. It throws Error when failed.
   */
  public async getByDatabaseID(databaseID: string): Promise<NotionPageData[]> {
    let posts: PageObjectResponse[] = [];
    let cursor: string | undefined;
    let hasMore = false;

    try {
      do {
        const res: QueryDatabaseResponse = await this.client.databases.query({
          database_id: databaseID,
          start_cursor: cursor,
          filter: {
            and: [
              {
                property: this._config.props.exclude_checkbox,
                checkbox: {
                  equals: false,
                },
              },
              {
                property: this._config.props.include_checkbox,
                checkbox: {
                  equals: true,
                },
              },
            ],
          },
        });

        hasMore = res.has_more;
        cursor = res.next_cursor ?? undefined;
        posts = posts.concat(
          res.results.filter((v) =>
            this.isPageObjectResponse(v),
          ) as PageObjectResponse[],
        );
      } while (hasMore);
    } catch (e) {
      throw new Error(`failed to fetch the blog posts: ${String(e)}`);
    }

    const result: NotionPageData[] = [];
    for (const post of posts) {
      result.push({
        id: post.id,
        title: this.getTitle(post),
        category: this.getCategory(post),
        permalink: this.getPermalink(post),
        date: this.getDate(post),
        tags: this.getTags(post),
      });
    }

    return result;
  }

  private isPageObjectResponse(
    res: PageObjectResponse | PartialPageObjectResponse,
  ): res is PageObjectResponse {
    return 'url' in res;
  }

  private getPermalink(page: PageObjectResponse): string {
    const permalink = page.properties[this._config.props.permalink];
    if (
      permalink.type === 'rich_text' &&
      permalink.rich_text.length > 0 &&
      permalink.rich_text[0].plain_text !== ''
    ) {
      return permalink.rich_text[0].plain_text;
    }
    return format(new Date(page.created_time), 'yyyy-MM-dd-hh-mm-ss');
  }

  private getTags(page: PageObjectResponse): string[] {
    const tags = page.properties[this._config.props.tag];
    return tags.type === 'multi_select'
      ? tags.multi_select.map((val) => val.name)
      : [];
  }

  private getTitle(page: PageObjectResponse): string {
    const title = page.properties.Name;
    return title.type === 'title' && title.title.length > 0
      ? title.title[0].plain_text
      : '';
  }

  private getCategory(page: PageObjectResponse): string {
    const category = page.properties[this._config.props.category];
    return category.type === 'select' && category.select !== null
      ? category.select.name
      : '';
  }

  private getDate(page: PageObjectResponse): string {
    return format(new Date(page.last_edited_time), 'yyyy-MM-dd');
  }
}
