// We use the promise library because it allows us to run in series.
const Promise = require('bluebird');
const parser = require('./parser');
const Browser = require('zombie');
const globalEnv = require('./env.js');

/*
  tests (test number of transactions);
  documentation
*/


const validityCheck = (actionList, gEnv) => {
  const isValid = (tree, errors, env) => {
    for (let i = 0; i < tree.length; i++) {
      const action = tree[i];
      if (action.type === 'CallExpression') {
        if (env[action.operator] === undefined || typeof env[action.operator] !== 'function') {
          errors.push(`${action.operator} is not a function`);
        }
      } else if (action.type === 'function') {
        // dummy action to assist in analysis.
        env[action.operator] = () => true;
      }
      if (action.params) {
        isValid(action.params, errors, env);
      }
    }
    return errors;
  };
  //  create a sub env because we will mutate the env to add functions defined in the tree.
  const subEnv = Object.create(gEnv);
  return isValid(actionList, [], subEnv);
};

//
// Test the parse of the string.  Returns an object with
// {success: true || false }
// If there is a failure, inlcude error, line and column in return object
const parseTest = (str) => {
  let actions = [];
  try {
    actions = parser.parse(str.trim());
  } catch (err) {
    return { success: false, message: `${err.message} at 
      line ${err.location.start.line} 
      and column ${err.location.start.column}` };
  }
  const errors = validityCheck(actions, globalEnv);
  if (errors.length > 0) {
    return { success: false, message: `${errors.toString()}` };
  }

  return { success: true };
};
const evaluate = (action, env) => {
  // console.log('action', action);
  if (action.type === 'primitive') {
    return Promise.resolve(action.value);
  }

  if (action.type === 'variable') {
    if (action.name in env) {
      return env[action.name];
    }
    // console.log(env);
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
  if (action.type === 'while') {
    return promiseLoop(action, env);
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


// Creating a while loop with promises is an ugly affair.
const promiseLoop = (action, env) => {
  // console.log(action);
  return Promise.resolve(evaluate(action.operator, env)).then(function loop(bool) {
    //  console.log(i);
    // console.log('bool:', bool);
    const subEnv = Object.create(env);
    if (bool) {
      return Promise.mapSeries(action.params, (a) => evaluate(a, subEnv))
        .then(() => Promise.resolve(evaluate(action.operator, env)))
        .then(loop);
    }
    return Promise.resolve();
  });
};

const run = (host, script) => {
  // Add some things to global environment
  const env = Object.create(globalEnv);
  env.browser = new Browser({ site: host });
  env.responseTimes = [];

  let actions = [];
  try {
    actions = parser.parse(script.trim());
  } catch (err) {
    return Promise.reject(err);
  }
  //  console.log(actions);
  const scenarioStart = new Date();
  return Promise.mapSeries(actions,
    (action) => {
      // console.log('evaluating:', action.operator.name);
      return evaluate(action, env).then((ret) => {
      }).catch((e) => console.log('unresolved error', e));
    }).then((r) => {
      const scenarioEnd = new Date();
      const times = {
        scenarioTime: scenarioEnd - scenarioStart,
        transactionTimes: env.responseTimes,
      };
      return Promise.resolve(times);
    })
    .catch((fail) => console.log('failed for reason', fail));
};

const scriptText = `
set u (randomstring 10)
set p (randomstring 10)

get /
get /signup
fill username $u
fill password $p
pressButton 'Sign up'
get /logout
fill username $u
fill password $p
pressButton Login
set x 0
while(lte $x 4) {
  get /create
  fill url https://google.com
  pressButton Shorten
  set x (add $x 1)
}
get /logout
`;

//  console.log(parseTest(scriptText));
run('http://localhost:3000', scriptText)
.then((data) => console.log('data:', data))
.catch((err) => console.log('err', err));

module.exports = { run };
