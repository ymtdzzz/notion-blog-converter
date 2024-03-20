import { format } from 'date-fns';
import * as fs from 'fs';
import type { Octokit } from 'octokit';
import simpleGit, { type SimpleGit } from 'simple-git';
import type { NotionPageData } from './notion/types';
import download from 'image-downloader';
import { getRepoName, type Config } from './config';
import { Markdown } from './markdown';
import { type NotionToMarkdown } from 'notion-to-md';

interface ImagePair {
  url: string;
  file_name: string;
}

/**
 * Processor is a class to process Notion pages.
 * All operations should be executed in try-catch block.
 * Don't forget to call close() in finally block.
 */
export class Processor {
  private readonly image_dir_prefix = 'images/notion/';
  private readonly branch_local_prefix = 'auto-generate/';
  private readonly branch_remote_prefix = `remotes/origin/${this.branch_local_prefix}`;
  private branches: string[] = [];
  private github_user = '';

  private constructor(
    private readonly git: SimpleGit,
    private readonly github: Octokit,
    private readonly working_dir: string,
    private readonly config: Config,
    private readonly md: Markdown,
  ) {
    this.git = git;
    this.working_dir = working_dir;
  }

  public close(): void {
    console.log('deleting tmp dir...');
    fs.rmSync(this.working_dir, { recursive: true, force: true });
  }

  public static async build(
    githubClient: Octokit,
    n2m: NotionToMarkdown,
    config: Config,
  ): Promise<Processor> {
    const workdir = './tmp/';

    fs.mkdirSync(workdir);
    console.log(`repository cloned on ${workdir}`);

    const git = simpleGit({
      baseDir: `${process.cwd()}/tmp`,
      binary: 'git',
      maxConcurrentProcesses: 6,
      trimmed: false,
    });
    const md = new Markdown(config, n2m);
    const res = new Processor(git, githubClient, workdir, config, md);
    const user = await githubClient.rest.users.getAuthenticated();
    res.github_user = user.data.login;

    await git.clone(config.github.repo, '.');
    const summary = await res.git.branch();
    res.branches = summary.all.filter((v) =>
      v.startsWith(res.branch_remote_prefix),
    );

    return res;
  }

  public async process(page: NotionPageData): Promise<void> {
    if (!this.branchExists(page.permalink)) {
      console.log('branch not exists. create new branch from main branch...');
      await this.git.checkoutLocalBranch(
        `${this.branch_local_prefix}${page.permalink}`,
      );
      console.log('Done');
    } else {
      console.log(
        'branch already exists. check out a branch from remote branch...',
      );
      await this.git.checkoutBranch(
        `${this.branch_local_prefix}${page.permalink}`,
        `${this.branch_remote_prefix}${page.permalink}`,
      );
      console.log('Done');
    }

    console.log('checking diff...');
    const [hasDiff, images, mdFromNotion] = await this.md.hasDiff(
      page,
      this.getMdPath(page),
    );
    if (!hasDiff) {
      console.log('this page has no diffs. nothing to do.');
      return;
    }

    if (images.length > 0) {
      console.log('image downloading...');
      await this.downloadImages(images);
      console.log('Done');
    }

    // commit and push
    console.log('some diff detected. updating or creating md...');
    fs.mkdirSync(this.getMdDir(page), { recursive: true });
    fs.writeFileSync(this.getMdPath(page), mdFromNotion);
    console.log('Done');

    console.log('commit and push...');
    await this.git.add(this.getMdPathForGit(page));
    await this.git.add(`${this.getImageDirForGit()}/*`);
    await this.git.commit(`update post ${page.permalink}`);
    await this.git.push(
      'origin',
      `${this.branch_local_prefix}${page.permalink}`,
      { '--set-upstream': null },
    );
    console.log('Done');

    // create PR if not exists
    const pr = await this.github.rest.search.issuesAndPullRequests({
      q: `is:pr is:open "${this.getPRTitle(page)}"`,
    });
    if (pr.data.total_count === 0) {
      console.log('PR is not found, creating...');
      await this.github.rest.pulls.create({
        owner: this.github_user,
        repo: getRepoName(this.config),
        head: `${this.github_user}:${this.branch_local_prefix}${page.permalink}`,
        base: 'main',
        title: this.getPRTitle(page),
      });
      console.log('Done');
      return;
    }
    console.log('PR already exists');
  }

  private branchExists(permalink: string): boolean {
    return (
      this.branches.find(
        (v) => v === `${this.branch_remote_prefix}${permalink}`,
      ) !== undefined
    );
  }

  private getMdPath(page: NotionPageData): string {
    return `${this.getMdDir(page)}${page.permalink}.md`;
  }

  private getMdDir(page: NotionPageData): string {
    return `${this.working_dir}${this.getMdDirForGit(page)}`;
  }

  private getImageDir(): string {
    return `${this.working_dir}${this.image_dir_prefix}`;
  }

  private getMdPathForGit(page: NotionPageData): string {
    return `${this.getMdDirForGit(page)}${page.permalink}.md`;
  }

  private getImageDirForGit(): string {
    return `${this.image_dir_prefix}`;
  }

  private getMdDirForGit(page: NotionPageData): string {
    const createdDate = new Date(page.date);
    return `${this.config.blog.post_dir}${format(createdDate, 'yyyy/MM')}/`;
  }

  private getPRTitle(page: NotionPageData): string {
    return `[AUTO-GENERATED] ${page.permalink}`;
  }

  private async downloadImages(images: ImagePair[]): Promise<void> {
    for (const image of images) {
      console.log(`downloading image: ${image.url}`);
      await download.image({
        url: image.url,
        dest: `${process.cwd()}/${this.getImageDir()}${image.file_name}`,
      });
      console.log('OK');
    }
  }
}
