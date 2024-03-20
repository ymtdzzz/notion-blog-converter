import { Client } from '@notionhq/client';
import { NotionToMarkdown } from 'notion-to-md';
import { type ImagePair, Markdown } from '../../src/markdown';
import { initConfig } from '../../src/config';
import { existsSync, readFileSync } from 'fs';

jest.mock('notion-to-md');
jest.mock('@notionhq/client');
jest.mock('fs');

interface TestCase {
  name: string;
  title: string;
  mdFromNotion: string;
  mdFromFS: string;
  wantHasDiff: boolean;
  wantImages: ImagePair[];
  wantFromNotion: string;
}

describe('Markdown class', () => {
  describe('hasDiff', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    const tests: TestCase[] = [
      {
        name: 'no changes',
        title: 'Title',
        mdFromNotion: `# Title
test article
here is an image
![](https://secure.notion-static.com/ed17c715-4171-442d-aa50-26d18a587bae/Untitled.png)

## list
- item1
- item2
- item3`,
        mdFromFS: `---
title: Title
date: 2021-01-01
tags:
 - tagA
 - tagB
published: true
category: category
---
# Title
test article
here is an image
![](https://secure.notion-static.com/ed17c715-4171-442d-aa50-26d18a587bae/Untitled.png)

## list
- item1
- item2
- item3`,
        wantFromNotion: `---
title: Title
date: 2021-01-01
tags:
 - tagA
 - tagB
published: true
category: category
---
# Title
test article
here is an image
![ed17c715-4171-442d-aa50-26d18a587bae.png](images/notion/ed17c715-4171-442d-aa50-26d18a587bae.png)

## list
- item1
- item2
- item3`,
        wantHasDiff: false,
        wantImages: [
          {
            url: 'https://secure.notion-static.com/ed17c715-4171-442d-aa50-26d18a587bae/Untitled.png',
            file_name: 'ed17c715-4171-442d-aa50-26d18a587bae.png',
          },
        ],
      },
      {
        name: 'some text has changed',
        title: 'Title',
        mdFromNotion: `# Title
test article
here is an image
![](https://secure.notion-static.com/ed17c715-4171-442d-aa50-26d18a587bae/Untitled.png)

## list
- item1
- item2
- item3
- item4`,
        mdFromFS: `---
title: Title
date: 2021-01-01
tags:
 - tagA
 - tagB
published: true
category: category
---
# Title
test article
here is an image
![](https://secure.notion-static.com/ed17c715-4171-442d-aa50-26d18a587bae/Untitled.png)

## list
- item1
- item2
- item3`,
        wantFromNotion: `---
title: Title
date: 2021-01-01
tags:
 - tagA
 - tagB
published: true
category: category
---
# Title
test article
here is an image
![ed17c715-4171-442d-aa50-26d18a587bae.png](images/notion/ed17c715-4171-442d-aa50-26d18a587bae.png)

## list
- item1
- item2
- item3
- item4`,
        wantHasDiff: true,
        wantImages: [
          {
            url: 'https://secure.notion-static.com/ed17c715-4171-442d-aa50-26d18a587bae/Untitled.png',
            file_name: 'ed17c715-4171-442d-aa50-26d18a587bae.png',
          },
        ],
      },
      {
        name: 'some images have changed', // second iamge is changed
        title: 'Title',
        mdFromNotion: `# Title
![](https://secure.notion-static.com/ed17c715-4171-442d-aa50-26d18a587bae/Untitled.png)
![](https://secure.notion-static.com/89848567-a281-40f9-9b99-2d2b63a1586a/Untitled.png)
![](https://secure.notion-static.com/067df6af-831d-4ec3-af9e-bccd7c9857d9/Untitled.png)`,
        mdFromFS: `---
title: Title
date: 2021-01-01
tags:
 - tagA
 - tagB
published: true
category: category
---
# Title
![](https://secure.notion-static.com/ed17c715-4171-442d-aa50-26d18a587bae/Untitled.png)
![](https://secure.notion-static.com/063bbb33-40dd-40f5-9987-99b0f4746d86/Untitled.png)
![](https://secure.notion-static.com/067df6af-831d-4ec3-af9e-bccd7c9857d9/Untitled.png)`,
        wantFromNotion: `---
title: Title
date: 2021-01-01
tags:
 - tagA
 - tagB
published: true
category: category
---
# Title
![ed17c715-4171-442d-aa50-26d18a587bae.png](images/notion/ed17c715-4171-442d-aa50-26d18a587bae.png)
![89848567-a281-40f9-9b99-2d2b63a1586a.png](images/notion/89848567-a281-40f9-9b99-2d2b63a1586a.png)
![067df6af-831d-4ec3-af9e-bccd7c9857d9.png](images/notion/067df6af-831d-4ec3-af9e-bccd7c9857d9.png)`,
        wantHasDiff: true,
        wantImages: [
          {
            url: 'https://secure.notion-static.com/ed17c715-4171-442d-aa50-26d18a587bae/Untitled.png',
            file_name: 'ed17c715-4171-442d-aa50-26d18a587bae.png',
          },
          {
            url: 'https://secure.notion-static.com/89848567-a281-40f9-9b99-2d2b63a1586a/Untitled.png',
            file_name: '89848567-a281-40f9-9b99-2d2b63a1586a.png',
          },
          {
            url: 'https://secure.notion-static.com/067df6af-831d-4ec3-af9e-bccd7c9857d9/Untitled.png',
            file_name: '067df6af-831d-4ec3-af9e-bccd7c9857d9.png',
          },
        ],
      },
      {
        name: 'the title has changed',
        title: 'Title-modified',
        mdFromNotion: `# Title
test article`,
        mdFromFS: `---
title: Title
date: 2021-01-01
tags:
 - tagA
 - tagB
published: true
category: category
---
# Title
test article`,
        wantFromNotion: `---
title: Title-modified
date: 2021-01-01
tags:
 - tagA
 - tagB
published: true
category: category
---
# Title
test article`,
        wantHasDiff: true,
        wantImages: [],
      },
    ];

    for (const tt of tests) {
      it(`returns valid values when ${tt.name}`, async () => {
        const n2m = new NotionToMarkdown({ notionClient: new Client() });
        const spyPageToMarkdown = jest.spyOn(n2m, 'pageToMarkdown');
        spyPageToMarkdown.mockImplementationOnce(async (_id) => {
          return [];
        });
        const spyToMarkdownString = jest.spyOn(n2m, 'toMarkdownString');
        spyToMarkdownString.mockImplementationOnce((_mdblocks) => {
          return tt.mdFromNotion;
        });
        const mockExistsSync = jest.mocked(existsSync);
        mockExistsSync.mockImplementationOnce((_) => true);
        const mockReadFilesync = jest.mocked(readFileSync);
        mockReadFilesync.mockImplementationOnce((_) => {
          return tt.mdFromFS;
        });

        const md = new Markdown(initConfig(), n2m);
        const [hasDiff, images, fromNotion] = await md.hasDiff(
          {
            id: 'page_id',
            title: tt.title,
            category: 'category',
            permalink: 'my-test-page',
            date: '2021-01-01',
            tags: ['tagA', 'tagB'],
          },
          'my/md/path',
        );
        expect(hasDiff).toBe(tt.wantHasDiff);
        expect(images).toEqual(tt.wantImages);
        expect(fromNotion).toBe(tt.wantFromNotion);
      });
    }

    it('returns valid values when the current md file does not exist', async () => {
      const n2m = new NotionToMarkdown({ notionClient: new Client() });
      const spyPageToMarkdown = jest.spyOn(n2m, 'pageToMarkdown');
      spyPageToMarkdown.mockImplementationOnce(async (_id) => {
        return [];
      });
      const spyToMarkdownString = jest.spyOn(n2m, 'toMarkdownString');
      spyToMarkdownString.mockImplementationOnce((_mdblocks) => {
        return `# Title
test article
here is an image
![](https://secure.notion-static.com/ed17c715-4171-442d-aa50-26d18a587bae/Untitled.png)

## list
- item1
- item2
- item3`;
      });
      const mockExistsSync = jest.mocked(existsSync);
      mockExistsSync.mockImplementationOnce((_) => false);
      const mockReadFilesync = jest.mocked(readFileSync);

      const md = new Markdown(initConfig(), n2m);
      const [hasDiff, images, fromNotion] = await md.hasDiff(
        {
          id: 'page_id',
          title: 'Title',
          category: 'category',
          permalink: 'my-test-page',
          date: '2021-01-01',
          tags: ['tagA', 'tagB'],
        },
        'my/md/path',
      );
      const wantImages: ImagePair[] = [
        {
          url: 'https://secure.notion-static.com/ed17c715-4171-442d-aa50-26d18a587bae/Untitled.png',
          file_name: 'ed17c715-4171-442d-aa50-26d18a587bae.png',
        },
      ];
      const wantFromNotion = `---
title: Title
date: 2021-01-01
tags:
 - tagA
 - tagB
published: true
category: category
---
# Title
test article
here is an image
![ed17c715-4171-442d-aa50-26d18a587bae.png](images/notion/ed17c715-4171-442d-aa50-26d18a587bae.png)

## list
- item1
- item2
- item3`;
      expect(mockReadFilesync).toHaveBeenCalledTimes(0);
      expect(hasDiff).toBe(true);
      expect(images).toEqual(wantImages);
      expect(fromNotion).toBe(wantFromNotion);
    });
  });
});
