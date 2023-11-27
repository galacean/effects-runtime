const chalk = require('chalk');
const simpleGit = require('simple-git');
const { Select } = require('enquirer');
const { fetchPullRequest, queryWithJSDOM, printPR } = require('./utils');

const cwd = process.cwd();
const git = simpleGit(cwd);

async function main() {
  const tags = await git.tags();
  const prompt = new Select({
    name: 'fromVersion',
    message: '🏷  Please choose tag to compare with current branch:',
    choices: tags.all
      .filter((item) => !item.includes('experimental'))
      .filter((item) => !item.includes('alpha'))
      .filter((item) => !item.includes('resource'))
      .reverse()
      .slice(0, 50),
  });
  const fromVersion = await prompt.run();
  const logs = await git.log({ from: fromVersion, to: 'main' });
  let prList = [];

  for (let i = 0; i < logs.all.length; i += 1) {
    const { message, body, hash, author_name: author } = logs.all[i];
    const text = `${message} ${body}`;
    const match = text.match(/#\d+/g);
    const prs = (match || []).map(pr => pr.slice(1));

    console.log(
      `[${i + 1}/${logs.all.length}]`,
      hash.slice(0, 6),
      '-',
      prs.length ? prs.map(pr => `#${pr}`).join(',') : '?',
    );

    for (let j = 0; j < prs.length; j += 1) {
      const pr = prs[j];
      const { response, html } = await fetchPullRequest(pr);
      const res = queryWithJSDOM(html);

      prList.push({ ...res, pr, url: response.url });
    }
  }

  console.log('\n', chalk.green('Done. Here is the log:'));
  console.log('\n');
  printPR(prList);
}

main();
