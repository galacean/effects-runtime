const chalk = require('chalk');
const jsdom = require('jsdom');
const configConventional = require('@commitlint/config-conventional');
const commitTypes = configConventional.rules['type-enum'][2];

const { JSDOM } = jsdom;

function printPR(prList) {
  prList.forEach(entity => {
    const { pr, url, author, title, descriptions = [] } = entity;
    const validatePR = commitTypes.some(type => new RegExp(`^${type}(?:\\(\\S+\\))?:\\s.+`, 'ig').test(title.toLocaleLowerCase()));

    // 过滤非 commit types 的 PR
    if (!validatePR) { return; }
    // skip document
    if (title.includes('docs: ')) { return; }

    const titleText = title.replace(title[0], title[0].toLocaleUpperCase());
    const authorText = `@${author}`;
    const urlText = `[#${pr}](${url})`;

    console.log(`- ${titleText}. ${urlText} ${authorText}`);

    if (descriptions.length !== 0) {
      console.log(descriptions.map(desc => `  - ${desc}`).join('\n'));
    }
  });
}

function queryWithJSDOM(txt) {
  const QUERY_TITLE = '.gh-header-title .js-issue-title';
  const QUERY_DESCRIPTION_LINES = '.comment-body ol li';
  const QUERY_AUTHOR = '.pull-discussion-timeline>.js-discussion>.TimelineItem .author';
  const dom = new JSDOM(txt);
  const { document } = dom.window;
  const prTitle = document.querySelector(QUERY_TITLE).textContent.trim();
  const prAuthor = document.querySelector(QUERY_AUTHOR).textContent.trim();
  const prLines = [...document.querySelectorAll(QUERY_DESCRIPTION_LINES)].map(li => li.textContent.trim());

  return {
    title: prTitle,
    author: prAuthor,
    descriptions: prLines,
  };
}

async function fetchPullRequest(pr) {
  const timeout = 30000;
  let tryTimes = 0;
  let response;
  let html;

  try {
    response = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Fetch timeout of ${timeout}ms exceeded`));
      }, timeout);

      fetch(`https://github.com/galacean/effects-runtime/pull/${pr}`)
        .then(res => {
          res.text()
            .then(txt => {
              html = txt;
              clearTimeout(timer);
              resolve(res);
            });
        })
        .catch(reject);
    });
  } catch (e) {
    tryTimes++;
    if (tryTimes < 3) {
      console.log(chalk.red(`❌ Fetch error, reason: ${e}`));
      console.log(chalk.red(`⌛️ Retrying...(Retry times: ${tryTimes})`));
      await fetchPullRequest(pr);
    }
  }

  return { response, html };
}

module.exports = {
  fetchPullRequest,
  queryWithJSDOM,
  printPR,
}
