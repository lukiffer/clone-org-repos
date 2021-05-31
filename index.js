const colors = require('colors/safe');
const argv = require('yargs').argv;
const exec = require('child_process').exec;
const fs = require('fs/promises');
const path = require('path');
const { Octokit } = require('@octokit/rest');

class OrgRepoCloneUtil {

  constructor(sshKeyPath) {
    const token = process.env.GITHUB_TOKEN || process.env.GITHUB_OAUTH_TOKEN;

    if (!token) {
      throw new Error('Missing GitHub authentication token.');
    }

    this.octokit = new Octokit({
      auth: token,
    });

    this.gitSshCommand = `export GIT_SSH_COMMAND='ssh -i "${ sshKeyPath }" -F /dev/null -o "IdentitiesOnly true"';`;
  }

  async clone(org, targetPath) {
    console.log(`Enumerating repositories in the ${ colors.bold(org) } organization...`);
    const repos = await this.getRepositories(org);
    console.log(colors.cyan(`Found ${ colors.bold(repos.length) } repositories.`));

    for (const repo of repos) {
      console.log(`Cloning ${ colors.cyan.bold(repo.name) } from ${ colors.magenta(repo.ssh_url) }...`);
      await this.cloneRepository(repo, targetPath);
      console.log(colors.green('Clone complete!'));

      console.log(`Enumerating branches in repository ${ repo.name }...`);
      const branches = await this.getBranches(org, repo);
      console.log(colors.cyan(`Found ${ colors.bold(branches.length) } branches.`));

      const repoPath = path.join(targetPath, repo.name);
      for (const branch of branches) {
        console.log(`Pulling branch ${ branch.name }...`);
        await this.pullBranch(repoPath, branch.name);
        console.log(colors.green('Pull complete!'));
      }

      console.log(`Checking out default branch ${ repo.default_branch }...`);
      await this.checkoutDefault(repo, targetPath);
      console.log(colors.green.bold(`Finished sync of ${ repo.name } repository.`));
    }
  }

  async getPagedResponse(action, accumulator = [], page = 1) {
    return new Promise(async (resolve, reject) => {
      let result;
      try {
        result = await action(page);
      }
      catch (err) {
        console.log(err);
        reject(err);
      }

      if (result.data.length === 0) {
        resolve(accumulator);
      }
      else {
        accumulator.push(...result.data);
        resolve(await this.getPagedResponse(action, accumulator, (page + 1)));
      }
    });
  }

  async getRepositories(org) {
    return await this.getPagedResponse(async (page) => {
      return await this.octokit.repos.listForOrg({
        org,
        type: 'all',
        per_page: 100,
        page,
      });
    });
  }

  async getBranches(org, repo) {
    return await this.getPagedResponse(async (page) => {
      return await this.octokit.repos.listBranches({
        owner: org,
        repo: repo.name,
        per_page: 100,
        page,
      });
    });
  }

  gitExec(command, cwd, resolve, reject) {
    exec(`${ this.gitSshCommand } ${ command }`, { cwd }, (err, stdOut, stdErr) => {
      if (err) {
        console.log(colors.dim(stdErr));
        reject(err);
      }
      else {
        console.log(colors.dim(stdOut));
        resolve();
      }
    });
  }

  async cloneRepository(repo, targetPath) {
    const repoPath = path.join(targetPath, repo.name);
    return new Promise(async (resolve, reject) => {
      try {
        await fs.stat(repoPath);
        console.log(colors.yellow(`The target path for this repository is not empty: ${ repoPath }`));
        resolve();
      }
      catch {
        this.gitExec(`git clone ${ repo.ssh_url }`, targetPath, resolve, reject);
      }
    });
  }

  async pullBranch(repoPath, branchName) {
    return new Promise((resolve, reject) => {
      this.gitExec(`git fetch --all && git checkout ${ branchName } && git pull`, repoPath, resolve, reject);
    });
  }

  async checkoutDefault(repo, targetPath) {
    return new Promise((resolve, reject) => {
      this.gitExec(`git checkout ${ repo.default_branch }`, path.join(targetPath, repo.name), resolve, reject);
    });
  }
}

async function main() {
  if (!argv.org) {
    throw new Error(`Missing required --org argument.`);
  }

  const sshKeyPath = argv['ssh-key'] || '$HOME/.ssh/id_rsa';
  const targetPath = argv['target-path'] || '.';

  const service = new OrgRepoCloneUtil(sshKeyPath);
  await service.clone(argv.org, targetPath);
}

main().then(() => {
  console.log(colors.green.bold('Import completed successfully.'));
  process.exit(0);
}).catch((e) => {
  console.log(colors.red(colors.bold('An error occurred while performing the import: ') + e));
  process.exit(-1);
});
