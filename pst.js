// We use the promise library because it allows us to run a set of promises in series.

// This is an example of what I'm calling a promise syntax tree.  Sort of like abstract syntax tree,
// but all the commands return a promise.  Like a syntax tree, it has to evaluate down the chain
// before resolving the promises higher in the recursive call.
// Is it efficient?  Probably not.

const Promise = require('bluebird');

const actions = {
  type: 'CallExpression',
  operator: { type: 'word', name: 'multi' },
  params: [{ type: 'value', value: 2 },
    {
      type: 'CallExpression',
      operator: { type: 'word', name: 'plus' },
      params: [{ type: 'value', value: 3 }, { type: 'value', value: 4 }],
    },
  ],
};

const env = {
  multi: (arg1, arg2) => new Promise((resolve, reject) => resolve(arg1 * arg2)),
  plus: (arg1, arg2) => new Promise((resolve, reject) => resolve(arg1 + arg2)),
};

const evaluate = (action) => {
  if (action.type === 'value') {
    return Promise.resolve(action.value);
  }

  if (action.type === 'word') {
    if (action.name in env) {
      return env[action.name];
    }
    return Promise.reject('Undefined variable: ${action.name}');
  }

  if (action.type === 'CallExpression') {
    const op = evaluate(action.operator);
    if (typeof op !== 'function') {
      return Promise.reject('Applying a non-function.');
    }
    return Promise.mapSeries(action.params, (a) => evaluate(a))
      .then((resolvedParameters) => op.apply(null, resolvedParameters));
  }
  return Promise.reject('Unknown type: ${action.type}');
};

evaluate(actions)
  .then((data) => console.log('data:', data))
  .catch((fail) => console.log('failed for reason', fail));
