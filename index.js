// We use the promise library because it allows us to run in series.
const Promise = require('bluebird');
const parser = require('./parser');
const Browser = require('zombie');

// TODO:
// tests
// remove size.
// delay 3
// for loop?
// variables.
// ( { ?

const scriptText = `get /
fill username bill
fill password password
pressButton Login
get /links
times 3 ( get / )
`;


const env = {
  responseTimes: [],
  multi: (arg1, arg2) => new Promise((resolve, reject) => resolve(arg1 * arg2)),
  plus: (arg1, arg2) => new Promise((resolve, reject) => resolve(arg1 + arg2)),
  times: (times, expr) => {
    console.log('expr', expr);
    return Promise.resolve(times).then((n) => {
      const promiseList = [];
      for (let i = 0; i < n; i++) {
        promiseList.push(expr);
      }
      return Promise.resolve(promiseList);
    })
    .mapSeries((a) => {
      a.type = 'CallExpression';
      return evaluate(a);
    })
    .then((added) => Promise.resolve(env.browser));
  },
  get: (path) =>
    new Promise((resolve, reject) => {
      console.log('visiting:', path);
      const startTime = new Date();
      env.browser.visit(path).then((blah) => {
        const endTime = new Date();
        env.responseTimes.push({
          path: env.browser.request.url,
          statusCode: env.browser.response.status,
          elapsedTime: endTime - startTime,
          httpVerb: env.browser.request.method,
        });
        resolve(env.browser);
      });
    }),
  fill: (selector, value) =>
    new Promise((resolve, reject) => {
      console.log('filling:', selector, 'with ', value);
      env.browser.fill(selector, value);
      resolve(env.browser);
    }),
  pressButton: (selector) =>
    new Promise((resolve, reject) => {
      console.log('pressing:', selector);
      const startTime = new Date();
      env.browser.pressButton(selector).then(() => {
        const endTime = new Date();
        env.responseTimes.push({
          path: env.browser.request.url,
          statusCode: env.browser.response.status,
          elapsedTime: endTime - startTime,
          httpVerb: env.browser.request.method,
        });
        resolve(env.browser);
      });
    }),
};

const evaluate = (action) => {
  if (action.type === 'value') {
    return Promise.resolve(action.value);
  }

  if (action.type === 'word') {
    if (action.name in env) {
      return env[action.name];
    }
    return Promise.reject(`Undefined variable: ${action.name}`);
  }

  if (action.type === 'CallExpression') {
    const op = evaluate(action.operator);
    if (typeof op !== 'function') {
      return Promise.reject('Applying a non-function.');
    }
    // First we resolve all the parameters of the expression.  Then we
    // apply the expression with our expanded parameters.  And return that.
    return Promise.mapSeries(action.params, (a) => evaluate(a))
      .then((resolvedParameters) => op.apply(null, resolvedParameters));
  }
  //  Hand expression on without evaluation.
  if (action.type === 'DelayExpression') {
    // const op = evaluate(action.operator);
    // return op.apply(null, action.params);
    return action;
  }
  return Promise.reject(`Unknown type in ${action}`);
};

const run = (host, script) => {
  env.browser = new Browser({ site: host });
  const actions = parser.parse(script.trim());

  console.log('actions:', actions);

  const scenarioStart = new Date();
  return Promise.mapSeries(actions,
    (action) => {
      console.log('evaluating:', action.operator.name);
      return evaluate(action).then((ret) => {
      }).catch((e) => console.log('unresolved error', e));
    }).then(() => {
      const scenarioEnd = new Date();
      const times = {
        scenarioTime: scenarioEnd - scenarioStart,
        transactionTimes: env.responseTimes,
      };
      return Promise.resolve(times);
    })
    .catch((fail) => console.log('failed for reason', fail));
};

run('http://localhost:3000', scriptText)
.then((data) => console.log('data:', data))
.catch((err) => console.log('err', err));

module.exports = { run };
