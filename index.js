// We use the promise library because it allows us to run in series.
const Promise = require('bluebird');
const parser = require('./parser');
const Browser = require('zombie');

// TODO:
// tests
// delay 3
// for loop?
// variables.
// ( { ?
//
//  Implement scoping
// write a script to test our own site


// get /
// fill username bill
// fill password password
// pressButton Login
// get /links

const scriptText = `
set x 2
if(lte $x 4) {
log bill
}
log $x
`;
//
// Test the parse of the string.  Returns an object with
// {success: true || false }
// If there is a failure, inlcude error, line and column in return object
const parseTest = (str) => {
  try {
    parser.parse(str.trim());
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err.message,
      line: err.location.start.line,
      column: err.location.start.column,
    };
  }
};


const globalEnv = {
  responseTimes: [],
  mult: (arg1, arg2, env) => new Promise((resolve, reject) => resolve(arg1 * arg2)),
  add: (arg1, arg2, env) => new Promise((resolve, reject) => resolve(arg1 + arg2)),
  eq: (arg1, arg2, env) => new Promise((resolve, reject) => resolve(arg1 === arg2)),
  lt: (arg1, arg2, env) => new Promise((resolve, reject) => resolve(arg1 < arg2)),
  gt: (arg1, arg2, env) => new Promise((resolve, reject) => resolve(arg1 > arg2)),
  lte: (arg1, arg2, env) => new Promise((resolve, reject) => resolve(arg1 <= arg2)),
  gte: (arg1, arg2, env) => new Promise((resolve, reject) => resolve(arg1 >= arg2)),
  log: (arg1, env) => new Promise((resolve, reject) => resolve(console.log(arg1))),
  set: (variableName, primitiveValue, env) => {
    return new Promise((resolve, reject) => {
      env[variableName] = primitiveValue;
      return resolve('test');
    });
  },
  times: (times, expr, env) => {
    // console.log('expr', expr);
    return Promise.resolve(times).then((n) => {
      const promiseList = [];
      for (let i = 0; i < n; i++) {
        promiseList.push(expr);
      }
      return Promise.resolve(promiseList);
    })
    .mapSeries((a) => {
      a.type = 'CallExpression';
      return evaluate(a, env);
    })
    .then((added) => Promise.resolve(env.browser));
  },
  get: (path, env) =>
    new Promise((resolve, reject) => {
      // console.log('visiting:', path);
      const startTime = new Date();
      env.browser.visit(path).then((blah) => {
        const endTime = new Date();
        env.responseTimes.push({
          actionName: ['get', path],
          path: env.browser.request.url,
          statusCode: env.browser.response.status,
          elapsedTime: endTime - startTime,
          httpVerb: env.browser.request.method,
        });
        resolve(env.browser);
      });
    }),
  fill: (selector, value, env) =>
    new Promise((resolve, reject) => {
      // console.log('filling:', selector, 'with ', value);
      env.browser.fill(selector, value);
      resolve(env.browser);
    }),
  pressButton: (selector, env) =>
    new Promise((resolve, reject) => {
      // console.log('pressing:', selector);
      const startTime = new Date();
      env.browser.pressButton(selector).then(() => {
        const endTime = new Date();
        env.responseTimes.push({
          actionName: ['pressButton', selector],
          path: env.browser.request.url,
          statusCode: env.browser.response.status,
          elapsedTime: endTime - startTime,
          httpVerb: env.browser.request.method,
        });
        resolve(env.browser);
      });
    }),
};


const evaluate = (action, env) => {
  if (action.type === 'primitive') {
    return Promise.resolve(action.value);
  }

  if (action.type === 'variable') {
    if (action.name in env) {
      return env[action.name];
    }
    console.log(env);
    return Promise.reject(`no such variable: ${action.name}`);
  }

  if (action.type === 'function') {
    env[action.operator] = (() => {
      const argumentList = action.args;
      return (...args) => {
        const subEnv = Object.create(env);
        for (let i = 0; i < argumentList.length; i++) {
          subEnv[argumentList[i]] = args[i];
        }
        return Promise.mapSeries(action.params, (a) => evaluate(a, subEnv))
          .then((resolvedParameters) => Promise.resolve(resolvedParameters));
      };
    })();
    return Promise.resolve();
  }

  if (action.type === 'if') {
    return evaluate(action.operator, env).then((bool) => {
      if (bool) {
        // it gets it's own environment in the if.
        const subEnv = Object.create(env);
        return Promise.mapSeries(action.params, (a) => evaluate(a, subEnv));
      }
      return Promise.resolve();
    });
  }
  if (action.type === 'CallExpression') {
    const op = env[action.operator];
    if (typeof op !== 'function') {
      return Promise.reject(`${op} not a function`);
    }
    // First we resolve all the parameters of the expression.  Then we
    // apply the expression with our expanded parameters.  And return that.
    return Promise.mapSeries(action.params, (a) => evaluate(a, env))
      .then((resolvedParameters) => op.apply(null, resolvedParameters.concat(env)));
  }
  return Promise.reject(`Unknown type: '${action.type}' in ${action}`);
};

const run = (host, script) => {
  globalEnv.browser = new Browser({ site: host });
  const actions = parser.parse(script.trim());
  // console.log(actions);
  const scenarioStart = new Date();
  return Promise.mapSeries(actions,
    (action) => {
      // console.log('evaluating:', action.operator.name);
      return evaluate(action, globalEnv).then((ret) => {
      }).catch((e) => console.log('unresolved error', e));
    }).then((r) => {
      const scenarioEnd = new Date();
      const times = {
        scenarioTime: scenarioEnd - scenarioStart,
        transactionTimes: globalEnv.responseTimes,
      };
      return Promise.resolve(times);
    })
    .catch((fail) => console.log('failed for reason', fail));
};

run('http://localhost:3000', scriptText)
.then((data) => console.log('data:', data))
.catch((err) => console.log('err', err));

module.exports = { run };
