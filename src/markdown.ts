import { type NotionToMarkdown } from 'notion-to-md';
import { type Config } from './config';
import { type NotionPageData } from './notion/types';
import { existsSync, readFileSync } from 'fs';

export interface ImagePair {
  url: string;
  file_name: string;
}

export class Markdown {
  private readonly image_dir_prefix = 'images/notion/';

  constructor(
    private readonly config: Config,
    private readonly n2m: NotionToMarkdown,
  ) {}

  public async hasDiff(
    page: NotionPageData,
    currentMdPath: string,
  ): Promise<[boolean, ImagePair[], string]> {
    const mdblocks = await this.n2m.pageToMarkdown(page.id);
    let fromNotion = this.n2m.toMarkdownString(mdblocks);
    const images = this.getImageURLFromMd(fromNotion);
    fromNotion = this.replaceImageURLToPath(images, fromNotion);
    fromNotion = this.addHeaderToMd(page, fromNotion);

    if (!existsSync(currentMdPath)) return [true, images, fromNotion];
    let curMD = readFileSync(currentMdPath).toString();

    const imageUUIDs: string[] = [];
    for (const image of images) {
      imageUUIDs.push(this.getImageUUID(image.url));
    }

    const fromNotionForComp = this.deleteExistingImages(fromNotion, imageUUIDs);
    curMD = this.deleteExistingImages(curMD, imageUUIDs);

    return [curMD !== fromNotionForComp, images, fromNotion];
  }

  private getImageURLFromMd(md: string): ImagePair[] {
    const regex = /!\[\]\((.*)\)/g;
    const res: ImagePair[] = [];
    let m: RegExpExecArray | null = null;
    do {
      m = regex.exec(md);
      if (m?.length === 2) {
        const url = new URL(m[1]);
        const elms = url.pathname.split('.');
        const ext = elms[elms.length - 1];
        res.push({
          url: m[1],
          file_name: `${this.getImageUUID(m[1])}.${ext}`, // This is not necessary to be secure
        });
      }
    } while (m != null);

    return res;
  }

  private replaceImageURLToPath(images: ImagePair[], md: string): string {
    for (const image of images) {
      md = md.replace(
        `![](${image.url})`,
        `![${image.file_name}](${this.config.blog.asset_dir}${this.image_dir_prefix}${image.file_name})`,
      );
    }
    return md;
  }

  private getImageUUID(url: string): string {
    const u = new URL(url);
    // url.pathname should be like "secure.notion-static.com/ed17c715-4171-442d-aa50-26d18a587bae/Untitled.png"
    const paths = u.pathname.split('/');
    if (paths.length > 2) {
      return paths[paths.length - 2]; // retrieve uuid "ed17c715-4171-442d-aa50-26d18a587bae"
    }
    return '';
  }

  private addHeaderToMd(page: NotionPageData, md: string): string {
    const getRow = (tag: string): string => ` - ${tag}`;

    let tagsLines = '';
    page.tags.forEach((tag) => {
      if (tagsLines === '') {
        tagsLines = getRow(tag);
        return;
      }
      tagsLines = `${tagsLines}
${getRow(tag)}`;
    });

    return `---
title: ${page.title}
date: ${page.date}
tags:
${tagsLines}
published: true
category: ${page.category}
---
${md}`;
  }

  private deleteExistingImages(md: string, uuids: string[]): string {
    const lines = md.split(/\r?\n/);
    for (let [idx, line] of lines.entries()) {
      line = line.trim();
      if (!line.startsWith('![')) continue;

      let found = false;
      for (const uuid of uuids) {
        if (line.includes(uuid)) {
          found = true;
          break;
        }
      }
      if (found) {
        lines.splice(idx, 1);
      }
    }

    return lines.join('\n');
  }
}
