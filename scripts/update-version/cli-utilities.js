const { prompt } = require('enquirer');
const { symbols } = require('ansi-colors');
const { prefix, error, success } = require('./logger');

const serialId = (function () {
  let id = 0;
  return () => id++;
})();
const onCancel = () => {
  success("Cancelled... 👋 ");
  process.exit();
};

async function askCheckboxPlus(message, choices, format) {
  const name = `CheckboxPlus-${serialId()}`;

  return prompt({
    type: 'autocomplete',
    name,
    message,
    prefix,
    multiple: true,
    choices,
    format,
    limit: 10,
    onCancel,
    symbols: {
      indicator: symbols.radioOff,
      checked: symbols.radioOn,
    },
    indicator(state, choice) {
      return choice.enabled ? state.symbols.checked : state.symbols.indicator;
    },
  })
    .then(responses => responses[name])
    .catch(err => error);
}

async function askQuestion(message) {
  const name = `Question-${serialId()}`;

  return prompt([{
    type: 'input',
    message,
    name,
    prefix,
    onCancel,
  }])
    .then(responses => responses[name])
    .catch(err => error);
}

module.exports = {
  askCheckboxPlus,
  askQuestion,
};
