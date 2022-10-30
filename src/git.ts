import { format } from "date-fns";
import * as fs from "fs";
import { Octokit } from "octokit";
import simpleGit, { SimpleGit } from "simple-git";
import { NotionPageData } from "./notion";
import download from "image-downloader";
import { Config } from "./config";

interface ImagePair {
  url: string;
  file_name: string;
}

/**
 * All operations should be executed in try-catch block.
 * Don't forget to call close() in finally block.
 */
export class Git {
  private _image_dir_prefix = "images/notion/";
  private _branch_local_prefix = "auto-generate/";
  private _branch_remote_prefix = `remotes/origin/${this._branch_local_prefix}`;
  private _branches: string[] = [];
  private _blog_assert_dir = ""; // ex.) "../src/assets/"
  private _blog_post_dir = ""; // ex.) "content/posts/"
  private _github_repo_name = "";
  private _github_user = "";

  private constructor(
    private _git: SimpleGit,
    private _github: Octokit,
    private _working_dir: string
  ) {
    this._git = _git;
    this._working_dir = _working_dir;
  }

  get branches() {
    return this._branches;
  }

  public close() {
    console.log("deleting tmp dir...");
    fs.rmSync(this._working_dir, { recursive: true, force: true });
  }

  public static async build(
    github_client: Octokit,
    config: Config
  ): Promise<Git> {
    const workdir = "./tmp/";

    fs.mkdirSync(workdir);
    console.log(`repository cloned on ${workdir}`);

    const git = simpleGit({
      baseDir: `${process.cwd()}/tmp`,
      binary: "git",
      maxConcurrentProcesses: 6,
      trimmed: false,
    });
    const res = new Git(git, github_client, workdir);
    res._blog_assert_dir = config.blog.asset_dir;
    res._blog_post_dir = config.blog.post_dir;
    const github_repo_elems = config.github.repo.split("/");
    res._github_repo_name = github_repo_elems[
      github_repo_elems.length - 1
    ].replace(".git", "");
    const user = await github_client.rest.users.getAuthenticated();
    res._github_user = user.data.login;

    try {
      await git.clone(config.github.repo, ".");
      const summary = await res._git.branch();
      res._branches = summary.all.filter((v) =>
        v.startsWith(res._branch_remote_prefix)
      );
    } catch (e) {
      throw e;
    }

    return res;
  }

  public async process(page: NotionPageData, md: string) {
    const images = this.getImageURLFromMd(md);
    md = this.replaceImageURLToPath(images, md);
    md = this.addHeaderToMd(page, md);

    if (!this.branchExists(page.permalink)) {
      console.log("branch not exists. create new branch from main branch...");
      await this._git.checkoutLocalBranch(
        `${this._branch_local_prefix}${page.permalink}`
      );
      console.log("Done");
    } else {
      console.log(
        "branch already exists. check out a branch from remote branch..."
      );
      await this._git.checkoutBranch(
        `${this._branch_local_prefix}${page.permalink}`,
        `${this._branch_remote_prefix}${page.permalink}`
      );
      console.log("Done");
    }

    console.log("checking diff...");
    if (!this.hasDiff(page, md, images)) {
      console.log("this page has no diffs. nothing to do.");
      return;
    }

    console.log("image downloading...");
    await this.downloadImages(images);
    console.log("Done");

    // commit and push
    console.log("some diff detected. updating or creating md...");
    fs.mkdirSync(this.getMdDir(page), { recursive: true });
    fs.writeFileSync(this.getMdPath(page), md);
    console.log("Done");

    console.log("commit and push...");
    await this._git.add(this.getMdPathForGit(page));
    await this._git.add(`${this.getImageDirForGit()}/*`);
    await this._git.commit(`update post ${page.permalink}`);
    await this._git.push(
      "origin",
      `${this._branch_local_prefix}${page.permalink}`,
      { "--set-upstream": null }
    );
    console.log("Done");

    // create PR if not exists
    const pr = await this._github.rest.search.issuesAndPullRequests({
      q: `is:pr is:open "${this.getPRTitle(page)}"`,
    });
    if (pr.data.total_count === 0) {
      console.log("PR is not found, creating...");
      await this._github.rest.pulls.create({
        owner: this._github_user,
        repo: this._github_repo_name,
        head: `${this._github_user}:${this._branch_local_prefix}${page.permalink}`,
        base: "main",
        title: this.getPRTitle(page),
      });
      console.log("Done");
      return;
    }
    console.log("PR already exists");
  }

