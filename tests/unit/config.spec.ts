import { getRepoName, initConfig } from '../../src/config';

describe('getRepoName', () => {
  it('returns valid repo name', () => {
    const config = initConfig();
    config.github.repo = 'https://github.com/username/reponame.git';
    expect(getRepoName(config)).toBe('reponame');
  });

  it('returns empty string when given repository is invalid', () => {
    const config = initConfig();
    config.github.repo = 'invalid-repository';
    expect(getRepoName(config)).toBe('');
  });
});
