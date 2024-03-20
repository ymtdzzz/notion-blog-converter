import dotenv from 'dotenv';
import { Client, LogLevel } from '@notionhq/client';
import { NotionToMarkdown } from 'notion-to-md';
import { exit } from 'process';
import { Processor } from './processor';
import { Octokit } from 'octokit';
import { initConfig } from './config';
import { type NotionPageData } from './notion/types';
import { NotionClient } from './notion/client';
dotenv.config();

const config = initConfig();

const nclient = new Client({
  auth: config.notion.token,
  logLevel: LogLevel.DEBUG,
});

const gclient = new Octokit({ auth: config.github.pat });

const n2m = new NotionToMarkdown({ notionClient: nclient });

(async () => {
  // retrieve blog posts
  const notion = new NotionClient(
    {
      props: config.property_names,
    },
    nclient,
  );
  let pages: NotionPageData[] = [];
  try {
    pages = await notion.getByDatabaseID(config.notion.database_id);
  } catch (e) {
    console.error(`failed to get pages by database_id: ${String(e)}`);
    exit(1);
  }

  let processor: Processor | undefined;
  try {
    processor = await Processor.build(gclient, n2m, config);
    for (const page of pages) {
      await processor.process(page);
    }
  } catch (e) {
    console.error(`error occurred when handling git repository: ${String(e)}`);
  } finally {
    if (processor !== undefined) {
      processor.close();
    }
  }
})().catch((e) => {
  console.log(`error occurred: ${String(e)}`);
});
