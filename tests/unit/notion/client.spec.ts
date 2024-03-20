import { Client } from '@notionhq/client';
import type {
  EquationRichTextItemResponse,
  PageObjectResponse,
  PartialPageObjectResponse,
  PartialUserObjectResponse,
} from '@notionhq/client/build/src/api-endpoints';
import { type NotionPageData } from '../../../src/notion/types';
import { NotionClient } from '../../../src/notion/client';
import { initConfig } from '../../../src/config';

const PROP_NAME_PERMALINK = 'permalink';
const PROP_NAME_TAG = 'tag';
const PROP_NAME_CATEGORY = 'category';
const PROP_NAME_EXCLUDE = 'exclude';
const PROP_NAME_INCLUDE = 'include';
const config = initConfig();
config.property_names = {
  permalink: PROP_NAME_PERMALINK,
  tag: PROP_NAME_TAG,
  category: PROP_NAME_CATEGORY,
  exclude_checkbox: PROP_NAME_EXCLUDE,
  include_checkbox: PROP_NAME_INCLUDE,
};

describe('Notion class', () => {
  describe('getByDatabaseID', () => {
    it('can retrieve list of page data with pagination', async () => {
      const pages1 = [
        basePageObjectResponse(
          'dummy-01',
          'dummy-01',
          'categoryA',
          'https://example.com/permalink-dummy-01',
          ['tagA', 'tagB'],
        ),
        basePageObjectResponse(
          'dummy-02',
          'dummy-02 no tags',
          'categoryA',
          'https://example.com/permalink-dummy-02',
          [],
        ),
      ];
      const invalidPage: PartialPageObjectResponse = {
        object: 'page',
        id: 'dummy-03',
      };
      const pages2 = [
        invalidPage,
        basePageObjectResponse(
          'dummy-04',
          'dummy-04',
          'categoryB',
          'https://example.com/permalink-dummy-04',
          ['tagC'],
        ),
      ];
      const want: NotionPageData[] = [
        {
          id: 'dummy-01',
          title: 'dummy-01',
          category: 'categoryA',
          permalink: 'https://example.com/permalink-dummy-01',
          date: '2021-01-01',
          tags: ['tagA', 'tagB'],
        },
        {
          id: 'dummy-02',
          title: 'dummy-02 no tags',
          category: 'categoryA',
          permalink: 'https://example.com/permalink-dummy-02',
          date: '2021-01-01',
          tags: [],
        },
        {
          id: 'dummy-04',
          title: 'dummy-04',
          category: 'categoryB',
          permalink: 'https://example.com/permalink-dummy-04',
          date: '2021-01-01',
          tags: ['tagC'],
        },
      ];

      const nclient = new Client({
        auth: config.notion.token,
      });
      const spyQuery = jest.spyOn(nclient.databases, 'query');
      spyQuery.mockImplementationOnce((_args): any => {
        return {
          has_more: true,
          next_cursor: '123',
          results: pages1,
        };
      });
      spyQuery.mockImplementationOnce((_args): any => {
        return {
          has_more: false,
          next_cursor: null,
          results: pages2,
        };
      });
      const notion = new NotionClient(
        {
          props: config.property_names,
        },
        nclient,
      );

      const res = await notion.getByDatabaseID('dummy');
      expect(res).toEqual(want);
    });
  });
});

const basePageObjectResponse = (
  id: string,
  title: string,
  category: string,
  permalink: string,
  tags: string[],
): PageObjectResponse => {
  const dummyUser: PartialUserObjectResponse = {
    id: 'dummy',
    object: 'user',
  };

  const res: PageObjectResponse = {
    object: 'page',
    id,
    created_time: '2021-01-01T00:00:00.000Z',
    last_edited_time: '2021-01-01T00:00:00.000Z',
    created_by: dummyUser,
    last_edited_by: dummyUser,
    parent: {
      type: 'database_id',
      database_id: 'dummy',
    },
    archived: false,
    icon: {
      type: 'external',
      external: {
        url: 'https://example.com',
      },
    },
    cover: {
      type: 'external',
      external: {
        url: 'https://example.com',
      },
    },
    url: 'https://example.com',
    properties: {},
  };

  res.properties[PROP_NAME_PERMALINK] = {
    type: 'rich_text',
    rich_text: [richText(permalink)],
    id: 'dummy',
  };
  res.properties[PROP_NAME_TAG] = {
    type: 'multi_select',
    multi_select: tags.map((tag) => {
      return {
        id: 'dummy',
        name: tag,
        color: 'default',
      };
    }),
    id: 'dummy',
  };
  res.properties.Name = {
    type: 'title',
    title: [richText(title)],
    id: 'dummy',
  };
  res.properties[PROP_NAME_CATEGORY] = {
    type: 'select',
    select: {
      id: 'dummy',
      name: category,
      color: 'default',
    },
    id: 'dummy',
  };

  return res;
};

const richText = (text: string): EquationRichTextItemResponse => {
  return {
    type: 'equation',
    equation: {
      expression: text,
    },
    annotations: {
      bold: false,
      italic: false,
      strikethrough: false,
      underline: false,
      code: false,
      color: 'default',
    },
    plain_text: text,
    href: null,
  };
};