  private branchExists(permalink: string): boolean {
    return (
      this._branches.find(
        (v) => v === `${this._branch_remote_prefix}${permalink}`
      ) !== undefined
    );
  }

  private hasDiff(
    page: NotionPageData,
    md: string,
    images: ImagePair[]
  ): boolean {
    const path = this.getMdPath(page);

    if (!fs.existsSync(path)) return true;

    const image_uuids: string[] = [];
    for (const image of images) {
      image_uuids.push(this.getImageUUID(image.url));
    }
    let cur_md = fs.readFileSync(path).toString();
    md = this.deleteExistingImages(md, image_uuids);
    cur_md = this.deleteExistingImages(cur_md, image_uuids);

    return cur_md !== md;
  }

  private deleteExistingImages(md: string, uuids: string[]): string {
    const lines = md.split(/\r?\n/);
    for (let [idx, line] of lines.entries()) {
      line = line.trim();
      if (!line.startsWith("![")) continue;

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

    return lines.join("\n");
  }

  private getImageUUID(url: string): string {
    const u = new URL(url);
    // url.pathname should be like "secure.notion-static.com/ed17c715-4171-442d-aa50-26d18a587bae/Untitled.png"
    const paths = u.pathname.split("/");
    if (paths.length > 2) {
      return paths[paths.length - 2]; // retrieve uuid "ed17c715-4171-442d-aa50-26d18a587bae"
    }
    return "";
  }

  private getMdPath(page: NotionPageData): string {
    return `${this.getMdDir(page)}${page.permalink}.md`;
  }

  private getMdDir(page: NotionPageData): string {
    return `${this._working_dir}${this.getMdDirForGit(page)}`;
  }

  private getImageDir(): string {
    return `${this._working_dir}${this._image_dir_prefix}`;
  }

  private getMdPathForGit(page: NotionPageData): string {
    return `${this.getMdDirForGit(page)}${page.permalink}.md`;
  }

  private getImageDirForGit(): string {
    return `${this._image_dir_prefix}`;
  }

  private getMdDirForGit(page: NotionPageData): string {
    const created_date = new Date(page.date);
    return `${this._blog_post_dir}${format(created_date, "yyyy/MM")}/`;
  }

  private getPRTitle(page: NotionPageData): string {
    return `[AUTO-GENERATED] ${page.permalink}`;
  }

  private getImageURLFromMd(md: string): ImagePair[] {
    const regex = /\!\[\]\((.*)\)/g;
    const res: ImagePair[] = [];
    let m: RegExpExecArray | null = null;
    do {
      m = regex.exec(md);
      if (m?.length === 2) {
        const url = new URL(m[1]);
        const elms = url.pathname.split(".");
        const ext = elms[elms.length - 1];
        res.push({
          url: m[1],
          file_name: `${this.getImageUUID(m[1])}.${ext}`, // This is not necessary to be secure
        });
      }
    } while (m);

    return res;
  }

  private async downloadImages(images: ImagePair[]) {
    for (const image of images) {
      console.log(`downloading image: ${image.url}`);
      await download.image({
        url: image.url,
        dest: `${process.cwd()}/${this.getImageDir()}${image.file_name}`,
      });
      console.log("OK");
    }
  }

  private addHeaderToMd(page: NotionPageData, md: string): string {
    const getRow = (tag: string) => ` - ${tag}`;

    let tagsLines = "";
    page.tags.forEach((tag) => {
      if (tagsLines === "") {
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

  private replaceImageURLToPath(images: ImagePair[], md: string): string {
    for (const image of images) {
      md = md.replace(
        `![](${image.url})`,
        `![${image.file_name}](${this._blog_assert_dir}${this._image_dir_prefix}${image.file_name})`
      );
    }
    return md;
  }
}
