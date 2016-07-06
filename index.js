// We use the promise library because it allows us to run in series.
const Promise = require('bluebird');
const parser = require('./parser');
const Browser = require('zombie');
const globalEnv = require('./env.js');

const validityCheck = (actionList, gEnv) => {
  const isValid = (tree, errors, env) => {
    for (let i = 0; i < tree.length; i++) {
      const action = tree[i];
      if (action.type === 'CallExpression') {
        if (env[action.operator] === undefined || typeof env[action.operator] !== 'function') {
          errors.push(`${action.operator} is not a function`);
        }
        if (action.params !== undefined) {
          validityCheck(action.params, errors, env);
        }
      } else if (action.type === 'function') {
        // dummy action to assist in analysis.
        env[action.operator] = () => true;
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
    throw new SyntaxError(`${err.message} at 
      line ${err.location.start.line} 
      and column ${err.location.start.column}`);
  }
  const errors = validityCheck(actions, globalEnv);
  if (errors.length > 0) {
    throw new SyntaxError(`${errors.toString()}`);
  }

  return actions;
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

const run = (host, script, env) => {
  // Add some things to global environment
  env.browser = new Browser({ site: host });
  env.responseTimes = [];

  const actions = parseTest(script.trim());
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
set x 1
func bob(hi) {
  test
}
get /
`;

// console.log(parseTest(scriptText));
run('http://localhost:3000', scriptText, globalEnv)
.then((data) => console.log('data:', data))
.catch((err) => console.log('err', err));

module.exports = { run };
